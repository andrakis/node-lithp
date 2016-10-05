/**
 * Lithp, a very small Lisp-like interpreter.
 *
 * This is the main interpreter unit, and performs all the basic
 * interpreter functions.
 *
 * It operates only on prepared OpChains, requiring either hand-
 * compilation or a parser (see run.js.)
 *
 * See samples.js for some hand-compiled samples, or l_src/ for files
 * that can be run with run.js
 */

global._lithp_start = new Date().getTime();

var util = require('util'),
	inspect = util.inspect,
	path = require('path');
require('./util');
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
		console.error.apply(console, arguments);
}
exports.debug = debug;
exports.get_debug_flag = function() { return enable_debug; };
exports.set_debug_flag = function(V) { return enable_debug = V; };

global.lithp_debug = debug;

var lithp_id = 0;
var lithp_instances = {};

global.get_lithp_instances = function() { return lithp_instances; };

function exitHandler(options, err) {
	if(global.lithp_print_times) {
		var info = [];
		var total = (new Date().getTime()) - global._lithp_start;
		var totalCalls = 0;
		for(var id in lithp_instances) {
			var i = lithp_instances[id];
			totalCalls += i.functioncalls;
			info.push("lithp[" + id + "]: " + i.functioncalls + "\t" + i.CallBuiltin(i.last_chain, "get-def", ["__filename"]));
		}
		console.error(totalCalls + " function calls executed in " + total + "ms across:\n" + info.join("\n") + "\n");
	}
	if (err) console.log(err.stack);
	if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

function Lithp () {
	this.functions = {};
	this.depth = 0;
	this.functioncalls = 0;
	this.id = lithp_id++;
	this.stopped = false;
	this.last_chain = null;
	lithp_instances[this.id] = this;
	(require('./builtins')).setup(this);
}
exports.Lithp = Lithp;
global.Lithp = Lithp;

Lithp.prototype.debug = debug;
Lithp.prototype.get_debug_flag = exports.get_debug_flag;

// Stop this instance and remove it from instances table.
Lithp.prototype.stop = function() {
	this.debug("Instance " + this.id + " stopping");
	delete lithp_instances[this.id];
	this.stopped = true;
};

/**
 * Defines a native function (ie, one that runs in the parent language,
 * in this case JavaScript) builtin.
 * These can be called like any other Lithp function.
 */
Lithp.prototype.builtin = function(name, params, body) {
	//debug("builtin, name: " + name + ", params:", params);
	if(name.indexOf("/") == -1) {
		name = name + "/" + params.length;
	}
	if(this.functions[name])
		0;//this.debug('Error: attempt to overwrite ' + name);
	else
		this.functions[name] = new FunctionDefinitionNative(name, params, body);
};

/**
 * Call a builtin library function of the given name (including /arity) and
 * return the value.
 * The arguments must already be resolved when given to this function.
 */
Lithp.prototype.CallBuiltin = function(chain, name, args) {
	if(!this.functions[name]) {
		name = name + "/" + args.length;
	}

	if(!this.functions[name]) {
		console.log(this.functions);
		throw new Error("Cannot call builtin: " + name + " builtin not present");
	}
	return this.invoke_functioncall(chain, this.functions[name], args);
};

/**
 * Define a symbol in the top level definitions table.
 * This works by calling a an existing builtin function.
 */
Lithp.prototype.Define = function(chain, name, args) {
	this.CallBuiltin(chain, 'define/2', [name, args]);
};

/**
 * Get a defined symbol value.
 */
Lithp.prototype.Defined = function(chain, name) {
	return this.CallBuiltin(chain, 'get-def', [name]);
};

/**
 * Setup some default definitions for giving runtime code information about
 * the current environment.
 * It also brings in the currently defined builtin functions.
 */
Lithp.prototype.setupDefinitions = function(chain, file) {
	this.Define(chain, "__filename", path.resolve(file));
	this.Define(chain, "__dirname", path.resolve(path.dirname(file)));
	// Used by builtin import/1
	this.Define(chain, "_module_search_path", [path.resolve(__dirname + "/..") + "/modules"]);
	this.Define(chain, "DEBUG", enable_debug ? Atom('true') : Atom('false'));
	var count = chain.importClosure(this.functions);
	this.debug("Standard library loaded " + count + " symbols");
};

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
				//console.log("chain.get got: ", i);
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
		console.log(chain.closure.getDefined(-1));
		throw new Error('Error, unknown function: ' + i.fn_name);
	}
	// Get the real values of all parameters. This may recursively invoke
	// this function to satisfy calls.
	var self = this;
	var params = i.fn_params.map(function (P) {
		return self.get_param_value(chain, P);
	});
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

// This controls the maximum size of output for unknown objects being printed.
var maxDebugLen = 100;

// A special content parser for Lithp objects that attempts to have terse
// output. Will not output entire object if size is more than maxDebugLen.
function lithpInspectParser (P, Join) {
	// Print strings using double quotes (inspect gives single.)
	// This is to differentiate it from atoms, which use single quotes.
	if(typeof P == typeof "")
		return JSON.stringify(P);
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
Lithp.prototype.inspect = function(Args, Join) {
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
	if(enable_debug) {
		// Only call this in debug mode, since it involves mapping
		// over all of the parameters, which is just wasted time if
		// debug is not on.
		var fn_name = fndef.readable_name;
		if(fndef.constructor === FunctionDefinition)
			fn_name += "/" + fndef.arity;
		debug_str = (lithp_id > 1 ? "[" + this.id + "] " : "") +
			"+" + " |".repeat(this.depth) + " (" + fndef.readable_name +
			(fndef.instance_id ? ':' + fndef.instance_id : '') +
			" " + this.inspect(params, ' ') + ")";
	}
	var arity = fndef.arity;
	var val;
	this.depth++;
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
		debug(debug_str);
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
		fndef.fn_params.forEach(function (Name, Index) {
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
	this.depth--;
	if(enable_debug) {
		debug_str += " :: " + this.inspect([val]);
		debug(debug_str);
	}
	return val;
};
