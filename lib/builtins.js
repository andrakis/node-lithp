/**
 * Builtin Lithp runtime library.
 *
 * Contains a number of critical utility functions such as control flow,
 * function definition, arithmatic, and some basic IO.
 */

"use strict";

var util = require('util'),
    inspect = util.inspect,
	path = require('path'),
	fs = require('fs');
var types = require('./types'),
	Atom = types.Atom,
	Tuple = types.Tuple,
	OpChain = types.OpChain,
	FunctionCall = types.FunctionCall,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	VariableReference = types.VariableReference,
	LiteralValue = types.LiteralValue;

// Note: import/1 currently uses the Bootstrap parser, Platform V0.
var BootstrapParser = require('../platform/v0/parser').BootstrapParser;

var builtins = {};

// Cache these frequently used atoms
var atomTrue   = Atom('true'),
    atomFalse  = Atom('false'),
    atomNil    = Atom('nil'),
    atomMissing= Atom('missing'),
    atomNumber = Atom('number'),
    atomString = Atom('string'),
    atomList   = Atom('list'),
    atomOpChain= Atom('opchain'),
    atomFunction=Atom('function'),
    atomTuple  = Atom('tuple'),
    atomAtom   = Atom('atom'),
    atomDict   = Atom('dict'),
    atomObject = Atom('object');

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
	Body.readable_name = Name.name;
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
	var it = Args.iterator();
	it.rewind();
	while(val == true && (arg = it.next())) {
		val = (arg == atomTrue);
	}
	if(val == true)
		return atomTrue;
	else
		return atomFalse;
});
builtin('or/*', [], (Args) => {
	var val = false;
	var arg;
	if(Args.length == 0)
		return atomFalse;
	var it = Args.iterator();
	it.rewind();
	while((arg = it.next())) {
		val = (arg == atomTrue) || val;
	}
	if(val == true)
		return atomTrue;
	else
		return atomFalse;
});

// Add two or more lists together.
// Throws error if no lists given.
// Returns first given list if length is 1.
builtin('++/*', [], List => {
	if(List.length == 0)
		throw new Error('++/* requires at least one list');
	var it = List.iterator();
	var value = it.next();
	var n;
	while((n = it.next()) !== undefined) {
		value = value.concat(n);
	}
	return value;
});
// Add items together. Uses JavaScript + operator, so supports many different
// types of objects.
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
	if(List.length == 1)
		return -value;
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
builtin('while/2', ['Test', 'Action'], function (Test, Action, State) {
	Test.parent = State;
	Test.closure.parent = State.closure;
	Action.parent = State;
	Action.closure.parent = State.closure;
	Test.rewind();
	Action.rewind();
	while(this.run(Test) == atomTrue) {
		Test.rewind();
		Action.rewind();
		this.run(Action);
	}
});
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
	if(Name.type == 'Atom')
		Name = Name.name;
	var value = State.closure.get_or_missing(Name);
	if(value == atomMissing) {
		if(!State.closure.any_defined(Name)) {
			//console.log("ERROR: Available symbols: ", State.closure.closure);
			//console.log("Parent:", State.closure.parent);
			throw new Error('No symbol defined as ' + Name);
		}
	}
	return value;
});

// Set a variable in the local scope
builtin('var', ['Name', 'Value'], (Name, Value, State) => {
	if(Name.constructor === VariableReference)
		Name = Name.ref;
	//console.log("(set/2: setting " + inspect(Name) + " to ", Value, ")");
	State.closure.set_immediate(Name, Value);
	return Value;
});

builtin('print/*', [], function(Args) {
	// Print out all Args after inspecting
	console.log.apply(console, Args.map(O => {
		if(typeof O == "string")
			return O;
		return this.inspect_object([O], undefined, 0);
	}));
	return atomNil;
});

builtin('list/*', [], Args => Args);

builtin('map', ['List', 'Callback'], function(List, Callback, State) {
	return List.map(I => {
		return this.invoke_functioncall(State, Callback, [I]);
	});
});

builtin('slice/1', ['List'], List => List.slice());
builtin('slice/2', ['List', 'Begin'], (List, Begin) => List.slice(Begin));
builtin('slice/3', ['List', 'Begin', 'End'], (List, Begin, End) => List.slice(Begin, End));
builtin('quote/1', ['String'], S => JSON.stringify(S));
builtin('inspect/1', ['Object'], function(O) { return this.inspect_object([O], undefined, 0); });
builtin('inspect/2', ['Object', 'FullDepth'], (O, Full) =>
	inspect(O, Full == atomTrue ? {depth:null} : {}));
