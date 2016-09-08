var util = require('util'),
	inspect = util.inspect;
var types = require('./types'),
	OpChain = types.OpChain,
	Atom = types.Atom,
	FunctionCall = types.FunctionCall,
	FunctionReentry = types.FunctionReentry,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	AnonymousFunction = types.AnonymousFunction,
	LiteralValue = types.LiteralValue,
	VariableReference = types.VariableReference,
	Tuple = types.Tuple;

var enable_debug = false;
function debug() {
	if(enable_debug)
		console.log.apply(console, arguments);
}

function Lithp () {
	this.functions = {};
}
exports.Lithp = Lithp;

/**
 * Defines a native function (ie, one that runs in the parent language,
 * in this case JavaScript) builtin.
 * These can be called like any other Lithp function.
 */
Lithp.prototype.builtin = function(name, params, body) {
	if(name.indexOf("/") == -1) {
		name = name + "/" + params.length;
	}
	if(this.functions[name])
		throw new Error('Error: attempt to overwrite ' + name);
	this.functions[name] = new FunctionDefinitionNative(name, params, body);
};

var depth = 0;
/**
 * Run a function chain and return its value.
 * The is the top level interpreter, responsible for moving through
 * an OpChain and executing instructions, or just getting values
 * from LiteralValue returns.
 * This is the main function for running Lithp code.
 */
Lithp.prototype.run = function(chain) {
	// TODO: use a list for current OpChain to execute so that reduce can
	//       recall its function body
	var value = Atom("nil");
	//debug(chain);
	//debug("Resuming chain from pos: " + chain.pos);
	depth++;
	debug("+".repeat(depth));
	while(chain.next()) {
		var i = chain.get();
		switch(i.constructor) {
			case OpChain:
				//debug("(run: current closure: ", i.closure.closure);
				//debug("(      parent closure: ", i.closure.parent);
				value = this.run(new OpChain(chain, i.ops));
				break;
			case FunctionCall:
				value = this._do_functioncall(chain, i);
				//debug("(run: got value from fn call: ", value);
				if(value && value.constructor === OpChain && value.immediate == true) {
					// Invoke this chain immediately
					//debug("(run: invoking immediately");
					value = this.run(new OpChain(chain, value.ops));
					//debug("(run: got value from immediate fn call: ", value);
				}
				break;
			case LiteralValue:
				value = i.value;
				break;
			default:
				debug("ERROR: Unkown operation: " + i.constructor);
				break;
		}
	}
	//debug("Final value: " + value + " (" + ((value && value.type) ? value.type : typeof value) + ")");
	depth--;
	debug("+".repeat(depth));
	return value;
};

/**
 * Perform a function call with the given chain closure.
 *
 * This is the main interpreting function, it takes care
 * of creating new closures for a function call, making
 * the call itself, and finding the correct function to
 * call based on arity.
 *
 * For each argument, if it is a function call, this
 * procedure is called recursively, eventually returning
 * the appropriate real value so that the function call
 * can occur.
 */
