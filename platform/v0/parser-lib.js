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
	Tuple = types.Tuple;

/**
 * TODO:
 *       State passed into FunctionDefinitionNative callbacks should
 *       contain a reference to the Lithp object. This would allow
 *       JavaScript callbacks to run Lithp functions as normal functions.
 *       This would allow for instance, calling string.replace(RegExp, function() {
 *		     // Create a new OpChain, set its local data (ie, function parameters)
 *           // and then run: return State.lithp.run(chain)
 *       });
 */


var builtins = {};
function builtin (name, params, body) {
	builtins[name] = {params: params, body: body};
}

function builtin_def () {
}

exports.setup = function(lithp) {
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
	}
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
builtin("atom", ["Str"], Str => {
	return new LiteralValue(Atom(Str));
});

builtin("tuple/*", [], function(List) {
	return new LiteralValue(newClass(Tuple, List));
});

builtin("get-opchain-closure-current", [], State => {
	return new LiteralValue(State.closure);
});

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
	return builtin(newname, [], function() { return builtins['literal-value'].apply(this, arguments); });
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

builtin("head", ['List'], List =>
	List.length > 0 ? new LiteralValue(List[0]) : error('Invalid argument: head on empty list')
);

builtin("tail", ['List'], List =>
	List.length > 0 ? new LiteralValue(List.slice(1)) : error('Invalid argument: tail on empty list')
);

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

builtin("call/*", [], function(Args, State) {
	// Create a new OpChain with the given function, set the closure
	// variables, and return it with .call_immediate so that it takes
	// effect straight away.
	var Fn = Array.prototype.slice.call(Args, 0, 1);
	var Params = Array.prototype.slice.call(Args, 1);
	var arity = Fn.fn_name.slice(-1);
	// Params includes State, so we must remove it
	Params = Params.slice(0, Params.length - 1);
	if(Fn.constructor === FnDefinitionNative) {
		// Call native JavaScript function. Passes given arguments
		// and also pass in the current chain as the last argument
		// (just like this function gets.)
		if(arity == '*') {
			Params = [Params];
		}
		return Fn.fn_body.apply(this, Params.concat(State));
	} else if(Fn.constructor === FnDefinition) {
		var call_chain = new OpChain(State, Fn.fn_body);
		if(arity == '*') {
			Params = [Params];
		}
		// Set args in new function closure
		Fn.fn_params.forEach((Name, Index) => {
			//debug("Set '" + Name + "' to params[" + Index + "] (" + params[Index] + ")");
			// This ensures that the closure will immediately find
			// the named variable, instead of going up the stack
			// to find it (which might hold multiple variables of
			// the same name.)
			call_chain.closure.set_immediate(Name, Params[Index]);
		});
		return call_chain.call_immediate();
	}
	throw new Error("call/*: Don't know what to do with:", Fn);
});

builtin("recurse/*", [], function(Arguments, State) {
	// Call the current function again with the given arguments.
	// We do this by calling call/* with the current State (last param.)
	// TODO: incorrect
	//       OpChain needs to have a reference to the FunctionDefinition that
	//       called it, so that we can recursively call it.
	//       Actually, can use current State and use .call to get a copy of
	//       the current executing function.
	var args = [State.call()];
	args = args.concat.apply(args, Arguments);
	args.push(State);
	return builtins["call/*"].apply(this, args);
});

builtin('try', ['Call', 'Catch'], (Call, Catch, State) => {
	try {
		var value = State.lithp.run(Call.call_immediate());
		return value;
	} catch (e) {
		return Catch.call_immediate({exception: e});
	}
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