builtin('null', [], () => null);
builtin('undefined', [], () => undefined);
builtin('@', ['A', 'B'], (A, B) => A % B);
builtin('&', ['A', 'B'], (A, B) => A & B);
builtin('|', ['A', 'B'], (A, B) => A | B);
builtin('^', ['A', 'B'], (A, B) => A ^ B);
builtin('~', ['A'], A => ~A);
builtin('<<', ['A', 'B'], (A, B) => (A << B) >>> 0);
builtin('<<<', ['A', 'B'], (A, B) => A << B);
builtin('>>', ['A', 'B'], (A, B) => (A >> B) >>> 0);
builtin('>>>', ['A', 'B'], (A, B) => A >> B);
builtin('nl', [], () => String.fromCharCode(10)); // new line

builtin("match", ['String', 'RegexString'], (Str, RegexString) => Str.match(RegexString));
builtin("replace", ['String', 'RegexString', 'ReplaceStringOrFunction'], (Str, RegexString, ReplaceString) =>
	Str.replace(RegexString, ReplaceString)
);
builtin("test", ['Regex', 'String'], (Regex, Str) => Regex.test(Str));

builtin("regex/1", ["Regex"], (Regex) => new RegExp(Regex));
builtin("regex/2", ["Regex", "Flags"], (Regex, Flags) => new RegExp(Regex, Flags));
builtin("split", ['String', 'SplitChars'], (Str, SplitChars) => Str.split(SplitChars));
builtin("repeat", ['String', 'Count'], (Str, Count) => Str.repeat(Count));
builtin("join", ['List', 'JoinChar'], (List, JoinChar) => List.join(JoinChar));

builtin("head", ['List'], List => List.length > 0 ? List[0] : []);
builtin("tail", ['List'], List => List.length > 0 ? List.slice(1) : []);

builtin("ht", ['List'], List =>
	List.length == 0 ? [] : [List[0], List.slice(1)]
);

builtin("index", ['List', 'Index'], (List, Index) => List[Index]);

builtin("length", ['List'], List => List.length);

builtin("rand/0", [], () => Math.random());
builtin("rand/1", ['Start'], Start => Math.random(Start));
builtin("rand/2", ['Start', 'End'], (Start, End) => Math.random(Start, End));

builtin("exit/0", [], () => process.exit());
builtin("exit/1", ['Code'], Code => process.exit(Code));
builtin("env", [], () => process.env);
builtin("argv", [], () => process.argv);
builtin("cwd", [], () => process.cwd);

builtin('is-finite', ['N'], N => isFinite(N));
builtin('is-nan', ['N'], N => isNaN(N));
builtin('nan', [], () => NaN);
builtin('parse-float', ['Str'], Str => parseFloat(Str));
builtin('parse-int', ['Str'], Str => parseInt(Str));
builtin('typeof', ['V'], V => {
	if(V)
		switch(V.constructor) {
			case Number:
				return atomNumber;
			case String:
				return atomString;
			case Array:
				return atomList;
			case OpChain:
				return atomOpChain;
			case FunctionDefinition:
				return atomFunction;
			case LiteralValue:
				return inbuilt({} /* fake context */, 'typeof', [V.value]);
			case Tuple:
				return atomTuple;
			default:
				if(V.type == 'Atom')
					return atomAtom;
				else if(Array.isArray(V))
					return atomList;
				else if(V[LITHP_DICT])
					return atomDict;
				return atomObject;
		}
	return Atom(typeof V);
});
builtin('function-arity', ['Function'], function(Fun) {
	if(Fun && Fun.constructor === FunctionDefinition)
		return Fun.arity;
	throw new Error('Given object is not a function definition: ' + inspect(Fun));
});
builtin('trim', ['S'], S => S.trim());
builtin('floor', ['N'], N => Math.floor(N));
builtin('ceil', ['N'], N => Math.ceil(N));

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
		if (Fn.type == 'Atom')
			Fn = Fn.name;
		if (typeof Fn == 'string') {
			var fndef = State.closure.get_or_missing(Fn);
			if(fndef == atomMissing) {
				fndef = State.closure.get_or_missing(Fn + "/*");
				if(fndef == atomMissing) {
					throw new Error("Failed to find target: " + Fn);
				}
				Fn = fndef;
			}
		}
		val = this.invoke_functioncall(State, Fn, Params);
	}
	//console.log("call/* result:", val);
	return val;
});

