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
		throw new Error('Expected atom for function name in def/2, got', Name.constructor);
	if(Body.constructor !== FunctionDefinition)
		throw new Error('Expected FunctionDefinition in def/2, got', Body.constructor);
	// Adjust Name to include arity
	var realName = Name.name += '/' + Body.fn_params.length;
	//console.log("Setting " + realName + " to ", Body);
	State.closure.set(realName, Body);
	return Body;
});
builtin('==', ['X', 'Y'], function(X, Y) { return (X == Y) ? Atom('true') : Atom('false'); });
builtin('!=', ['X', 'Y'], function(X, Y) { return (X != Y) ? Atom('true') : Atom('false'); });
builtin('>', ['X', 'Y'], function(X, Y) { return (X > Y) ? Atom('true') : Atom('false'); });
builtin('>=', ['X', 'Y'], function(X, Y) { return (X >= Y) ? Atom('true') : Atom('false'); });
builtin('<', ['X', 'Y'], function(X, Y) { return (X < Y) ? Atom('true') : Atom('false'); });
builtin('<=', ['X', 'Y'], function(X, Y) { return (X <= Y) ? Atom('true') : Atom('false'); });
builtin('!', ['X'], function(X) {
	if(X !== undefined) {
		if(X.type == 'Atom') {
			if(X.name == 'true')
				return Atom('false');
			else if(X.name == 'false')
				return Atom('true');
			else
				throw new Error('Unable to evaulate !Atom(' + X.name + ')');
		}
	}
	return new LiteralValue(!X);
});
	
builtin('+', ['X', 'Y'], function(X, Y) { return (X + Y); });
builtin('-', ['X', 'Y'], function(X, Y) { return (X - Y); });
builtin('*', ['X', 'Y'], function(X, Y) { return (X * Y); });
builtin('/', ['X', 'Y'], function(X, Y) { return (X / Y); });
builtin('?', ['Pred', 'X', 'Y'], function(Pred, X, Y) {
	if(Pred.name == 'true')
		return X;
	else
		return Y;
});
builtin('if', ['Test', 'Action'], function(Test, Action) {
	// Alias to if/3
	return new FunctionCall('if/3', [Test, Action, new OpChain()]);
});
builtin('if', ['Test', 'Action', 'Else'], function(Test, Action, Else) {
	if(Test.name == 'true')
		return Action.call_immediate();
	else
		return Else.call_immediate();
});
builtin('else', ['Chain'], function(Chain) {
	// Simply run chain
	return Chain.call_immediate();
});
builtin('set', ['Name', 'Value'], function(Name, Value, State) {
	if(Name.constructor === VariableReference)
		Name = Name.ref;
	//console.log("(set/2: setting " + inspect(Name) + " to ", Value, ")");
	State.closure.set(Name, Value);
	return Name;
});
builtin('get', ['Name'], function(Name, State) {
	if(Name.constructor === VariableReference)
		Name = Name.ref;
	if(!State.closure.any_defined(Name)) {
		console.log("ERROR: Available symbols: ", State.closure.closure);
		console.log("Parent:", State.closure.parent);
		throw new Error('No symbol defined as ' + Name);
	}
	var value = State.closure.get(Name);
	if(value.constructor === Tuple && value.get(0) == 'ok') {
		return value.get(1).get(0);
	}
	throw new Error("Don't know how to handle:", value);
});
builtin('print/*', [], function() {
	// Print out all but last arg (OpChain state)
	console.log.apply(console, Array.prototype.slice.call(arguments, 0, -1));
});

builtin('list/*', [], function() {
	// Create a list with any given arguments (ignore last, OpChain state)
	return new LiteralValue(Array.prototype.slice.call(arguments, 0, -1));
});

exports.setup = function(lithp) {
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
	}
};
