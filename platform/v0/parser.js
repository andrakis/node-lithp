/**
 * Parser V0 for Lithp
 *
 * Work in progress.
 *
 * Main parser for the first version of Lithp.
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
	 (
		(def add #A :: (
			#B :: ((+ A B))
		))
		(var Add5 (add 5))
		(var N 10)
		(print "Add5 with " N ": " (call Add5 N))
	 )
	 */
	var chain = new OpChain();
	
	var add1_body = new OpChain(chain);
	var add1_body_inner1 = new OpChain(add1_body);

	var add1_body_inner1_body = new OpChain(add1_body_inner1, [
		new FunctionCall("print/*", [new LiteralValue("Should call add now")]),
		new FunctionCall("+/2", [
			new FunctionCall("get/1", [new VariableReference("A")]),
			new FunctionCall("get/1", [new VariableReference("B")])
		])
	]);

	add1_body_inner1.push(
		//new LiteralValue(AnonymousFunction(add1_body, ['B'], add1_body_inner1_body))
			new FunctionCall("call/*", [
				AnonymousFunction(add1_body, ['B'], add1_body_inner1_body),
				new FunctionCall("get/1", [new VariableReference("A")])
			])
	);

	add1_body.push(
		new FunctionCall("print/*", [new LiteralValue("add1_body")])
	);
	add1_body.push(
		new LiteralValue(AnonymousFunction(add1_body, ['A'], add1_body_inner1))
	);

	chain.push(
		new FunctionCall('def/2', [new Atom("add"), AnonymousFunction(chain, ['A'], add1_body)])
	);

	chain.push(
		new FunctionCall('var/2', [
			new VariableReference("Add5"),
			new FunctionCall("add/1", [new LiteralValue(5)])
		])
	);

	chain.push(
		new FunctionCall('var/2', [
			new VariableReference("N"),
			new LiteralValue(10)
		])
	);

	// (print "Add5 with " N ": " (call Add5 N))
	chain.push(
		new FunctionCall('print/*', [
			new LiteralValue("Add5 with "),
			new FunctionCall("get/1", [new VariableReference("N")]),
			new LiteralValue(": "),
			new FunctionCall("call/2", [
				new FunctionCall("get/1", [new VariableReference("Add5")]),
				new FunctionCall("get/1", [new VariableReference("N")])
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

var lithp = new Lithp();
(require(__dirname + '/../../lib/builtins')).setup(lithp);
parser_lib.setup(lithp);
closure_scope_test(lithp);

