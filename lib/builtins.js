/**
 * Builtin Lithp runtime library.
 *
 * Contains a number of critical utility functions such as control flow,
 * function definition, arithmatic, and some basic IO.
 */

var util = require('util'),
    inspect = util.inspect;
require('./util');
var types = require('./types'),
	Atom = types.Atom,
	Tuple = types.Tuple,
	OpChain = types.OpChain,
	FunctionCall = types.FunctionCall,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	LiteralValue = types.LiteralValue,
	VariableReference = types.VariableReference;

var builtins = {};

// Cache these frequently used atoms
var atomTrue = Atom('true'),
    atomFalse= Atom('false');

function builtin (name, params, body) {
	builtins[name] = {params: params, body: body};
}

builtin('def', ['Name', 'Body'], function(Name, Body, State) {
	//console.log("def/2", arguments);
	if(Name.type != 'Atom')
		throw new Error('Expected atom for function name in def/2, got: ' + inspect(Name.constructor));
	if(Body.constructor !== FunctionDefinition)
		throw new Error('Expected FunctionDefinition in def/2, got: ' + inspect(Body.constructor));

	var realName = Name.name;
	// No arity given, detect it and adjust name
	if(realName.indexOf("/") == -1) {
		// Adjust Name to include arity
		realName += '/' + Body.fn_params.length;
	}
	//console.log("Setting " + realName + " to ", Body);
	State.closure.set_immediate(realName, Body);
	return Body;
});
builtin('==', ['X', 'Y'], (X, Y) => (X == Y) ? atomTrue : atomFalse);
builtin('!=', ['X', 'Y'], (X, Y) => (X != Y) ? atomTrue : atomFalse);
builtin('>',  ['X', 'Y'], (X, Y) => (X  > Y) ? atomTrue : atomFalse);
builtin('>=', ['X', 'Y'], (X, Y) => (X >= Y) ? atomTrue : atomFalse);
builtin('<',  ['X', 'Y'], (X, Y) => (X  < Y) ? atomTrue : atomFalse);
builtin('<=', ['X', 'Y'], (X, Y) => (X <= Y) ? atomTrue : atomFalse);
builtin('!',  ['X'], (X) => {
	if(X !== undefined) {
		if(X == atomTrue)
			return atomFalse;
		else if(X == atomFalse)
			return atomTrue;
		else
			throw new Error('Unable to evaulate !Atom(' + X.name + ')');
	}
	return new LiteralValue(!X);
});
builtin('and/*', [], (Args) => {
	var val = true;
	var arg;
	if(Args.length == 0)
		return atomFalse;
	Args.rewind();
	while(val == true && (arg = Args.next())) {
		val = (arg == atomTrue);
	}
	if(val == true)
		return atomTrue;
	else
		return atomFalse;
});
builtin('or/*', [], (Args) => {
	var val = true;
	var arg;
	if(Args.length == 0)
		return atomFalse;
	Args.rewind();
	while((arg = Args.next())) {
		val = val || (arg == atomTrue);
	}
	if(val == true)
		return atomTrue;
	else
		return atomFalse;
});

builtin('assert', ['Check'], (Check) => {
	if(Check == atomFalse)
		throw new Error('Assert failed');
});
	
builtin('+/*', [], List => {
	var value = 0;
	List.forEach(N => { value += N });
	return value;
});
builtin('-/*', [], List => {
	if(List.length == 0)
		return 0;
	var it = List.iterator();
	var value = it.next();
	var n;
	while((n = it.next()) !== undefined) {
		value -= n;
	}
	return value;
});
builtin('*/*', [], List => {
	if(List.length == 0)
		return 0;
	var it = List.iterator();
	var value = it.next();
	var n;
	while((n = it.next()) !== undefined) {
		value *= n;
	}
	return value;
});
builtin('//*', [], List => {
	if(List.length == 0)
		return 0;
	var it = List.iterator();
	var value = it.next();
	var n;
	while((n = it.next()) !== undefined) {
		value /= n;
	}
	return value;
});
// Difference between ?/3 and if/3 is that if/3 will evaluate
// the opchain given as the parameters. ?/3 simply returns the
// values as they are (ie, you cannot use an OpChain, unless you
// simply want to work with it.)
builtin('?', ['Pred', 'X', 'Y'], (Pred, X, Y) => (Pred == atomTrue) ? X : Y);
// Alias to if/3
builtin('if/2', ['Test', 'Action'], (Test, Action, State) =>
	builtins['if/3'].call(this, Test, Action, new OpChain(State), State)
);
builtin('if/3', ['Test', 'Action', 'Else'], (Test, Action, Else) =>
	(Test == atomTrue) ? Action.call_immediate() : Else.call_immediate()
);
// Simply run chain
builtin('else', ['Chain'], (Chain) => Chain.call_immediate());
builtin('set', ['Name', 'Value'], (Name, Value, State) => {
	if(Name.constructor === VariableReference)
		Name = Name.ref;
	//console.log("(set/2: setting " + inspect(Name) + " to ", Value, ")");
	State.closure.set(Name, Value);
	return Name;
});
builtin('get', ['Name'], (Name, State) => {
	if(Name.constructor === VariableReference)
		Name = Name.ref;
	if(!State.closure.any_defined(Name)) {
		console.log("ERROR: Available symbols: ", State.closure.closure);
		console.log("Parent:", State.closure.parent);
		throw new Error('No symbol defined as ' + Name);
	}
	var value = State.closure.get(Name);
	if(value.constructor === Tuple && value[0] == 'ok') {
		return value[1][0];
	}
	throw new Error("Don't know how to handle: " + inspect(value));
});

// Set a variable in the local scope
builtin('var', ['Name', 'Value'], (Name, Value, State) => {
	if(Name.constructor === VariableReference)
		Name = Name.ref;
	//console.log("(set/2: setting " + inspect(Name) + " to ", Value, ")");
	State.closure.set_immediate(Name, Value);
	return Name;
});

builtin('print/*', [], (Args) => {
	// Print out all Args
	console.log.apply(console, Args);
});

builtin('list/*', [], Args => Args);

exports.setup = function(lithp) {
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
	}
};
