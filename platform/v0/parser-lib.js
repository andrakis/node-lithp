/**
 * Standard library for Parser V1, Platform V0.
 *
 * Contains native and hand-compiled functions.
 * Incorporates additional library functions.
 */

var util = require('util'),
	inspect = util.inspect;
var lithp = require(__dirname + '/../../index'),
	Lithp = lithp.Lithp,
	debug = Lithp.debug,
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
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
	}
	// TODO: import functions from lib_parser_switch
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
builtin("atom", ["Str"], Str => new LiteralValue(Atom(Str)));

builtin("tuple/*", [], function (List) {
	return new LiteralValue(newClass.apply(this, [Tuple].concat(List)));
});

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

builtin("replace", ['String', 'RegexString', 'ReplaceString'], (Str, RegexString, ReplaceString) =>
	new LiteralValue(Str.replace(RegexString, ReplaceString))
);

builtin("split", ['String', 'SplitChars'], (Str, SplitChars) =>
	new LiteralValue(Str.split(SplitChars))
);

builtin("head", ['List'], List => new LiteralValue(List.length > 0 ? List[0][0] : []));
builtin("tail", ['List'], List => new LiteralValue(List.length > 0 ? List.slice(1) : []));

builtin("ht", ['List'], List =>
	new LiteralValue(List.length == 0 ? [] : [List[0], List.slice(1)])
);

builtin("index", ['List', 'Index'], (List, Index) => new LiteralValue(List[Index]));

builtin("length", ['List'], List => new LiteralValue(List.length));

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
		// TODO: What should context be?
		// TODO: Could also transform this into a FunctionDefinitionNative
		val = Fn.apply({}, Params);
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

builtin("recurse/*", [], function(Arguments, State) {
	// Call the current function again with the given arguments.
	// We do this by calling call/* with the current State.
	// TODO: should just reset the current opchain, and set parameters
	//       to Arguments. Allows for infinite recursion.
	var args = [State.call(), Arguments, State];
	return builtins["call/*"].apply(this, args);
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

builtin('throw', ['Message'], (Message) => {
	throw new Error(Message);
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
builtin('catch', ['OpChain'], (OpChain) => {
	return OpChain.call_immediate();
});

/** Members should be a list of tuples:
 *    {atom or string::Key, any::Value}
 */
builtin('dict/*', [], Members => {
	var Dict = {};
	Members.forEach(Member => {
		if(Member.constructor !== Tuple) {
			throw new Error('dict expects a list of tuples, got' + inspect(Member));
		}
		if(Member.length != 2) {
			throw new Error('dict expects a tuple of {atom::Key, any::Value}');
		}
		var key = Member[0];
		var value = Member[1];
		if(key && key.type == 'Atom')
			value = key.name;
		if(typeof key != 'string')
			throw new Error('dict expects an atom or string for tuple initial value, got: ' + inspect(value));
		Dict[key] = value;
	});
	return Dict;
});

// These functions can be used on JavaScript objects returned from require/1.
builtin('dict-get', ['Dict', 'Name'], (Dict, Name) => Dict[Name]);
builtin('dict-set', ['Dict', 'Name', 'Value'], (Dict, Name, Value) => {
	Dict[Name] = Value;
	return Dict;
});
builtin('dict-present', ['Dict', 'Name'], (Dict, Name) =>
	(Name in Dict) ? atomTrue : atomFalse
);
builtin('dict-remove', ['Dict', 'Name'], (Dict, Name) => {
	delete Dict[Name];
	return Dict;
});
builtin('dict-keys', ['Dict'], Dict => Object.keys(Dict));

builtin('atoms', [], () => GetAtoms.map(A => A.name));

function atomBool (A) {
	return A == atomTrue ? true : false;
}

builtin('inspect/1', ['Object'], O => inspect(O));
builtin('inspect/2', ['Object', 'Deep'], (O, Deep) => inspect(O, {depth: atomBool(Deep) ? null : undefined}));
builtin('inspect/3', ['Object', 'Deep', 'Color'], (O, Deep, Color) => inspect(O, {depth: atomBool(Deep) ? null : undefined, colors: atomBool(Color)}));

// These are specific to JavaScript. This might matter in the future if the
// interpreter is ever ported, so they are prefixed.
builtin('require', ['Name'], Name => require(Name));
builtin('{}', [], () => {});
builtin('js-apply/3', ['Context', 'Function', 'ArgList'], (Ctx, F, AL) => {
	return F.apply(Ctx, AL);
});
builtin('js-typeof/1', ['Object'], O => typeof(O));
// Bridge to a JavaScript function. This returns a native JavaScript function
// that when called, invokes the given FunctionDefinition with the arguments
// given to the function. This can be used in fs.readFile for example.
builtin('js-bridge/1', ['FunctionDefinition'], function(FnDef, State) {
	return (self =>
		function() {
			var Args = Array.prototype.slice.call(arguments);
			return self.invoke_functioncall(State, FnDef, Args);
		}
	)(this);
});

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