builtin("apply/*", [], function(Args, State) {
	var Fn = Args.slice(0, 1)[0];
	var Params = Args.slice(1)[0];
	return builtins["call/*"].body.call(this, [Fn].concat(Params), State);
});

builtin("scope", ['FnDef'], (FnDef, State) => {
	// TODO: This is somewhat ugly and is implemented in the interpreter.
	//       It would be nice if this did not require changes to the
	//       interpreter.
	try {
		var newFnDef = FnDef.clone();
		newFnDef.scoped = State;
		//console.log("Scope, new scope is:", State.closure.getDefined(3));
		return newFnDef;
	} catch (e) {
		console.error("Was given: ", FnDef);
		throw e;
	}
});

builtin('try', ['Call', 'Catch'], function(Call, Catch, State) {
	Call.parent = State;
	Call.closure.parent = State.closure;
	Call.rewind();
	try {
		// this refers to the running Lithp object
		var value = this.run(Call);
		return value;
	} catch (e) {
		// Set Exception in the closure to the exception value e
		return this.invoke_functioncall(State, Catch, [e]);
	}
});
builtin('catch', ['OpChain'], (OpChain) => {
	return OpChain;
});
builtin('throw', ['Message'], (Message) => {
	throw new Error(Message);
});

// String Format
builtin('to-string/*', ['Args'], Args => {
	var S = Args[0];
	return S.toString.apply(S, Args.slice(1));
});

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
		return Atom('false');
	return dict[Name];
});

builtin('definitions', [], function (State) { return getDefinitionDict.call(this, State); });

builtin('platform', ['Name'], function (Name, State) {
	var count;
	if(Name && Name.type == 'Atom')
		Name = Name.name;
	switch(Name.toLowerCase()) {
		case "v1":
			count = (require('../platform/v1/parser-lib')).setup(this);
			this.debug("PlatformV1 library loaded " + count + " symbols");
			// Re-import new functions
			State.importClosure(this.functions);
			break;
		default:
			var fullPath = path.resolve(Name + "/index.js");
			if(fs.existsSync(fullPath)) {
				// Import an extension
				count = (require(fullPath)).setup(this);
				this.debug("Extension library " + Name + " loaded " + count + " symbols");
				State.importClosure(this.functions);
				break;
			}
			throw new Error("Error: Platform " + Name + " not known.");
			break;
	}
});

var export_destinations = [];
builtin('export/*', ['Names'], function (Names, State) {
	if(export_destinations.length == 0) {
		export_destinations = [[this, State]];
	}
	// Get current destination
	var destination = export_destinations[export_destinations.length - 1];
	var dest_lithp = destination[0];
	var dest_chain = destination[1];
	var top_chain  = dest_chain.getTopParent();
	var fndefs = exportFunctions.call(this, Names, State, top_chain);
	this.debug("Exporting: [" + Object.keys(fndefs).join(', ') + "] from Lithp[" + this.id + "] to Lithp[" + dest_lithp.id + "]");
	top_chain.importClosure(fndefs);
});

builtin('export-global/*', ['Names'], function (Names, State) {
	if(export_destinations.length == 0) {
		export_destinations = [[this, State]];
	}
	// Current destination only used in call to exportFunction
	var destination = export_destinations[export_destinations.length - 1];
	var dest_lithp = destination[0];
	var dest_chain = destination[1];
	var top_chain  = dest_chain.getTopParent();
	var fndefs = exportFunctions.call(this, Names, State, top_chain);
	// Export to all other Lithp instances
	var instances = global.get_lithp_instances();
	for(var id in instances) {
		dest_lithp = instances[id];
		dest_chain = instances[id].last_chain;
		top_chain  = dest_chain.getTopParent();
		this.debug("Exporting: [" + Object.keys(fndefs).join(', ') + "] from Lithp[" + this.id + "] to Lithp[" + dest_lithp.id + "]");
		top_chain.importClosure(fndefs);
	}
});

