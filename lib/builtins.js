/**
 * Builtin Lithp runtime library.
 *
 * Contains a number of critical utility functions such as control flow,
 * function definition, arithmatic, and some basic IO.
 */

var util = require('util'),
    inspect = util.inspect;
var types = require('./types'),
	Atom = types.Atom,
	Tuple = types.Tuple,
	OpChain = types.OpChain,
	FunctionCall = types.FunctionCall,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	VariableReference = types.VariableReference;

var builtins = {};

// Cache these frequently used atoms
var atomTrue = Atom('true'),
    atomFalse= Atom('false'),
    atomNil  = Atom('nil');

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
	var arityIndex = realName.indexOf("/");
	if(arityIndex == -1) {
		// Adjust Name to include arity
		realName += '/' + Body.fn_params.length;
	} else {
		// Arity given, update Body arity to given count
		Body.arity = realName.slice(arityIndex + 1);
		//console.log("Setting aritity to given: " + Body.arity);
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
	return !X;
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
	if(List.length == 0)
		return 0; // TODO: Not appropriate for strings
	var it = List.iterator();
	var value = it.next();
	var n;
	while((n = it.next()) !== undefined) {
		value += n;
	}
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
	builtins['if/3'].body.call(this, Test, Action, new OpChain(State), State)
);
function getIfResult (value) {
	if(value && value.constructor == OpChain)
		return value.call_immediate();
	else
		return value;
}
builtin('if/3', ['Test', 'Action', 'Else'], (Test, Action, Else) =>
	getIfResult((Test == atomTrue) ? Action : Else)
);
// Simply run chain
builtin('else', ['Chain'], (Chain) => Chain.call_immediate());
builtin('set', ['Name', 'Value'], (Name, Value, State) => {
	if(Name.constructor === VariableReference)
		Name = Name.ref;
	//console.log("(set/2: setting " + inspect(Name) + " to ", Value, ")");
	State.closure.set(Name, Value);
	return Value;
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
	return Value;
});

builtin('print/*', [], (Args) => {
	// Print out all Args
	console.log.apply(console, Args);
	return atomNil;
});

builtin('list/*', [], Args => Args);

builtin('map', ['List', 'Callback'], function(List, Callback, State) {
	return List.map(I => {
		return this.invoke_functioncall(State, Callback, [I]);
	});
});

builtin('slice/2', ['List', 'Begin'], (List, Begin) => List.slice(Begin));
builtin('slice/3', ['List', 'Begin', 'End'], (List, Begin, End) => List.slice(Begin, End));
builtin('quote/1', ['String'], S => JSON.stringify(S));
builtin('inspect/1', ['Object'], function(O) { return this.inspect([O]); });
builtin('null', [], () => null);
builtin('undefined', [], () => undefined);
builtin('&', ['A', 'B'], (A, B) => A & B);
builtin('|', ['A', 'B'], (A, B) => A | B);
builtin('^', ['A', 'B'], (A, B) => A ^ B);
builtin('~', ['A'], A => ~A);

builtin("replace", ['String', 'RegexString', 'ReplaceString'], (Str, RegexString, ReplaceString) =>
	Str.replace(RegexString, ReplaceString)
);

builtin("regex/1", ["Regex"], (Regex) => new RegExp(Regex));
builtin("regex/2", ["Regex", "Flags"], (Regex, Flags) => new RegExp(Regex, Flags));
builtin("split", ['String', 'SplitChars'], (Str, SplitChars) => Str.split(SplitChars));

builtin("head", ['List'], List => List.length > 0 ? List[0] : []);
builtin("tail", ['List'], List => List.length > 0 ? List.slice(1) : []);

builtin("ht", ['List'], List =>
	List.length == 0 ? [] : [List[0], List.slice(1)]
);

builtin("index", ['List', 'Index'], (List, Index) => List[Index]);

builtin("length", ['List'], List => List.length);

// Non-recursive list flatten
function flatten (List) {
	var result = [];
	var nodes = List.slice();
	var node;

	if(!List.length)
		return result;
	
	node = nodes.pop();

	do {
		if(Array.isArray(node))
			nodes.push.apply(nodes, node);
		else
			result.push(node);
	} while (nodes.length && (node = nodes.pop()) !== undefined);

	result.reverse();

	return result;
}

