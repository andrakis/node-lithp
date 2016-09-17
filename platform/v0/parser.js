/**
 * Parser V1, Platform V0.
 *
 * Very simple Lithp parser.
 */

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

var EX_LITERAL = 1 << 0,
    EX_OPCHAIN = 1 << 1,
    EX_FUNCTIONCALL = 1 << 2,
    EX_NUMBER  = 1 << 3,             // Collect number (whole or float: [0-9.]+f?$)
    EX_ATOM    = 1 << 4,             // Collect atom
    EX_VARIABLE= 1 << 5,
    EX_STRING_CHARACTER  = 1 << 6,   // Collect character
    EX_STRING_SINGLE = 1 << 7,   // Expecting a single quote to end '
    EX_STRING_DOUBLE = 1 << 8,   // Expecting a double quote to end "
    EX_PARAM_SEPARATOR   = 1 << 9,   // Expecting a space
    EX_CALL_END          = 1 << 10,  // Expected a ), end of call
    EX_OPCHAIN_END       = 1 << 11,  // Expect a ), end of opchain
    EX_COMMENT           = 1 << 12,
    EX_COMPILED          = 1 << 13; // Already compiled

var EX_TABLE = {
	EX_LITERAL: EX_LITERAL,
	EX_OPCHAIN: EX_OPCHAIN,
	EX_FUNCTIONCALL: EX_FUNCTIONCALL,
	EX_NUMBER: EX_NUMBER,
	EX_ATOM: EX_ATOM,
	EX_VARIABLE: EX_VARIABLE,
	EX_STRING_CHARACTER: EX_STRING_CHARACTER, 
	EX_STRING_SINGLE: EX_STRING_SINGLE,
	EX_STRING_DOUBLE: EX_STRING_DOUBLE,
	EX_PARAM_SEPARATOR: EX_PARAM_SEPARATOR,
	EX_CALL_END: EX_CALL_END,
	EX_OPCHAIN_END: EX_OPCHAIN_END,
	EX_COMMENT: EX_COMMENT,
	EX_COMPILED: EX_COMPILED
};

function GET_EX (n) {
	var parts = [];
	for(var k in EX_TABLE)
		if(EX_TABLE[k] & n)
			parts.push(k);
	return parts.join(' | ');
	throw new Error("Expected value not known: " + n);
}

function ParserState (parent) {
	this.chains = [new OpChain(parent)];
	this.chains_it = this.chains.iterator();
	this.expect = [EX_OPCHAIN];
	this.expect_it = this.expect.iterator();
	this.current = [''];
	this.current_it = this.current.iterator();
	this.parts = [];
	this.parts_it = this.parts.iterator();
	this.parts_pending = [];
	this.parts_pending_it = this.parts_pending.iterator();
}

ParserState.prototype.opchain_current = function() { return this.chains_it.get(); };
ParserState.prototype.opchain_push = function() {
	if(arguments.length > 0)
		throw new Error('Do not give any paramters');
	var chain = new OpChain(this.opchain_current());
	this.chains_it.push(chain);
};

ParserState.prototype.expect_current = function() { return this.expect_it.get(); };
ParserState.prototype.expect_push = function(val) {
	if(arguments.length == 0)
		throw new Error('Please provide the expect classes');
	this.expect_it.push(val);
};
ParserState.prototype.expect_set = function(val) {
	this.expect_it.set_current(val);
};

ParserState.prototype.current_current = function() {
	return this.current_it.get();
};
ParserState.prototype.current_push = function() {
	if(arguments.length > 0)
		throw new Error('Do not give any parameters');
	return this.current_it.push('');
};

ParserState.prototype.current_pop = function() {
	if(arguments.length > 0)
		throw new Error('Do not give any parameters');
	return this.current_it.pop();
};

ParserState.prototype.current_set = function(current) {
	this.current_it.set_current(current);
	return this.current_it.get();
};

ParserState.prototype.current_append = function(ch) {
	return this.current_set(this.current_it.get() + ch);
};

ParserState.prototype.parts_push = function(p) {
	if(arguments.length == 0)
		throw new Error('Please provide the part to push');
	this.parts_it.push(p);
};

