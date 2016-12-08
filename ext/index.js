/**
 * Example extension library for Lithp.
 *
 * Adds new builtins to Lithp.
 */

"use strict";

var util = require('util'),
	inspect = util.inspect;
// TODO: Ensure correct path to lithp/index.js.
//       Projects using Lithp as a Node module should adjust this path.
var lithp = require(__dirname + '/../index'),
	Lithp = lithp.Lithp,
	debug = lithp.debug,
	types = lithp.Types,
	OpChain = types.OpChain,
	Atom = types.Atom,
	GetAtoms = types.GetAtoms,
	FunctionCall = types.FunctionCall,
	FunctionReentry = types.FunctionReentry,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	AnonymousFunction = types.AnonymousFunction,
	LiteralValue = types.LiteralValue,
	VariableReference = types.VariableReference,
	Tuple = types.Tuple;

var builtins = {};
function builtin (name, params, body) {
	builtins[name] = {params: params, body: body};
}

// See lib/builtins.js for more examples.
builtin("count-params/*", [], Params => Params.length);

builtin('stdin', [], () => process.stdin);
builtin('stdout', [], () => process.stdout);
builtin('stderr', [], () => process.stderr);

builtin('set-top-level', ['Bool'], Bool => global._lithp.set_toplevel = (Bool === Atom('true')));

builtin('index-set', ['List', 'Index', 'Value'], (List, Index, Value) => {
	List[Index] = Value;
	return List;
});

builtin('list-fill', ['Length', 'Value'], (Length, Value) => new Array(Length).fill(Value));
builtin('list-rand', ['List'], List => List[Math.floor(Math.random() * List.length)]);

exports.setup = function(lithp) {
	var count = 0;
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
		count++;
	}
	return count;
};

