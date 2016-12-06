/**
 * Example extension library for Lithp.
 *
 * Adds new builtins to Lithp.
 */
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

exports.setup = function(lithp) {
	var count = 0;
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
		count++;
	}
	return count;
};

