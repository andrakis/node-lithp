/**
 * Lithp language interpreter.
 *
 * Performs the actual runtime interpretation of compiled OpChains.
 */

"use strict";

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

var atomMissing = Atom('missing');

// This controls the maximum size of output for unknown objects being printed.
var maxDebugLen = 100;

/**
 * Run a function chain and return its value.
 * The is the top level interpreter, responsible for moving through
 * an OpChain and executing instructions, or just getting values
 * from LiteralValue returns.
 * This is the main function for running Lithp code.
 */
Lithp.prototype.run = function(chain) {
	if(this.stopped)
		throw new Error('Error: this instance has been stopped - ' + this.Defined(chain, '__filename'));
	this.last_chain = chain;
	// TODO: use a list for current OpChain to execute so that reduce can
	//       recall its function body
	var value = Atom("nil");
	//lithp_debug(chain);
	//lithp_debug("Resuming chain from pos: " + chain.pos);
	while(chain.next()) {
		var i = chain.get();
		switch(i.constructor) {
			case OpChain:
				//lithp_debug("(run: current closure: ", i.closure.closure);
				//lithp_debug("(      parent closure: ", i.closure.parent);
				value = this.run(new OpChain(chain, i.ops));
				break;
			case FunctionCall:
				//console.log("chain.get got: ", i);
				value = this._do_functioncall(chain, i);
				//lithp_debug("(run: got value from fn call: ", value);
				if(value && value.constructor === OpChain && value.immediate == true) {
					// Invoke this chain immediately
					//lithp_debug("(run: invoking immediately");
					value = this.run(new OpChain(chain, value.ops));
					//lithp_debug("(run: got value from immediate fn call: ", value);
				}
				break;
			case LiteralValue:
				value = i.value;
				break;
			case FunctionDefinition:
			case FunctionDefinitionNative:
				value = i;
				break;
			default:
				debug("ERROR: Unkown operation: " + i.constructor);
				break;
		}
	}
	//lithp_debug("Final value: " + value + " (" + ((value && value.type) ? value.type : typeof value) + ")");
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
	//lithp_debug("FunctionCall " + i.fn_name + "(...)");
	var fn_name = i.fn_name;
	var fndef = chain.closure.get_or_missing(fn_name);
	if(fndef == atomMissing) {
		// Check for a function with any arity assigned (*)
		fn_name = fn_name.replace(/\d+$/, '*');
		fndef = chain.closure.get_or_missing(fn_name);
		if(fndef == atomMissing) {
			throw new Error('Error, unknown function: ' + i.fn_name);
		}
		i.fn_name = fn_name; // Update reference for future
	}
	// Get the real values of all parameters. This may recursively invoke
	// this function to satisfy calls.
	var self = this;
	var params = i.fn_params.map(function (P) {
		return self.get_param_value(chain, P);
	});
	//lithp_debug("Final params: ", inspect(params));
	//lithp_debug("Requesting invoke for: ", i);
	//lithp_debug("Found fndef: ", fndef);
	//lithp_debug("Actual fndef: ", fndef);
	return this.invoke_functioncall(chain, fndef, params);
};

/**
 * Get the real value of a parameter.
 * This converts LiteralValues into actual values, as well
 * as calling function calls or simply returning relevant data.
 */
Lithp.prototype.get_param_value = function (chain, param) {
	if(param === undefined)
		return undefined;
	// Atoms are passed whole
	if(param && param.type == 'Atom')
		return param;
	switch(param.constructor) {
		case FunctionCall: return this._do_functioncall(chain, param);
		case LiteralValue: return param.value;
		// The following just return the param itself.
		case VariableReference:
		case OpChain:
		case FunctionDefinition:
			return param;
		default:
			// debug("WARN: unknown value");
			// TODO: merge into above clause
			return param;
	}
};