ParserState.prototype.parts_pop = function() {
	return this.parts_it.pop();
};

ParserState.prototype.parts_get_current = function() {
	return this.parts_it.get();
};

ParserState.prototype.parts_set_current = function(p) {
	this.parts_it.set_current(p);
};

// Classify the given character(s). It could suit a number of different
// attributes at once.
ParserState.prototype.classify = function(ch) {
	var val = 0;
	if(typeof ch != 'string')
		return EX_COMPILED;
	switch(ch) {
		case '(': val = EX_OPCHAIN | EX_FUNCTIONCALL; break;
		case ')': val = EX_CALL_END | EX_OPCHAIN_END; break;
		case ' ': val = EX_PARAM_SEPARATOR; break;
		case "'": val = EX_STRING_SINGLE; break;
		case '"': val = EX_STRING_DOUBLE; break;
		case '%': val = EX_COMMENT; break;
		default:
			if(ch.match(/^[a-z][a-zA-Z0-9_]*$/))
				val = EX_ATOM; //| EX_FUNCTIONCALL;
			else if(ch.match(/^[A-Z][A-Za-z0-9_]*$/))
				val = EX_VARIABLE;
			else if(ch.match(/[0-9][0-9.]*$/))
				val = EX_NUMBER;
			else if(ch.length > 1 && ch.match(/^".*"$/))
				val = EX_STRING_DOUBLE;
			else if(ch.length > 1 && ch.match(/^'.*'$/))
				val = EX_STRING_SINGLE;
			else {
				//console.log("WARNING: assuming atom for: " + ch);
				val = EX_ATOM;
			}
	}
	// EX_STRING_CHARACTER is implied
	val |= EX_STRING_CHARACTER;
	return val;
};

ParserState.prototype.finalize = function() {
	return this.opchain_current();
};

ParserState.prototype.do_function_call = function() {
	// Function call
	var fnName = this.parts[0];
	var params = [];
	for(var i = 1; i < this.parts.length; i++) {
		var part = this.parts[i];
		console.log("Part: " + part + " type: " + typeof part);
		// Already processed?
		if(typeof part != 'string') {
			params.push(part);
			continue;
		}
		// TODO: Determine where these empty strings come from
		if(part == '')
			continue;
		var clsThis = this.classify(part);
		console.log("Type of argument " + i + ": " + GET_EX(clsThis));
		if(clsThis & EX_COMPILED)
			params.push(EX_COMPILED);
		else if(clsThis & EX_NUMBER)
			params.push(new LiteralValue(parseInt(part)));
		else if(clsThis & EX_STRING_DOUBLE || clsThis & EX_STRING_SINGLE)
			params.push(new LiteralValue(part.slice(1, part.length - 1)));
		else if(clsThis & EX_ATOM)
			params.push(Atom(part))
		else if(clsThis & EX_VARIABLE) {
			switch(fnName) {
				// These become Variable references for the following
				// functions.
				case 'set':
				case 'get':
				case 'var':
					params.push(new VariableReference(part));
					break;
				default:
					// Convert into (get) call
					params.push(new FunctionCall("get/1", [
						new VariableReference(part)
					]));
					break;
			}
		} else {
			throw new Error("Don't know what to do with: " + GET_EX(clsThis));
		}
	}
	console.log("(" + fnName + " ", params, ")");
	this.current_set('');
	this.parts = this.parts_pending.pop() || [];
	this.parts_it = this.parts.iterator();
	this.parts_it.push(new FunctionCall(fnName + "/" + params.length, params));
	console.log("Parts now: ", this.parts);
	if(this.parts.length == 1) {
		console.log("Now pushing completed function call");
		// We can now push this to the opchain
		this.opchain_current().push(this.parts[0]);
		this.parts = [];
		this.parts_it = this.parts.iterator();
	}
};

