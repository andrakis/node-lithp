#!/usr/bin/env node
/**
 * Parse and run a file
 *
 * Currently uses Platform V0 Bootstrap parser.
 * Supports the following flags
 */

var fs = require('fs');
var util = require('util'),
    inspect = util.inspect;
var lithp = require('./.'),
    Lithp = lithp.Lithp,
    Atom = lithp.Types.Atom,
    debug = lithp.debug;

var BootstrapParser = require('./platform/v0/parser').BootstrapParser;

var args = process.argv.slice(2);
var file = "";
var use_debug = false;
var use_platform_v1 = false;
var print_times = false;

function show_help () {
	console.error("Usage:");
	console.error("  " + process.argv[1] + " filename [flags]");
	console.error("Available flags:");
	console.error("    -d              Enable Lithp debug mode");
	console.error("    -Dname[=Value]  Define symbol name. If Value not given,");
	console.error("                    defined as true.");
	console.error("    -v1             Load the Platform V1 library");
	console.error("    -t              Print times (parse and run times)");
	console.error("                    to stderr.");
}

args.forEach(A => {
	var matches;
	if(A.match(/^-d(ebug)?$/))
		use_debug = true;
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

result = timeCall("Run code", () => instance.run(parsed));
if(print_times) {
	var totalCalls = 0;
	var info = [];
	var lithp_instances = get_lithp_instances();
	for(var id in lithp_instances) {
		var i = lithp_instances[id];
		totalCalls += i.functioncalls;
		info.push("lithp[" + id + "]: " + i.functioncalls + "\t" + i.CallBuiltin(i.last_chain, "get-def", ["__filename"]));
	}
	console.error(totalCalls + " function calls executed in " + result[1] + "ms across:\n" + info.join("\n") + "\n");
}

