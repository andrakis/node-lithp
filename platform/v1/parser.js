/**
 * Parser V1, Platform V0, for Lithp
 *
 * Work in progress.
 *
 * Main parser for the first version of Lithp. A simple parser that can be used
 * to create a better parser later (Platform V1).
 */

var util = require('util'),
	inspect = util.inspect;
var lithp = require(__dirname + '/../../index'),
	Lithp = lithp.Lithp,
	debug = Lithp.debug,
	types = lithp.Types,
	OpChain = types.OpChain,
	Atom = types.Atom,
	FunctionCall = types.FunctionCall,
	FunctionReentry = types.FunctionReentry,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	AnonymousFunction = types.AnonymousFunction,
	LiteralValue = types.LiteralValue,
	VariableReference = types.VariableReference,
	Tuple = types.Tuple,
	parser_lib = require('./parser-lib');

// First, we need to test implementation of some special constructs
// such as closure scope, call, recurse, map, and loop, and switch.

function closure_scope_test (lithp) {
	/**
	 % scope/1 function creates a new FunctionDefinition from the given
	 % definition, and parents it to the current scope.
	 % This allows a function to be returned that keeps reference to
	 % the closure that contained the variable scope needed.
	 (
		(def add #A :: (
			(scope #B :: ((+ A B)))
		))
		(var Add5 (add 5))
		(var Add10 (add 10))
		(var N 10)
		%if debug_flag
			(print "Add5 with " N ": " (call Add5 N))
			(print "Add10 with " N ": " (call Add10 N))
		%endif
		(assert (== 15 (Add5 10)))
	 )
	 */
	var chain = new OpChain();
	
	var add1_body = new OpChain(chain);
	var add1_body_inner1 = new OpChain(add1_body);

	var add1_body_inner1_body = new OpChain(add1_body, [
		// (+ A B)
		new FunctionCall("+/2", [
			new FunctionCall("get/1", [new VariableReference("A")]),
			new FunctionCall("get/1", [new VariableReference("B")])
		])
	]);

	// (scope #B :: add1_body_inner1_body)
	add1_body.push(
		new FunctionCall("scope/1", [new AnonymousFunction(add1_body_inner1, ['B'], add1_body_inner1_body)])
	);

	// (def add #A :: add1_body)
	chain.push(
		new FunctionCall('def/2', [new Atom("add"), AnonymousFunction(chain, ['A'], add1_body)])
	);

	// (var Add5 (add 5))
	chain.push(
		new FunctionCall('var/2', [
			new VariableReference("Add5"),
			new FunctionCall("add/1", [new LiteralValue(5)])
		])
	);

	// (var Add10 (add 10))
	chain.push(
		new FunctionCall('var/2', [
			new VariableReference("Add10"),
			new FunctionCall("add/1", [new LiteralValue(10)])
		])
	);

	// (var N 10)
	chain.push(
		new FunctionCall('var/2', [
			new VariableReference("N"),
			new LiteralValue(10)
		])
	);

	if(lithp.get_debug_flag()) {
		// (print "Scope test: Add5 with" N ":" (call Add5 N))
		chain.push(
			new FunctionCall('print/*', [
				new LiteralValue("Scope test: Add5 with"),
				new FunctionCall("get/1", [new VariableReference("N")]),
				new LiteralValue(":"),
				new FunctionCall("call/2", [
					new FunctionCall("get/1", [new VariableReference("Add5")]),
					new FunctionCall("get/1", [new VariableReference("N")])
				])
			])
		);

		// (print "Scope test: Add10 with" N ":" (call Add10 N))
		chain.push(
			new FunctionCall('print/*', [
				new LiteralValue("Scope test: Add10 with"),
				new FunctionCall("get/1", [new VariableReference("N")]),
				new LiteralValue(":"),
				new FunctionCall("call/2", [
					new FunctionCall("get/1", [new VariableReference("Add10")]),
					new FunctionCall("get/1", [new VariableReference("N")])
				])
			])
		);
	}

	// (assert (== 15 (Add5 10)))
	chain.push(
		new FunctionCall('assert/1', [
			new FunctionCall('==/2', [
				new LiteralValue(15),
				new FunctionCall('call/2', [
					new FunctionCall('get/1', [new VariableReference('Add5')]),
					new LiteralValue(10)
				])
			])
		])
	);

	// (assert (== 23 (Add10 13)))
	chain.push(
		new FunctionCall('assert/1', [
			new FunctionCall('==/2', [
				new LiteralValue(23),
				new FunctionCall('call/2', [
					new FunctionCall('get/1', [new VariableReference('Add10')]),
					new LiteralValue(13)
				])
			])
		])
	);
	chain.importClosure(lithp.functions);
	//console.log(inspect(chain, {depth: null, colors: true}));
	lithp.run(chain);
}

function call_test (lithp) {
	/**
	 (
	 	(print (call #N :: ((+ N 1)) 5))
	 )
	*/
}