function exportFunctions (Names, State, top_chain) {
	this.debug("Exporting: [" + Names.map(N => N.toString()).join(', ') + ']');
	var dest = {};
	Names.map(Name => {
		var result = State.closure.get(Name.toString());
		if(result.constructor === Tuple && result[0] == 'ok') {
			this.debug("Exporting " + Name + " from OpChain[" + State.id + "] to OpChain[" + top_chain.id + "]");
			var fndef_named_function = result[1][0];
			// Create a new FunctionDefinitionNative that calls this interpreter to
			// run the OpChain.
			// Note that 'this' still refers to the current interpreter.
			var instance = this;
			var fndef_bridge = new FunctionDefinitionNative(
				fndef_named_function.fn_name,
				fndef_named_function.fn_params,
				function() {
					// Remove State from given arguments
					var Params = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
					var val = instance.invoke_functioncall(State, fndef_named_function, Params);
					//instance.debug(" imported function call result: " + val);
					return val;
				}
			);
			dest[Name] = fndef_bridge;
		} else {
			console.log("ERROR: Available symbols: ", State.closure.closure);
			throw new Error("Export: failed to find " + Name.toString() + " to export.");
		}
	});
	return dest;
}

function findModule (name, State) {
	var search_paths = this.Defined(State, "_module_search_path") || [];
	var it = search_paths.iterator();
	var extensions = [''];
	if(this.Defined(State, "__AST__")) {
		extensions.push('.ast');
	}
	extensions.push('.lithp');
	var ext_it = extensions.iterator();

	var search;
	var extension;

	this.debug(" Find module: " + name);

	it.rewind();
	while((search = it.next()) || search !== undefined) {
		ext_it.rewind();
		while((extension = ext_it.next()) || extension !== undefined) {
			var search_name = path.join(search, name + extension);
			this.debug("  Checking " + search_name);
			if(global._lithp.browserify) {
				if(search_name in global._lithp.fileCache)
					return search_name;
			} else {
				if(fs.existsSync(search_name) && fs.lstatSync(search_name).isFile()) {
					this.debug(" Using " + search_name);
					return search_name;
				}
			}
		}
	}

	return name;
}

builtin('import', ['Path'], function (Path, State) {
	var importTable = this.Defined(State, "_modules_imported");
	this.debug("Attempt to import: " + Path);
	Path = findModule.call(this, Path, State);
	if(Path in importTable) {
		this.debug("Skipping already imported module");
		return;
	}

	if(!global._lithp.browserify && !fs.existsSync(Path))
		throw new Error("import: could not find file " + Path);
	
	importTable.push(Path);
	var instance = this;
	var code;
	if(global._lithp.browserify)
		code = global._lithp.fileCache[Path];
	else
		code = fs.readFileSync(Path).toString();
	var opts = {
		finalize: true,
		ast: null != Path.match(/.ast$/)
	}
	var timed = timeCall("Parse code", () => BootstrapParser(code, opts));
	var parsed = timed[0];
	parsed.parent = State;
	parsed.closure.parent = State.closure;
	if(this.Defined(State, "__AST__")) {
		this.Define(parsed, "__AST__", atomTrue);
	}
	this.debug("  module parsed in " + timed[1] + "ms");
	timeCall("Run module", () => {
		export_destinations.push([this, State]);
		instance.run(parsed)
		export_destinations.pop();
	});
	this.debug("  module run and exported to current instance in " + timed[1] + "ms");
	return atomNil;
});

builtin('import-instance', ['Path'], function (Path, State) {
	this.debug("Attempt to import: " + Path);
	Path = findModule.call(this, Path, State);
	if(!fs.existsSync(Path))
		throw new Error("import: could not find file " + Path);
	
	// We use a new instance of Lithp to run the module.
	// This gives it its own completely private set of definitions and functions.
	// When export is called, it will fill the function table with functions that
	// are owned by a different Lithp instance that could be doing its own thing
	// on callbacks.
	var instance = new Lithp();
	var code = fs.readFileSync(Path).toString();
	var timed = timeCall("Parse code", () => BootstrapParser(code, Path));
	var result;
	var parsed = timed[0];
	this.debug("  module parsed in " + timed[1] + "ms");
	timeCall("Run module", () => {
		instance.setupDefinitions(parsed, Path);
		export_destinations.push([this, State]);
		instance.run(parsed)
		export_destinations.pop();
	});
	this.debug("  module run and exported to current instance in " + timed[1] + "ms");
	return result;
});

