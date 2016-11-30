#!/usr/bin/env node
/**
 * vim: set syntax=javascript:
 *
 * Parse and run a file
 *
 * Currently uses Platform V0 Bootstrap parser.
 * Supports the following flags:
 *   -d                     Enable Lithp debug mode.
 *   -p                     Enable bootstrap parser debug mode.
 *   -DNAME[=atom]          Define symbol name. If value not given,
 *                          defined as true. Always an atom.
 *   -t                     Print times (parse and run times)
 *   -a                     Print known atoms after script execution.
 *   -v1                    (Obsolete) Load PlatformV1 library.
 *                          No longer used because platform/1 gives same
 *                          behaviour at run time.
 */

"use strict";

var fs = require('fs');
var util = require('util'),
    inspect = util.inspect;
var lithp = require('./.'),
    Lithp = lithp.Lithp,
    types = lithp.Types,
    Atom = types.Atom,
    debug = lithp.debug;

var BootstrapParser = require('./platform/v0/parser').BootstrapParser;

var args = process.argv.slice(2);
var file = "";
var use_debug = false;
var use_parser_debug = false;
var use_platform_v1 = false;
var print_times = false;
var print_atoms = false;

function show_help () {
	console.error("Usage:");
	console.error("  " + process.argv[1] + " filename [flags]");
	console.error("Available flags:");
	console.error("    -d              Enable Lithp debug mode");
	console.error("    -p              Enable bootstrap parser debug mode");
	console.error("    -Dname[=Value]  Define symbol name. If Value not given,");
	console.error("                    defined as true.");
	console.error("    -t              Print times (parse and run times)");
	console.error("                    to stderr.");
	console.error("    -a              Print known atoms after script execution.");
}

args.forEach(A => {
	var matches;
	if(A.match(/^-d(ebug)?$/))
		use_debug = true;
	else if(A.match(/^-p$/))
		use_parser_debug = true;
	else if(A.match(/^-v1$/))
		use_platform_v1 = true;
	else if(A.match(/^-(h|-help)$/)) {
		show_help();
		process.exit(3);
	} else if(A.match(/^-t(imes)?$/))
		print_times = true;
	else if((matches = A.match(/-D[A-Za-z-_]+(=.*$)?/g))) {
		matches.forEach(Def => {
			var m = A.match(/-D([A-Za-z-_]+)(?:=(.*$))?/);
			var name = m[1];
			var value = Atom(m[2] || 'true');
			debug("Defining '" + name + "' as '" + value + "'");
			_LithpDefine(name, value);
		});
	} else if(file == "")
		file = A;
	else if (A.match(/-(a|atoms?)/))
		print_atoms = true;
	else {
		console.error("Unknown option: " + A + "");
		process.exit(2);
	}
});

if(file == "") {
	console.error("Please specify path to source file.");
	process.exit(1);
}

global.lithp_print_times = print_times;

if(use_debug)
	lithp.set_debug_flag(true);
if(use_parser_debug)
	global._lithp.set_parser_debug(true);

var instance = new Lithp();
if(use_platform_v1) {
	(require('./platform/v1/parser-lib')).setup(instance);
}

if(print_times) {
	console.error("Interpreter loaded in " + (new Date().getTime() - _lithp_start ) + "ms");
}
var code = fs.readFileSync(file).toString();
var result = timeCall("Parse code", () => BootstrapParser(code, file));
var parsed = result[0];
instance.setupDefinitions(parsed, file);
debug("Parsed: " + (1 ? parsed.toString() : inspect(parsed.ops, {depth: null, colors: true})));
if(print_times)
	console.error("Parsed in " + result[1] + "ms");

function tallyCalls () {
	var totalCalls = 0;
	var info = [];
	var lithp_instances = get_lithp_instances();
	for(var id in lithp_instances) {
		var i = lithp_instances[id];
		totalCalls += i.functioncalls;
		info.push("lithp[" + id + "]: " + i.functioncalls + "\t" + i.CallBuiltin(i.last_chain, "get-def", ["__filename"]));
	}
	return [totalCalls, info];
}

result = timeCall("Run code", () => instance.run(parsed));
var beforeEventsCalls = tallyCalls()[0];

global.lithp_atexit(() => {
	if(print_times) {
		console.error(beforeEventsCalls + " function calls executed in " + result[1] + "ms before events");
		var totalCalls = tallyCalls();
		var totalTime  = (new Date().getTime()) - global._lithp_start;
		console.error(totalCalls[0] + " function calls executed in " + totalTime + "ms across:\n" + totalCalls[1].join("\n") + "\n");
		console.error("Total parse time: " + global._lithp.getParserTime() + "ms");
		console.error("OpChains created: " + types.GetOpChainsCount());
	}
	if(print_atoms) {
		console.error("Atoms list:");
		// Filter function below checks if the given key could be interpreted as a number.
		// We filter out those keys because each atom is keyed by name and value (as a string.)
		console.error(Object.filter(types.GetAtoms(), Name => Number.isNaN(new Number(Name) + 0)));
	}
});