// Implement switch using Lithp!
// Uses tuples and callback functions along with recursive
// loops and local functions referencing outside closure
// variables. This really demonstrates the power the very
// simple structures provided are capable of.
function switch_test (lithp) {
	/**
	 	(def test #A :: (
			(switch A
				(case 0 (1))
				(case 1 (2))
				(case 2 (3))
				(default (4))
			)
		))
		(print (test 0))
		(print (test 1))
		(print (test 2))
		(print (test 3))
		(print (test 4))
		(print (test 5))
	*/
}

function for_test (lithp) {
}

function map_test (lithp) {
	/**
	 (
	 	(def map #List,Callback :: (
			(if (== 0 (length List)) ((List))
			(else (
				(set R (call Callback (head List)))
				% Set X to a list containing the result of
				% the callback, followed by reinvoking this
				% function with the tail of List (that is,
				% all but the first item.)
				(set X (list R (map (tail List) Callback)))
				(flatten X)
			)))
		))
		(set L (list 1 2 3 4))
		(set Y (map L #N :: ((* 2 N))))
		(print "Map result:" Y)
	)
	**/
}


function loop_test (lithp) {
	/**
	(
		(def 
	var chain = new OpChain();
    */
}

function simple_parser (lithp) {
	var code = `
		(
			(set Test "test")
			(print "Test: " Test)
		)`;
}

function require_test (lithp) {
	/**
	 (
		(var Fs (require "fs"))
		(var FsReadFileSync (dict-get Fs "readFileSync"))
		(print "readFileSync:" (inspect FsReadFileSync))
		% You can call FsReadFileSync using call/* (a parser-specific builtin.)
		(print "Read index.js:" (call FsReadFileSync "index.js"))
	 )
	 */
	var chain = new OpChain();

	chain.push(
		new FunctionCall("var/2", [
			new VariableReference("Fs"),
			new FunctionCall("require/1", [new LiteralValue("fs")])
		])
	);

	chain.push(
		new FunctionCall("var/2", [
			new VariableReference("FsReadFileSync"),
			new FunctionCall("dict-get/2", [
				new FunctionCall("get/1", [new VariableReference("Fs")]),
				new LiteralValue("readFileSync")
			])
		])
	);

	chain.push(
		new FunctionCall("print/*", [
			new LiteralValue("readFileSync:"),
			new FunctionCall("inspect/1", [
				new FunctionCall("get/1", [new VariableReference("FsReadFileSync")])
			])
		])
	);

	chain.push(
		new FunctionCall("print/*", [
			new LiteralValue("Read index.js:"),
			new FunctionCall("call/2", [
				new FunctionCall("get/1", [new VariableReference("FsReadFileSync")]),
				new LiteralValue("index.js")
			])
		])
	);

	chain.importClosure(lithp.functions);
	//console.log(inspect(chain, {depth: null, colors: true}));
	lithp.run(chain);
}

function jsbridge_test (lithp) {
	/**
	 (
		(var Fs (require "fs"))
		(var FsReadFile (dict-get Fs "readFile"))
		(print "readFile:" (inspect FsReadFile))
		(var Our_callback (js-bridge #Err,Data :: (
			(print "Err:  " Err)
			(print "Data: " Data)
		)))
		% You can call FsReadFile using call/* (a parser-specific builtin.)
		(call FsReadFile "index.js" Our_callback)
	 )
	 */
	var chain = new OpChain();

	chain.push(
		new FunctionCall("var/2", [
			new VariableReference("Fs"),
			new FunctionCall("require/1", [new LiteralValue("fs")])
		])
	);

	chain.push(
		new FunctionCall("var/2", [
			new VariableReference("FsReadFile"),
			new FunctionCall("dict-get/2", [
				new FunctionCall("get/1", [new VariableReference("Fs")]),
				new LiteralValue("readFile")
			])
		])
	);

	chain.push(
		new FunctionCall("print/*", [
			new LiteralValue("readFile:"),
			new FunctionCall("inspect/1", [
				new FunctionCall("get/1", [new VariableReference("FsReadFile")])
			])
		])
	);

	var our_callback1_body = new OpChain(chain, [
		new FunctionCall("print/*", [
			new LiteralValue("Err:   "),
			new FunctionCall("get/1", [new VariableReference("Err")])
		]),
		new FunctionCall("print/*", [
			new LiteralValue("Data:  "),
			new FunctionCall("get/1", [new VariableReference("Data")])
		])
	]);

	chain.push(
		new FunctionCall("var/2", [
			new VariableReference("Our_callback"),
			new FunctionCall("js-bridge/1", [
				AnonymousFunction(chain, ['Err', 'Data'], our_callback1_body)
			])
		])
	);

	chain.push(
		new FunctionCall("call/2", [
			new FunctionCall("get/1", [new VariableReference("FsReadFile")]),
			new LiteralValue("index.js"),
			new FunctionCall("get/1", [new VariableReference("Our_callback")])
		])
	);

	chain.importClosure(lithp.functions);
	//console.log(inspect(chain, {depth: null, colors: true}));
	lithp.run(chain);
}

var lithp = new Lithp();
(require(__dirname + '/../../lib/builtins')).setup(lithp);
parser_lib.setup(lithp);
//parser_lib.test(lithp);
//closure_scope_test(lithp);
//require_test(lithp);
jsbridge_test(lithp);

