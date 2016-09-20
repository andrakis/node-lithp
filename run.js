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
    debug = lithp.debug;

var BootstrapParser = require('./platform/v0/parser').BootstrapParser;

var args = process.argv.slice(2);
var file = "";
var use_debug = false;
var use_platform_v1 = false;
var print_times = false;

function show_help () {
	console.log("Usage:");
	console.log("  " + process.argv[1] + " filename [flags]");
	console.log("Available flags:");
	console.log("    -d              Enable Lithp debug mode");
	console.log("    -v1             Load the Platform V1 library");
	console.log("    -t              Print times (parse and run times)");
}

args.forEach(A => {
	if(A.match(/^-d(ebug)?$/))
		use_debug = true;
	else if(A.match(/^-v1$/))
		use_platform_v1 = true;
	else if(A.match(/^-(h|-help)$/)) {
		show_help();
		process.exit(3);
	} else if(A.match(/^-t(imes)?$/))
		print_times = true;
	else if(file == "")
		file = A;
	else {
		console.log("Unknown option: " + A);
		process.exit(2);
	}
});

if(file == "") {
	console.log("Please specify path to source file.");
	process.exit(1);
}

if(use_debug)
	lithp.set_debug_flag(true);

var instance = new Lithp();
if(use_platform_v1) {
	(require('./platform/v1/parser-lib')).setup(instance);
}

var code = fs.readFileSync(process.argv[2]).toString();
var result = timeCall("Parse code", () => BootstrapParser(code));
var parsed = result[0];
debug("Parsed: " + (0 ? parsed.toString() : inspect(parsed, {depth: null, colors: true})));
if(print_times)
	console.log("Parsed in " + result[1] + "ms");

parsed.importClosure(instance.functions);
result = timeCall("Run code", () => instance.run(parsed));
if(print_times)
	console.log("Executed in " + result[1] + "ms");

