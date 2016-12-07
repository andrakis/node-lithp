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

"use strict";

global._lithp = {};
global._lithp_start = new Date().getTime();
global._lithp_global_definitions = {};
global._lithp.set_toplevel = false;
global._lithp.version = "0.9.2"

global._LithpDefine = function(Name, Value) { global._lithp_global_definitions[Name] = Value; };

var util = require('util'),
	inspect = util.inspect,
	path = require('path');
require('./util');
var types = require('./types'),
	Atom = types.Atom,
	FunctionDefinitionNative = types.FunctionDefinitionNative;

var enable_debug = false;
function debug() {
	if(enable_debug)
		console.error.apply(console, arguments);
}
exports.debug = debug;
exports.get_debug_flag = function() { return enable_debug; };
exports.set_debug_flag = function(V) { return global.lithp_debug_flag = enable_debug = V; };

global.lithp_debug_flag = enable_debug;
global.lithp_get_debug = exports.get_debug_flag;
global.lithp_debug = debug;

var lithp_id = 0;
var lithp_instances = {};

global.get_lithp_instances = function() { return lithp_instances; };
global.get_lithp_max_id = function() { return lithp_id; };

var atexit_list = [];
global.lithp_atexit = function(handler) { atexit_list.push(handler); }

function exitHandler(options, err) {
	var written = false;
	atexit_list.forEach(H => H(options, err));
	if (err) console.log(err.stack);
	if (options.exit) {
		if(written)
			process.exit();
		process.stderr.once('drain', function() {
			process.exit();
		});
	}
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
//process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

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
	var filename = file;
	var dirname = "";
	if(file != "[evaluated code]") {
		filename = path.resolve(filename);
		dirname  = path.resolve(path.dirname(filename));
	}
	this.Define(chain, "__filename", filename);
	this.Define(chain, "__dirname", dirname);
	// Used by builtin import/1
	var base = path.resolve(__dirname + "/..");
	this.Define(chain, "_module_search_path", [
		'', base,
		base + "/modules",
		'.', './modules'
	]);
	this.Define(chain, "_modules_imported", []);
	this.Define(chain, "DEBUG", enable_debug ? Atom('true') : Atom('false'));
	// Pull in global definitions
	for(var Name in global._lithp_global_definitions) {
		var Value = global._lithp_global_definitions[Name];
		this.Define(chain, Name, Value);
	}
	var count = chain.importClosure(this.functions);
	this.debug("Standard library loaded " + count + " symbols");
};

// Pull in interpreter
global.Lithp = Lithp;
require('./interpreter');