builtin('eval/1', ['Code'], function(Code, State) {
	return builtins['eval/*'].body.call(this, [Code], State);
});
builtin("eval/*", ['CodeAndParams'], function(Args, State) {
	var code = Args.slice(0, 1)[0];
	var args = Args.slice(1);
	this.debug(" Parse: " + code);
	var compiled = BootstrapParser(code);
	//var instance = new Lithp();
	//this.setupDefinitions(compiled, "[evaluated code]");
	compiled.parent = State;
	compiled.closure.parent = State.closure;
	if(args.length > 0) {
		for(var i = 0; i < args.length; i++) {
			var arg = args[i];
			this.debug(" Defining " + arg[0] + " = ", arg[1]);
			compiled.closure.set_immediate(arg[0], arg[1]);
		}
	}
	return this.run(compiled);
});

builtin('atom', ['Name'], Name => Atom(Name));
// Invoke a JavaScript function using apply.
builtin('invoke/*', [], Args => {
	if(Args.length < 2)
		throw new Error("Invoke requires object and function name at least");
	var Obj = Args[0];
	var FnName = Args[1];
	var Params = Args.slice(2);
	if(!Obj[FnName])
		throw new Error("Invoke attempted, but " + FnName + " does not exist in: " + inspect(Obj));
	if(typeof Obj[FnName] != 'function')
		throw new Error("Invoke attempted, but " + FnName + " does not refer to a function: " + typeof(Obj[FnName]));
	return Obj[FnName].apply(Obj, Params);
});

builtin('abs', ['N'], N => Math.abs(N));
builtin('pi', [], () => Math.PI);
builtin('sqrt', ['N'], N => Math.sqrt(N));

builtin('chr', ['N'], N => String.fromCharCode(N));
builtin('asc', ['Str'], Str => Str.charCodeAt(0));

// Used to instantiate classes when the number of parameters it not
// known. Uses apply to instantiate (which is a little trickier than
// usual.)
function newClass (Cls) {
	// Function.bind.apply's first argument is ignored. Thus, it doesn't
	// matter that it's included in arguments.
	return new (Function.bind.apply(Cls, arguments));
}

builtin("tuple/*", [], function (List) {
	return newClass.apply(this, [Tuple].concat(List));
});

var LITHP_DICT = "__lithp_is_lithp_dict";
/** Members should be a list of tuples:
 *    {atom or string::Key, any::Value}
 */