function BootstrapParser (code) {
	var state = new ParserState();
	var it = code.split('').iterator();
	var ch;

	// Move to the next valid character.
	// Skips newlines, tabs, and also strips comment lines.
	function moveNext () {
		var expect = state.expect_current();
		var ch = it.next();
		if(ch === undefined)
			return ch;
		var chCode = ch.charCodeAt(0);
		while(chCode == 10 || chCode == 9) {
			ch = it.next();
			if(ch === undefined)
				return ch;
			chCode = ch.charCodeAt(0);
		}
		if(ch == '%' && !(expect & EX_STRING_SINGLE || expect & EX_STRING_DOUBLE)) {
			// Comment and not in speech, ignore this line
			console.log("COMMENT");
			while(chCode != 10) {
				ch = it.next();
				if(ch === undefined)
					return ch;
				chCode = ch.charCodeAt(0);
			}
			ch = it.next();
		}
		return ch;
	}

	while( (ch = moveNext()) != undefined) {
		console.log("Parse character: " + ch + " " + ch.charCodeAt(0).toString(10));

		// Classify the current character
		var cls = state.classify(ch);
		console.log("      Type     : " + GET_EX(cls));
		console.log("  expect_current: 0x" + state.expect_current().toString(16) + " (" + GET_EX(state.expect_current()) + ")");

		// Skip spaces we are not expecting. This really only affects extra
		// space characters within a line.
		var expect = state.expect_current();
		if(cls & EX_PARAM_SEPARATOR &&
			!(expect & EX_PARAM_SEPARATOR) &&
			!(expect & EX_STRING_CHARACTER)) {
			console.log("Space when not expecting, ignoring");
			continue;
		}

		// Has the character been classified as something we are expecting?
		if(!(cls & expect))
			throw new Error("Unexpected " + GET_EX(cls) + ", was expecting: " + GET_EX(state.expect));

		// Based on the class and what we're currently expecting, adjust the
		// parser state. This is the main parsing section.
		if(cls & EX_OPCHAIN && expect & EX_OPCHAIN) {
			// Start a new opchain
			console.log("Start OPCHAIN");
			state.current_push();
			state.expect_set(EX_FUNCTIONCALL | EX_ATOM | EX_VARIABLE | EX_NUMBER);
		} else if(cls & EX_FUNCTIONCALL && expect & EX_FUNCTIONCALL) {
			// Start a function call (pushes state)
			console.log("Start FUNCTIONCALL, current parts: " + state.parts);
			state.current_push();
			state.parts_pending_it.push(state.parts);
			state.parts = [];
			state.parts_it = state.parts.iterator();
			console.log("Pending parts: " + state.parts_pending);
			state.expect_set(EX_ATOM | EX_PARAM_SEPARATOR | EX_CALL_END);
			state.current_set('');
		} else if(cls & EX_ATOM && !(expect & EX_STRING_CHARACTER)) {
			// Build an atom
			console.log("Current: " + state.current_current() + " + " + ch);
			state.current_append(ch);
			state.expect_set(EX_ATOM | EX_PARAM_SEPARATOR | EX_CALL_END);
		} else if(cls & EX_PARAM_SEPARATOR && !(expect & EX_STRING_CHARACTER)) {
			// A separater has been found. Save current token and push it
			// onto the parts list. When we find the end of the function call,
			// we'll create the actual instruction.
			console.log("SEPERATOR");
			console.log("Current: " + state.current_current());
			state.parts_push(state.current_current());
			state.parts_it.prev();
			state.current_set('');
			console.log("Parts so far: ", state.parts_get_current());
			state.expect_set(EX_ATOM | EX_FUNCTIONCALL | EX_NUMBER | EX_STRING_SINGLE | EX_STRING_DOUBLE | EX_VARIABLE | EX_CALL_END);
		} else if(cls & EX_STRING_SINGLE) {
			// Single quote found. Either starts or finishes a string.
			console.log("Current: " + state.current_current() + " + " + ch);
			state.current_append(ch);
			if(!(expect & EX_STRING_CHARACTER)) {
				state.expect_set(EX_STRING_CHARACTER | EX_STRING_SINGLE);
			} else if(expect & EX_STRING_SINGLE) {
				console.log("END SINGLE QUOTE STRING");
				state.expect_set(EX_SEPARATOR | EX_CALL_END);
			}
		} else if(cls & EX_STRING_DOUBLE) {
			// Double quote found. Either starts or finishes a string.
			console.log("Current: " + state.current_current() + " + " + ch);
			state.current_append(ch);
			if(!(expect & EX_STRING_CHARACTER)) {
				console.log("START DOUBLE QUOTE STRING");
				state.expect_set(EX_STRING_CHARACTER | EX_STRING_DOUBLE);
			} else if(expect & EX_STRING_DOUBLE) {
				console.log("END DOUBLE QUOTE STRING");
				state.expect_set(EX_PARAM_SEPARATOR | EX_CALL_END);
			}
		} else if(cls & EX_NUMBER && !(expect & EX_STRING_CHARACTER)) {
			// Number found.
			console.log("Number : " + state.current_current() + " + " + ch);
			state.current_append(ch);
			state.expect_set(EX_NUMBER | EX_PARAM_SEPARATOR | EX_CALL_END | EX_OPCHAIN_END);
		} else if(cls & EX_VARIABLE && !(expect & EX_STRING_CHARACTER)) {
			// Variable name found
			console.log("Variable: " + state.current_current() + " + " + ch);
			state.current_append(ch);
			state.expect_set(EX_VARIABLE | EX_PARAM_SEPARATOR | EX_CALL_END | EX_OPCHAIN_END);
		} else if(cls & EX_STRING_CHARACTER && expect & EX_STRING_CHARACTER) {
			// We are in a string and we got a string character.
			console.log("Current: " + state.current_current() + " + " + ch);
			state.current_append(ch);
		} else if(cls & EX_CALL_END && expect & EX_CALL_END) {
			// The current call parameter list has ended.
			console.log("Current call ends, parse it");
			console.log("Current: " + state.current_current());
			state.parts_push(state.current_current());
			state.parts_it.prev();
			console.log("Parts so far: ", state.parts);
			state.expect_set(EX_OPCHAIN | EX_FUNCTIONCALL | EX_OPCHAIN_END);
			var clsFirst = state.classify(state.parts[0]);
			console.log("Type of first object: " + GET_EX(clsFirst));
			if(clsFirst & EX_ATOM) {
				state.do_function_call();
				if(state.parts.length > 0) {
					// Still more to go
					state.expect_set(EX_PARAM_SEPARATOR | EX_CALL_END);
				}
			} else if(clsFirst & EX_COMPILED) {
				console.log("Compiled set");
				if(state.parts.length > 1)
					// Probably just need to push everything?
					throw new Error("Not sure what to do here");
				state.opchain_current.push(state.parts[0]);
			}
		} else if(cls & EX_OPCHAIN_END && expect & EX_OPCHAIN_END) {
			// The current opchain has ended.
			console.log("Current opchain ends, build it");
			console.log("Current: " + state.current_current());
			console.log("Parts so far: ", inspect(state.parts, {depth:null,colors:true}));
			if(state.parts.length > 0) {
				state.do_function_call();
				console.log("Parts now: ", inspect(state.parts, {depth:null,colors:true}));
				state.opchain_current().push(state.parts[0]);
				state.parts = [];
				state.parts_it = state.parts.iterator();
				state.expect_set(EX_OPCHAIN | EX_OPCHAIN_END);
				if(state.parts.length > 0) {
					// Still more to go
					state.expect_set(EX_PARAM_SEPARATOR | EX_CALL_END);
				}
			} else {
				// Still more to go
				state.expect_set(EX_PARAM_SEPARATOR | EX_CALL_END);
			}
		} else {
			throw new Error("Don't know what to do with: " + GET_EX(cls));
		}
	}

	return state.finalize();
}

exports.BootstrapParser = BootstrapParser;

// Test
var code = `(
    % Print a simple message
    % (print  "Hello, world!")
    (print "1+1:" (+ 1 1) " Wow!")
    (print "Also a test:" (* 5 10))
	(print "One last test:" (/ 10 2))
	(var A 5)
	(var B 6)
	(print "A+B:" (+ A B))
)`;

var parsed = BootstrapParser(code);
console.log("Parsed: ", inspect(parsed, {depth: null, colors: true}));

var i = new Lithp();
parsed.importClosure(i.functions);
i.run(parsed);
