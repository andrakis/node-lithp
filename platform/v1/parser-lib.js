/**
 * Standard library for Parser V1, Platform V0.
 *
 * Contains native and hand-compiled functions.
 * Incorporates additional library functions.
 */

"use strict";

var util = require('util'),
	inspect = util.inspect;
var lithp = require(__dirname + '/../../index'),
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
var lib_parser_switch = require('./lib-parser-switch');

var atomTrue = Atom('true'),
    atomFalse = Atom('false');

var builtins = {};
function builtin (name, params, body) {
	builtins[name] = {params: params, body: body};
}

function builtin_def () {
}

exports.test = (lithp) => {
	lib_parser_switch.test(lithp);
};

exports.setup = function(lithp) {
	var count = 0;
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
		count++;
	}
	// TODO: import functions from lib_parser_switch
	return count;
};

// Used to instantiate classes when the number of parameters it not
// known. Uses apply to instantiate (which is a little trickier than
// usual.)
function newClass (Cls) {
	// Function.bind.apply's first argument is ignored. Thus, it doesn't
	// matter that it's included in arguments.
	return new (Function.bind.apply(Cls, arguments));
}

function error (message) { throw new Error(message); };

/**
 * Implement all of the native types used by the interpreter so that a
 * parser written in Lithp can construct a parsing tree for the interpreter.
 */

// Perform an Object comparison
builtin("equal", ['A', 'B'], (A, B) =>
	Object.equals(A, B) ? atomTrue : atomFalse
);

builtin("get-opchain-closure-current", [], State => new LiteralValue(State.closure));

builtin("opchain-closure", ['Owner', 'Parent'], (Owner, Parent) =>
	new LiteralValue(new OpChainClosure(Owner, Parent))
);

builtin("opchain-closure-any-defined", ['Opchain', 'Name'], (Opchain, Name) =>
	new LiteralValue(Opchain.any_defined(Name))
);

builtin("opchain-closure-set", ['Opchain', 'Name', 'Value'], (Opchain, Name, Value) => {
	Opchain.set(Name, Value);
	return new LiteralValue(Opchain);
});

builtin("opchain-closure-set-immediate", ['Opchain', 'Name', 'Value'], (Opchain, Name, Value) => {
	Opchain.set_immediate(Name, Value);
	return new LiteralValue(Opchain);
});

builtin("opchain-closure-try-set", ['Opchain', 'Name', 'Value'], (Opchain, Name, Value) =>
	new LiteralValue(Opchain.try_set(Name, Value))
);

builtin("opchain-closure-get", ['Opchain', 'Name'], (Opchain, Name) =>
	new LiteralValue(Opchain.get(Name))
);


builtin("opchain", ['Parent', 'Ops'], (Parent, Ops) =>
	new LiteralValue(new OpChain(Parent, Ops))
);

builtin("opchain-push", ['Opchain', 'Value'], (Opchain, Value) => {
	Opchain.push(Value);
	return new LiteralValue(Opchain);
});

builtin("opchain-get", ['Opchain'], (Opchain) =>
	new LiteralValue(Opchain.get())
);

builtin("opchain-next", ['Opchain'], (Opchain) =>
	new LiteralValue(Opchain.next())
);

builtin("opchain-call-immediate", ['Opchain'], (Opchain) =>
	new LiteralValue(Opchain.call_immediate())
);

function alias (newname, oldname) {
	return builtin(newname, [], function() { return builtins[oldname].apply(this, arguments); });
}

builtin("literal-value", ["Value"], Value => new LiteralValue(Value));
alias('lit', 'literal-value');

builtin("function-call", ['Name', 'Params'], (Name, Params) =>
	new LiteralValue(new FunctionCall(Name, Params))
);

builtin("function-definition", ['Parent', 'Name', 'Params', 'Body'], (Parent, Name, Params, Body) =>
	new LiteralValue(new FunctionDefinition(Parent, Name, Params, Body))
);

builtin("lambda", ['Parent', 'Params', 'Body'], (Parent, Params, Body) =>
	new LiteralValue(new AnonymousFunction(Parent, Params, Body))
);

builtin("function-definition-native", ['Name', 'Params', 'Body'], (Name, Params, Body) =>
	new LiteralValue(new FunctionDefinitionNative(Name, Params, Body))
);

builtin("recurse/*", [], function(Arguments, State) {
	// Call the current function again with the given arguments.
	// We do this by calling call/* with the current State.
	// TODO: should just reset the current opchain, and set parameters
	//       to Arguments. Allows for infinite recursion.
	var args = [State.call(), Arguments, State];
	return builtins["call/*"].apply(this, args);
});

// TODO: Test:
// (def catch #Callback :: ((#Exception :: ((call Callback Exception))))
builtin_def('catch_native', (chain) => {
	var fn_body = new OpChain(chain,
		new FunctionCall('call/2', [
			new FunctionCall('get/1', [new VariableReference('Callback')]),
			new FunctionCall('get/1', [new VariableReference('Exception')])
		])
	);
	return new OpChain(chain, new AnonymousFunction(chain, ['Exception'], fn_body));
});

builtin('atoms', [], () => GetAtoms.map(A => A.name));

function atomBool (A) {
	return A == atomTrue ? true : false;
}

builtin('inspect/2', ['Object', 'Deep'], (O, Deep) => inspect(O, {depth: atomBool(Deep) ? null : undefined}));
builtin('inspect/3', ['Object', 'Deep', 'Color'], (O, Deep, Color) => inspect(O, {depth: atomBool(Deep) ? null : undefined, colors: atomBool(Color)}));

function lib_each (chain) {
	/**
	 (
	 	// TODO: keep track of count, also pass it to callback
	 	(def each #List,Callback :: (
			((if (== (length List) 0) (done)
			     (else (
				 	(var Head (head List))
					(var Tail (tail List))
					(call Callback List)
					(each Tail Tail)
				 ))
			))
		)
	 )
	 */
}

function lib_with (chain) {
	/**
	 (
	 	(def with #Value,Callback :: (
			(call Callback Value)
		))
	 )
	 */
}
