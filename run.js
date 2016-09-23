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
	process.stderr.write("Usage:\n");
	process.stderr.write("  " + process.argv[1] + " filename [flags]\n");
	process.stderr.write("Available flags:\n");
	process.stderr.write("    -d              Enable Lithp debug mode\n");
	process.stderr.write("    -v1             Load the Platform V1 library\n");
	process.stderr.write("    -t              Print times (parse and run times)\n");
	process.stderr.write("                    to stderr.\n");
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
		process.stderr.write("Unknown option: " + A + "\n");
		process.exit(2);
	}
});

if(file == "") {
	process.stderr.write("Please specify path to source file.\n");
	process.exit(1);
}

if(use_debug)
	lithp.set_debug_flag(true);

var instance = new Lithp();
if(use_platform_v1) {
	(require('./platform/v1/parser-lib')).setup(instance);
}

if(print_times) {
	process.stderr.write("Interpreter loaded in " + (new Date().getTime() - _lithp_start ) + "ms\n");
}
var code = fs.readFileSync(file).toString();
var result = timeCall("Parse code", () => BootstrapParser(code));
var parsed = result[0];
debug("Parsed: " + (0 ? parsed.toString() : inspect(parsed, {depth: null, colors: true})));
if(print_times)
	process.stderr.write("Parsed in " + result[1] + "ms\n");

parsed.importClosure(instance.functions);
result = timeCall("Run code", () => instance.run(parsed));
if(print_times)
	process.stderr.write(instance.functioncalls + " function calls executed in " + result[1] + "ms\n");

