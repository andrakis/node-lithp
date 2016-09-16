/**
 * Lithp, a very small Lisp-like interpreter.
 *
 * This is the main interpreter unit, and performs all the basic
 * interpreter functions.
 *
 * It operates only on prepared OpChains, requiring either hand-
 * compilation or a parser (which is a work in progress.)
 *
 * See samples.js for some hand-compiled samples.
 */

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
exports.debug = debug;
exports.get_debug_flag = () => enable_debug;

function Lithp () {
	this.functions = {};
}
exports.Lithp = Lithp;

Lithp.prototype.debug = debug;
Lithp.prototype.get_debug_flag = exports.get_debug_flag;

/**
 * Defines a native function (ie, one that runs in the parent language,
 * in this case JavaScript) builtin.
 * These can be called like any other Lithp function.
 */
Lithp.prototype.builtin = function(name, params, body) {
	debug("builtin, name: " + name + ", params:", params);
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
	var fn_name = i.fn_name;
	if(!chain.closure.any_defined(fn_name)) {
		// Check for a function with any arity assigned (*)
		fn_name = fn_name.replace(/\d+$/, '*');
	}
	if(!chain.closure.any_defined(fn_name)) {
		throw new Error('Error, unknown function: ' + i.fn_name);
	}
	// Get the real values of all parameters. This may recursively invoke
	// this function to satisfy calls.
	var params = i.fn_params.map(P => this.get_param_value(chain, P));
	//debug("Final params: ", inspect(params));
	//debug("Requesting invoke for: ", i);
	var fndef_get = chain.closure.get(fn_name);
	//debug("Found fndef_get: ", fndef_get);
	if(fndef_get.constructor === Tuple && fndef_get[0] == 'ok') {
		var fndef_and_closure = fndef_get[1];
		var fndef = fndef_and_closure[0];
		//debug("Actual fndef: ", fndef);
		return this.invoke_functioncall(chain, fndef, params);
	} else {
		throw new Error("Don't know what to do with: " + inspect(fndef_def));
	}
};

/**
 * Get the real value of a parameter.
 * This converts LiteralValues into actual values, as well
 * as calling function calls or simply returning relevant data.
 */
Lithp.prototype.get_param_value = function (chain, param) {
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

/**
 * Invokes the given function with the given parameters. Assumes parameters
 * have all been resolved.
 *
 * This function can be used by builtin functions to call arbritrary functions.
 */
Lithp.prototype.invoke_functioncall = function(chain, fndef, params) {
	if(enable_debug) {
		// Only call this in debug mode, since it involves mapping
		// over all of the parameters, which is just wasted time if
		// debug is not on.
		var fnParse = P => {
			if(P)
				switch(P.constructor) {
					case OpChain:
					case VariableReference:
					case FunctionDefinition:
					case FunctionCall:
					case LiteralValue:
						return P.toString();
					default:
						if(P.type == 'Atom')
							return "'" + P.name + "'";
						else if(Array.isArray(P))
							return '[' + P.map(fnParse).join(', ') + ']';
				}
			return inspect(P);
		};
		debug("FunctionCall " + fndef.fn_name + "(", params.map(fnParse).join(', '), ")");
	}
	var arity = fndef.arity;
	var val;
	depth++;
	debug("+".repeat(depth * 2));
	if(fndef.constructor === FunctionDefinitionNative) {
		//debug("Calling FunctionDefinitionNative");
		// Call native JavaScript function. Passes given arguments
		// and also pass in the current chain as the last argument.
		if(arity == '*') {
			// For functions that have an arity of *, pass params as a single
			// argument.
			params = [params];
		}
		val = fndef.fn_body.apply(this, params.concat(chain));
		//debug("Value returned (native) : ", val);
	} else if (fndef.constructor === FunctionDefinition) {
		// Call a function. Creates a new OpChain from the given
		// function body, and sets the parameters of the closure
		// to the pushed values.

		// Set the correct scope. If the function definition has new one, use it.
		// TODO: This parent section is a bit of a hack. It would be nicer if
		//       it were implemented outside of the interpreter.
		var parent = chain;
		if(fndef.scoped)
			parent = fndef.scoped;
		var call_chain = new OpChain(parent, fndef.fn_body);

		if(arity == '*')
			params = [params];
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
		//debug("             parent has A            :", call_chain.closure.get("A"));
		//debug("   Parent                            :", fndef.fn_body.parent);
		//debug("Invoking FunctionDefinition");
		// Invoke the new chain
		val = this.run(call_chain);
		//debug("Value returned: ", val);
	} else {
		throw new Error("Don't know what to do with: " + inspect(fndef));
	}
	depth--;
	return val;
};