builtin('dict/*', [], Members => {
	var Dict = {};
	Object.defineProperty(Dict, LITHP_DICT, {
		enumerable: false,
		writable: true
	});
	Dict[LITHP_DICT] = true;
	Object.defineProperty(Dict, LITHP_DICT, {
		writable: false
	});
	Members.forEach(Member => {
		if(Member.constructor === LiteralValue)
			Member = Member.value;
		if(Member.constructor !== Tuple) {
			throw new Error('dict expects a list of tuples, got' + inspect(Member));
		}
		if(Member.length != 2) {
			throw new Error('dict expects a tuple of {atom::Key, any::Value}');
		}
		var key = Member[0];
		var value = Member[1];
		if(key && key.type == 'Atom')
			key = key.name;
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

builtin('true', [], () => true);
builtin('false', [], () => false);

builtin('add-search-path', ['Path'], function(Path, State) {
	var search = this.Defined(State, "_module_search_path");
	search.push(Path);
	return search;
});

builtin('host', [], () => "Node.js");
builtin('host-version', [], () => global._lithp.version);

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

builtin('recurse/*', ['Args'], function(Params, State) {
	// Find current target
	var Target = State.parent;
	while(Target && !Target.function_entry) {
		Target = Target.parent;
	}
	if(Target == null) {
		throw new Error('Failed to find current entry to ' + Fn);
	}
	// Rewind it to the start
	Target.rewind();

	// Get the OpChain function name with arity.
	var Fn = Target.function_entry;
	var FnAndArity = Fn + "/" + Params.length;
	var fndef = Target.closure.get_or_missing(FnAndArity);

	if(fndef == atomMissing) {
		// Check for a function with any arity assigned (*)
		FnAndArity = FnAndArity.replace(/\d+$/, '*');
		fndef = Target.closure.get_or_missing(FnAndArity);
		if(fndef == atomMissing) {
			throw new Error('Error, unknown function: ' + Fn + "/" + Params.length);
		}
	}

	// Set parameters for given function
	fndef.fn_params.forEach((Name, Index) => {
		//lithp_debug("Set '" + Name + "' to params[" + Index + "] (" + params[Index] + ")");
		// This ensures that the closure will immediately find
		// the named variable, instead of going up the stack
		// to find it (which might hold multiple variables of
		// the same name.)
		Target.closure.set_immediate(Name, Params[Index]);
	});

	// We return nothing. It's up to the given function to eventually stop recursion
	// and return a value.
});

function inbuilt (self, name, args, State) {
	return builtins[name].body.apply(self, args);
}

builtin('recurse-from/*', ['Args'], function(Args, State) {
	var From = inbuilt(this, 'head', [Args]);
	var Tail = inbuilt(this, 'tail', [Args]);
	var Fn   = inbuilt(this, 'head', [Tail]);
	var Params = inbuilt(this, 'tail', [Tail]);

	// Find target
	var Target = State.parent;
	while(Target && Target.function_entry != Fn) {
		Target = Target.parent;
	}
	if(Target == null) {
		throw new Error('Failed to find current entry to ' + Fn);
	}
	// Rewind it to the start
	Target.rewind();

	// Get the given function name with arity.
	var FnAndArity = Fn + "/" + Params.length;
	var fndef = Target.closure.get_or_missing(FnAndArity);

	if(fndef == atomMissing) {
		// Check for a function with any arity assigned (*)
		FnAndArity = FnAndArity.replace(/\d+$/, '*');
		fndef = Target.closure.get_or_missing(FnAndArity);
		if(fndef == atomMissing) {
			throw new Error('Error, unknown function: ' + Fn + "/" + Params.length);
		}
	}

	// Set parameters for given function
	fndef.fn_params.forEach((Name, Index) => {
		//lithp_debug("Set '" + Name + "' to params[" + Index + "] (" + params[Index] + ")");
		// This ensures that the closure will immediately find
		// the named variable, instead of going up the stack
		// to find it (which might hold multiple variables of
		// the same name.)
		Target.closure.set_immediate(Name, Params[Index]);
	});

	// We return nothing. It's up to the given function to eventually stop recursion
	// and return a value.
});

builtin('next/*', ['Args'], function(Args, State) {
	var Fn   = inbuilt(this, 'head', [Args]);
	var Params = inbuilt(this, 'tail', [Args]);

	// Find target - last function entry
	var Target = State.parent;
	while(Target && !Target.function_entry) {
		Target = Target.parent;
	}
	if(Target == null) {
		throw new Error('Failed to find last function entry');
	}

	// Get the given function name with arity.
	var FnAndArity = Fn + "/" + Params.length;
	var fndef = Target.closure.get_or_missing(FnAndArity);

	if(fndef == atomMissing) {
		// Check for a function with any arity assigned (*)
		FnAndArity = FnAndArity.replace(/\d+$/, '*');
		fndef = Target.closure.get_or_missing(FnAndArity);
		if(fndef == atomMissing) {
			throw new Error('Error, unknown function: ' + Fn + "/" + Params.length);
		}
	}

	Target.replaceWith(fndef);

	// Set parameters for given function
	fndef.fn_params.forEach((Name, Index) => {
		//lithp_debug("Set '" + Name + "' to params[" + Index + "] (" + params[Index] + ")");
		// This ensures that the closure will immediately find
		// the named variable, instead of going up the stack
		// to find it (which might hold multiple variables of
		// the same name.)
		Target.closure.set_immediate(Name, Params[Index]);
	});

	// We return nothing. It's up to the given function to eventually stop recursion
	// and return a value.
});

var lithp;
builtin('lithp-debug', ['Bool'], Bool =>
	lithp.set_debug_flag(Bool === Atom('true'))
);

// Moved to inbuilt function for speed reasons
builtin('flat-map', ['List', 'Callback'], function(List, Callback, State) {
	return Array.prototype.concat.apply([], List.map(E => this.invoke_functioncall(State, Callback, [E])));
});

builtin('opchain-rewind', ['OpChain'], (Chain) => {
	if(Chain && Chain.constructor == OpChain) {
		Chain.rewind();
		return atomNil;
	}
	throw new Error("Given value is not an opchain: " + Chain.constructor);
});

builtin('run', ['OpChain'], function(Chain) {
	if(Chain && Chain.constructor == OpChain) {
		Chain.rewind();
		return this.run(Chain);
	}
	throw new Error("Given value is not an opchain: " + Chain.constructor);
});

builtin('math-object', [], () => Math);

exports.setup = function(lithp) {
	for(var k in builtins) {
		lithp.builtin(k, builtins[k].params, builtins[k].body);
	}
};

// Lazy load
lithp = require('./..');
