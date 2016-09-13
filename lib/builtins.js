var builtins = {};
var util = require('util'),
    inspect = util.inspect;
var types = require('./types'),
	Atom = types.Atom,
	Tuple = types.Tuple,
	OpChain = types.OpChain,
	FunctionCall = types.FunctionCall,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	LiteralValue = types.LiteralValue,
	VariableReference = types.VariableReference;

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
	State.closure.set(realName, Body);
	return Body;
});
builtin('==', ['X', 'Y'], (X, Y) => (X == Y) ? Atom('true') : Atom('false'));
builtin('!=', ['X', 'Y'], (X, Y) => (X != Y) ? Atom('true') : Atom('false'));
builtin('>',  ['X', 'Y'], (X, Y) => (X  > Y) ? Atom('true') : Atom('false'));
builtin('>=', ['X', 'Y'], (X, Y) => (X >= Y) ? Atom('true') : Atom('false'));
builtin('<',  ['X', 'Y'], (X, Y) => (X  < Y) ? Atom('true') : Atom('false'));
builtin('<=', ['X', 'Y'], (X, Y) => (X <= Y) ? Atom('true') : Atom('false'));
builtin('!',  ['X'], (X) => {
	if(X !== undefined) {
		if(X == Atom('true'))
			return Atom('false');
		else if(X == Atom('false'))
			return Atom('true');
		else
			throw new Error('Unable to evaulate !Atom(' + X.name + ')');
	}
	return new LiteralValue(!X);
});
builtin('and/*', [], (Args) => {
	var val = true;
	while(val == true && Args.length > 0) {
		var arg = Args.shift();
		val = (arg == Atom('true'));
	}
	if(val == true)
		return Atom('true');
	else
		return Atom('false');
});
builtin('or/*', [], (Args) => {
	var val = true;
	if(Args.length == 0)
		return Atom('false');
	while(Args.length > 0) {
		var arg = Args.shift();
		val = val || (arg == Atom('true'));
	}
	if(val == true)
		return Atom('true');
	else
		return Atom('false');
});

builtin('assert', ['Check'], (Check) => {
	if(Check == Atom('false'))
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
	var i = 0;
	var value = List[i];
	while(++i <= List.length - 1) {
		value -= List[i];
	}
	return value;
});
builtin('*/*', [], List => {
	if(List.length == 0)
		return 0;
	var i = 0;
	var value = List[i];
	while(++i <= List.length - 1) {
		value *= List[i];
	}
	return value;
});
builtin('//*', [], List => {
	if(List.length == 0)
		return 0;
	var i = 0;
	var value = List[i];
	while(++i <= List.length - 1) {
		value /= List[i];
	}
	return value;
});
// Difference between ?/3 and if/3 is that if/3 will evaluate
// the opchain given as the parameters. ?/3 simply returns the
// values as they are (ie, you cannot use an OpChain, unless you
// simply want to work with it.)
builtin('?', ['Pred', 'X', 'Y'], (Pred, X, Y) => (Pred == Atom('true')) ? X : Y);
// Alias to if/3
builtin('if/2', ['Test', 'Action'], (Test, Action, State) =>
	builtins['if/3'].call(this, Test, Action, new OpChain(State), State)
);
builtin('if/3', ['Test', 'Action', 'Else'], (Test, Action, Else) =>
	(Test == Atom('true')) ? Action.call_immediate() : Else.call_immediate()
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

builtin('list/*', [], (Args) =>
	// Create a list with any given Args
	new LiteralValue(Args)
);

exports.setup = function(lithp) {
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
	}
};