builtin("flatten/*", [], List => flatten(List));

// Call a function. This can be a JavaScript function, or one of the standard
// Lithp FunctionDefinition or FunctionDefinitionNative classes.
builtin("call/*", [], function(Args, State) {
	// Create a new OpChain with the given function, set the closure
	// variables, and return it with .call_immediate so that it takes
	// effect straight away.
	var Fn = Args.slice(0, 1);
	var Params = Args.slice(1);
	if(Fn.length == 0)
		throw new Error('call/*: Unable to get function from args');
	Fn = Fn[0];

	var val;
	if(typeof Fn == 'function') {
		// TODO: Could also transform this into a FunctionDefinitionNative
		// Pass along (this) to native functoin.
		val = Fn.apply(this, Params);
	} else {
		val = this.invoke_functioncall(State, Fn, Params);
	}
	//console.log("call/* result:", val);
	return val;
});

builtin("scope", ['FnDef'], (FnDef, State) => {
	// TODO: This is somewhat ugly and is implemented in the interpreter.
	//       It would be nice if this did not require changes to the
	//       interpreter.
	var newFnDef = FnDef.clone();
	newFnDef.scoped = State;
	//console.log("Scope, new scope is:", State.closure.getDefined(3));
	return newFnDef;
});

builtin('try', ['Call', 'Catch'], function(Call, Catch, State) {
	try {
		// this refers to the running Lithp object
		var value = this.run(Call.call_immediate());
		return value;
	} catch (e) {
		// Set Exception in the closure to the exception value e
		return Catch.call_immediate({Exception: e});
	}
});
builtin('catch', ['OpChain'], (OpChain) => {
	return OpChain.call_immediate();
});
builtin('throw', ['Message'], (Message) => {
	throw new Error(Message);
});

builtin('to-string', ['String'], S => S.toString());

var definitionDict = '__definition_dict';
function getTopLevel (Chain) { return Chain.closure.getTopOwner(); };
function getDefinitionDict (Chain) {
	var toplevel = getTopLevel(Chain);
	var dict;
	if(!toplevel.defined(definitionDict)) {
		dict = {};
		dict[definitionDict] = true;
		dict = toplevel.set_immediate(definitionDict, dict);
	} else {
		// Return value is Tuple {ok, Tuple { value, closure_value_is_in }}
		var result = toplevel.get(definitionDict);
		if(result.constructor === Tuple && result[0] == 'ok') {
			dict = result[1][0];
		} else {
			throw new Error("Runtime error: failed to get definition dictionary.");
		}
	}
	if(!dict[definitionDict])
		throw new Error("Runtime error: definition dict not valid: ", dict);
	return dict;
}

builtin('define', ['Name', 'Value'], function(Name, Value, State) {
	var dict = getDefinitionDict.call(this, State);
	dict[Name] = Value;
	return Value;
});

builtin('undefine', ['Name'], function (Name, State) {
	var dict = getDefinitionDict.call(this, State);
	var old = dict[Name];
	delete dict[Name];
	return old;
});

builtin('defined', ['Name'], function (Name, State) {
	return Name in getDefinitionDict.call(this, State) ? atomTrue : atomFalse;
});

builtin('get-def', ['Name'], function (Name, State) {
	var dict = getDefinitionDict.call(this, State);
	if(!(Name in dict))
		throw new Error("Runtime error: " + Name + " is not currently defined.");
	return dict[Name];
});

builtin('definitions', [], function (State) { return getDefinitionDict.call(this, State); });

builtin('platform', ['Name'], function (Name, State) {
	if(Name && Name.type == 'Atom')
		Name = Name.name;
	switch(Name.toLowerCase()) {
		case "v1":
			var count = (require('../platform/v1/parser-lib')).setup(this);
			this.debug("PlatformV1 library loaded " + count + " symbols");
			// Re-import new functions
			State.importClosure(this.functions);
			break;
		default:
			throw new Error("Error: Platform " + Name + " not known.");
			break;
	}
});

exports.setup = function(lithp) {
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
	}
};