Lithp.prototype._do_functioncall = function(chain, i) {
	//debug("FunctionCall " + i.fn_name + "(...)");
	if(!chain.closure.any_defined(i.fn_name)) {
		// Check for a function with any arity assigned (*)
		i.fn_name = i.fn_name.replace(/\d+$/, '*');
	}
	if(!chain.closure.any_defined(i.fn_name)) {
		throw new Error('Error, unknown function: ' + i.fn_name);
	}
	// Check args
	for(var a = 0; a < i.fn_args; a++) {
		var arg = i.fn_params[a];
		//debug(" check arg: ", arg);
		if(arg && arg.constructor == FunctionDefinition) {
			// If this function definition (often an anonymous one) has
			// params currently defined in the visible chain, we raise
			// an error.
			// Perhaps this behaviour could be changed, but I'd rather
			// it be an error that ambiguous code like this attempts
			// to run:
			//	(
			//		(def x#Y :: (
			//			% Error: which Y is being referred to?
			//			(call #Y :: (Y) Y)
			//		))
			//	)
			// TODO: Could try to pattern match, but perhaps not in this iteration
			//       since multiple function definitions aren't part of this spec.
			for(var fdi = 0; fdi <= arg.fn_params; fdi++) {
				var fd = arg.fn_params[fdi];
				if(chain.any_defined(fd)) {
					throw new Error('Function attempted to use already defined variable / parameter name "' + fd + '"');
				}
			}
		}
	}
	// Get the real values of all parameters. This may recursively invoke
	// this function to satisfy calls.
	var params = i.fn_params.map(P => this._get_param_value(chain, P));
	//debug("Final params: ", inspect(params));
	debug("FunctionCall " + i.fn_name + "(", params.map(P => {
		if(P)
			if(P.constructor === OpChain)
				return P.ops;
			else if(P.constructor === VariableReference)
				return P.ref;
		return P;
	}), ")");
	//debug("Requesting invoke for: ", i);
	// TODO: check arguments count, return curried function if not correct
	var fndef_get = chain.closure.get(i.fn_name);
	if(!fndef_get) {
		throw new Error('Attempt to call undefined function: ' + i.fn_name);
	}
	//debug("Found fndef_get: ", fndef_get);
	if(fndef_get.constructor === Tuple && fndef_get.get(0) == 'ok') {
		var fndef_and_closure = fndef_get.get(1);
		var fndef = fndef_and_closure.get(0);
		var closure = fndef.fn_body;
		//debug("Actual fndef: ", fndef);
		//debug("Closure: ", closure);
		if(fndef.constructor === FunctionDefinitionNative) {
			//debug("Calling FunctionDefinitionNative");
			// Call native JavaScript function. Passes given arguments
			// and also pass in the current chain as the last argument.
			var val = fndef.fn_body.apply({}, params.concat(chain));
			//debug("Value returned (native) : ", val);
			return val;
		} else if (fndef.constructor === FunctionDefinition) {
			// Call a function. Creates a new OpChain from the given
			// function body, and sets the parameters of the closure
			// to the pushed values.
			var call_chain = new OpChain(chain, fndef.fn_body);
			// Set args in new function closure
			fndef.fn_params.forEach((Name, Index) => {
				//debug("Set '" + Name + "' to params[" + Index + "] (" + params[Index] + ")");
				// This ensures that the closure will immediately find
				// the named variable, instead of going up the stack
				// to find it (which might hold multiple variables of
				// the same name.)
				call_chain.closure.set_immediate(Name, params[Index]);
			});
			//debug("Successfully set closure, definitions:", call_chain.closure.closure);
			//debug("   Parent                            :", fndef.fn_body.parent);
			//debug("Invoking FunctionDefinition");
			// Invoke the new chain
			var val = this.run(call_chain);
			//debug("Value returned: ", val);
			return val;
		} else {
			throw new Error("Don't know what to do with: ", inspect(fndef));
		}
	} else {
		throw new Error("Don't know what to do with:", inspect(fndef_def));
	}
};

/**
 * Get the real value of a parameter.
 * This converts LiteralValues into actual values, as well
 * as calling function calls or simply returning relevant data.
 */
Lithp.prototype._get_param_value = function (chain, param) {
	if(param === undefined)
		return undefined;
	switch(param.constructor) {
		case FunctionCall:
			return this._do_functioncall(chain, param);
		case LiteralValue:
			return param.value;
		// The following just return the param itself.
		case VariableReference:
		case OpChain:
		case FunctionDefinition:
			return param;
		default:
			if(param && param.type == 'Atom') {
				// Atoms are currently passed whole
				return param;
			}
			debug(inspect(param));
			throw new Error("Don't know how to _get_param_value of '" + (typeof param) + "' (" + (param ? param.type : 'undefined') + ")");
	}
};