// A special content parser for Lithp objects that attempts to have terse
// output. Will not output entire object if size is more than maxDebugLen.
function lithpInspectParser (P, Join) {
	// Print strings using double quotes (inspect gives single.)
	// This is to differentiate it from atoms, which use single quotes.
	if(typeof P == typeof "")
		return (P.length <= maxDebugLen) ?
			JSON.stringify(P) : '(string too large to display)';
	if(P)
		switch(P.constructor) {
			case OpChain:
			case VariableReference:
			case FunctionDefinition:
			case FunctionCall:
			case LiteralValue:
			case Tuple:
				return P.toString();
			default:
				if(P.type == 'Atom')
					return "'" + P.name + "'";
				else if(Array.isArray(P))
					return '[' + P.map(function(V) { return lithpInspectParser(V, Join); }).join(Join) + ']';
		}
	var val = inspect(P);
	if(val.length > maxDebugLen && P)
		val = "(" + (P.constructor.name || 'Object') + ": too large to display)";
	return val;
}

/**
 * Return a short string representation of the object.
 */
Lithp.prototype.inspect_object = function(Args, Join) {
	Join = Join || ', ';
	return Args.map(function(V) { return lithpInspectParser(V, Join); }).join(Join);
};

/**
 * Invokes the given function with the given parameters. Assumes parameters
 * have all been resolved.
 *
 * This function can be used by builtin functions to call arbritrary functions.
 */
Lithp.prototype.invoke_functioncall = function(chain, fndef, params) {
	var debug_str = "";
	this.functioncalls++;
	if(global.lithp_debug_flag) {
		// Only call this in debug mode, since it involves mapping
		// over all of the parameters, which is just wasted time if
		// debug is not on.
		var lithp_id = global.get_lithp_max_id();
		var padding = (lithp_id.toString().length - this.id.toString().length);
		    padding = " ".repeat(padding);
		var fn_name = fndef.readable_name;
		if(fndef.constructor === FunctionDefinition)
			fn_name += "/" + fndef.arity;
		var indent = "|";
		if(this.depth < 20)
			indent = indent.repeat(this.depth + 1);
		else
			indent = "|             " + this.depth + " | | ";
		debug_str = (lithp_id > 1 ? "[" + padding + this.id + "] " : "") +
			"+ " + indent  + " (" + fndef.readable_name +
			(fndef.instance_id ? ':' + fndef.instance_id : '') +
			(params.length > 0 ? (" " + this.inspect_object(params, ' ')) : "") + ")";
	}
	var arity = fndef.arity;
	var val;
	this.depth++;
	if(fndef.constructor === FunctionDefinitionNative) {
		//lithp_debug("Calling FunctionDefinitionNative");
		// Call native JavaScript function. Passes given arguments
		// and also pass in the current chain as the last argument.
		if(global.lithp_debug_flag) {
			if(fndef.readable_name == 'while' || fndef.readable_name == 'call' ||
			   fndef.readable_name == 'try'   || fndef.readable_name == 'eval' ||
			   fndef.readable_name == 'apply')
				lithp_debug(debug_str);
		}
		if(arity == '*') {
			// For functions that have an arity of *, pass params as a single
			// argument.
			params = [params];
		}
		val = fndef.fn_body.apply(this, params.concat(chain));
		//lithp_debug("Value returned (native) : ", val);
	} else if (fndef.constructor === FunctionDefinition) {
		// Call a function. Creates a new OpChain from the given
		// function body, and sets the parameters of the closure
		// to the pushed values.
		lithp_debug(debug_str);
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
			//lithp_debug("Set '" + Name + "' to params[" + Index + "] (" + params[Index] + ")");
			// This ensures that the closure will immediately find
			// the named variable, instead of going up the stack
			// to find it (which might hold multiple variables of
			// the same name.)
			call_chain.closure.set_immediate(Name, params[Index]);
		});
		//lithp_debug("Successfully set closure, definitions:", call_chain.closure.closure);
		//lithp_debug("             parent has A            :", call_chain.closure.get("A"));
		//lithp_debug("   Parent                            :", fndef.fn_body.parent);
		//lithp_debug("Invoking FunctionDefinition");
		// Mark it as a function entry
		call_chain.function_entry = fndef.readable_name;
		// Invoke the new chain
		val = this.run(call_chain);
		//lithp_debug("Value returned: ", val);
	} else {
		throw new Error("Don't know what to do with: " + inspect(fndef));
	}
	this.depth--;
	if(global.lithp_debug_flag) {
		debug_str += " :: " + this.inspect_object([val]);
		lithp_debug(debug_str);
	}
	return val;
};
