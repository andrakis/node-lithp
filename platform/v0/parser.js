/**
 * Bootstrap Parser, Platform V0, for Lithp
 *
 * Main parser for the first version of Lithp. A simple parser that can be used
 * to create a better parser later (Platform V1).
 *
 * See 'run.js' (in the top level directory) for a working usage of this parser.
 */

var util = require('util'),
	inspect = util.inspect;
var lithp = require(__dirname + '/../../index'),
	Lithp = lithp.Lithp,
	debug = lithp.debug,
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
    EX_COMPILED          = 1 << 13, // Already compiled
    EX_FUNCTION_MARKER   = 1 << 14, // #     next: Arg1,Arg2 :: (...)
    EX_FUNCTION_PARAM    = 1 << 15, // #     this: Arg1
    EX_FUNCTION_PARAM_SEP= 1 << 16, // #Arg1 this: ,
    EX_FUNCTION_BODY     = 1 << 17; // #Arg1,Arg2  this: ::

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
	EX_COMPILED: EX_COMPILED,
	EX_FUNCTION_MARKER: EX_FUNCTION_MARKER,
	EX_FUNCTION_PARAM: EX_FUNCTION_PARAM,
	EX_FUNCTION_PARAM_SEP: EX_FUNCTION_PARAM_SEP,
	EX_FUNCTION_BODY: EX_FUNCTION_BODY
};

function GET_EX (n) {
	var parts = [];
	for(var k in EX_TABLE)
		if(EX_TABLE[k] & n)
			parts.push(k);
	if(parts.length > 0)
		return parts.join(' | ');
	throw new Error("Expected value not known: " + n);
}

function ParserState (parent) {
	this.ops = [[]];
	this.ops_it = this.ops.iterator();
	this.current_word = '';
	this.expect = EX_OPCHAIN;
	this.depth = 0;
	this.in_variable = false;
}

// Classify the given character(s). It could suit a number of different
// attributes at once.
ParserState.prototype.classify = function(ch) {
	var val = 0;
	if(typeof ch != 'string')
		return EX_COMPILED;
	if(ch.charCodeAt(0) == 9)
		return EX_PARAM_SEPARATOR;
	switch(ch) {
		case '(': val = EX_OPCHAIN | EX_FUNCTIONCALL; break;
		case ')': val = EX_CALL_END | EX_OPCHAIN_END; break;
		case ' ': val = EX_PARAM_SEPARATOR; break;
		case "'": val = EX_STRING_SINGLE; break;
		case '"': val = EX_STRING_DOUBLE; break;
		case '%': val = EX_COMMENT; break;
		case '#': val = EX_FUNCTION_MARKER; break;
		case ',': val = EX_FUNCTION_PARAM_SEP; break;
		case ':': val = EX_FUNCTION_BODY; break; // Repeated twice for functions
		default:
			if(ch.match(/^[a-z][a-zA-Z0-9_]*$/))
				val = EX_ATOM;
			else if(ch.match(/^[A-Z][A-Za-z0-9_]*$/))
				val = EX_VARIABLE | EX_FUNCTION_PARAM;
			else if(ch.match(/[0-9][0-9.]*$/))
				val = EX_NUMBER | EX_ATOM;
			else if(ch.length > 1 && ch.match(/^".*"$/))
				val = EX_STRING_DOUBLE;
			else if(ch.length > 1 && ch.match(/^'.*'$/))
				val = EX_STRING_SINGLE;
			else {
				//debug("WARNING: assuming atom for: " + ch);
				val = EX_ATOM;
			}
	}
	// EX_STRING_CHARACTER is implied
	val |= EX_STRING_CHARACTER;
	return val;
};

ParserState.prototype.mapParam = function(P, chain, fnName) {
	if(!Array.isArray(P)) {
		var cls = this.classify(P);
		debug("Classified: " + GET_EX(cls));
		if(cls & EX_STRING_DOUBLE || cls & EX_STRING_SINGLE)
			return new LiteralValue(P.slice(1, P.length - 1));
		else if(cls & EX_VARIABLE) {
			if(fnName == 'get' || fnName == 'set' || fnName == 'var')
				return new VariableReference(P);
			return new FunctionCall("get/1", [new VariableReference(P)]);
		} else if(cls & EX_NUMBER)
			return new LiteralValue(parseInt(P));
		else if(cls & EX_ATOM)
			return Atom(P);
		else
			throw new Error("Unable to map parameter: " + inspect(P));
	} else {
		return this.convert(chain, P);
	}
	throw new Error("Unable to map parameter: " + inspect(P));
};

ParserState.prototype.convert = function(chain, curr) {
	var eleFirst = curr[0];
	var clsFirst = this.classify(eleFirst);
	var op;
	debug("  First element: ", eleFirst);
	debug("     Classified: ", GET_EX(clsFirst));
	if(curr.length == 0)
		return undefined;
	if(curr._fndef) {
		debug("FNDEF");
		debug("Params: ", curr._fnparams);
		var params = curr._fnparams;
		curr._fndef = false;
		//var newChain = new OpChain(chain);
		var body = this.convert(chain, curr);
		var anon = AnonymousFunction(chain, params, body);
		debug("Got body for function:", body.toString());
		return anon;
	}
	if(clsFirst & EX_ATOM) {
		// FunctionCall
		var params = curr.slice(1);
		params = params.map(P => this.mapParam(P, chain, eleFirst));
		if(params.length == 0 && this.classify(eleFirst) & EX_NUMBER) {
			debug("CONVERT TO LITERAL");
			return this.mapParam(eleFirst, chain, eleFirst);
		} else {
			debug("FUNCTIONCALL " + eleFirst + "/" + params.length);
			op = new FunctionCall(eleFirst + "/" + params.length, params);
			return op;
		}
	} else if(Array.isArray(eleFirst)) {
		// Must be an OpChain
		var newChain = new OpChain(chain);
		for(var i = 0; i < curr.length; i++) {
			debug("Member " + i + " of chain: ", curr[i]);
			newChain.push(this.convert(newChain, curr[i]));
		}
		return newChain;
	} else if(curr.length > 0) {
		// Must be an OpChain
		var newChain = new OpChain(chain);
		for(var i = 0; i < curr.length; i++) {
			debug("Member " + i + " of chain: ", curr[i]);
			//process.exit();
			//chain.push(this.convert(newChain, curr[i]));
			newChain.push(this.mapParam(curr[i], newChain, eleFirst));
		}
		return newChain;
	} else {
		throw new Error("Unable to convert: " + inspect(curr));
	}
};

ParserState.prototype.finalize = function() {
	debug("Finalize tree: ", this.ops);
	var chain = new OpChain();
	var it = this.ops.iterator();
	var curr;
	while((curr = it.next())) {
		var c = this.convert(chain, curr);
		debug("Got from convert: ", c);
		if(c)
			chain.push(c);
	}
	return chain;
};

ParserState.prototype.parseBody = function(it, dest) {
	var params = this.current_word.length > 0 ?
		this.current_word.split(',') : [];
	debug(" Body: params count: " + params.length);
	this.current_word = '';
	var d = [];
	d._fndef = true;
	d._fnparams = params;
	var chain = this.parseSection(it, d);
	debug(" Body chain: " + inspect(chain, {depth: null, colors:true}));
	return chain;
};

ParserState.prototype.parseSection = function(it, dest) {
	var ch;

	// Move to the next valid character.
	// Skips newlines, tabs, and also strips comment lines.
	function moveNext () {
		var expect = this.expect;
		var ch = it.next();
		if(ch === undefined)
			return ch;
		var chCode = ch.charCodeAt(0);
		while(chCode == 10 || chCode == 9 || chCode == 13) {
			ch = it.next();
			if(ch === undefined)
				return ch;
			chCode = ch.charCodeAt(0);
		}
		if(ch == '%' && !(expect & EX_STRING_SINGLE || expect & EX_STRING_DOUBLE)) {
			// Comment and not in speech, ignore this line.
			// Must keep running in a loop, in case there are more
			// comments.
			while(ch == '%') {
				debug("COMMENT");
				while(chCode != 10) {
					ch = it.next();
					if(ch === undefined)
						return ch;
					chCode = ch.charCodeAt(0);
				}
				ch = it.next();
				chCode = ch.charCodeAt(0);
				if(chCode == 13)
					ch = it.next();
			}
		}
		return ch;
	}

	var depth = 1;

	while( (ch = moveNext()) != undefined) {
		debug("Parse character: " + ch + " " + ch.charCodeAt(0).toString(10));

		// Classify the current character
		var cls = this.classify(ch);
		debug("      Type     : " + GET_EX(cls));
		debug("  expect_current: 0x" + this.expect.toString(16) + " (" + GET_EX(this.expect) + ")");
		debug("     In var    : " + this.in_variable);

		// Skip spaces we are not expecting. This really only affects extra
		// space characters within a line.
		var expect = this.expect;
		if(cls & EX_PARAM_SEPARATOR &&
			!(expect & EX_PARAM_SEPARATOR) &&
			!(expect & EX_STRING_CHARACTER)) {
			debug("Space when not expecting, ignoring");
			continue;
		}

		if(cls & EX_FUNCTION_BODY &&
		   !(expect & EX_FUNCTION_BODY) &&
		   !(expect & EX_STRING_CHARACTER)) {
			debug("Found the extra :, ignoring");
			continue;
		}

		// When a variable goes from CAPStosmall
		if(cls & EX_ATOM &&
			(expect & EX_VARIABLE || expect & EX_FUNCTION_PARAM) &&
			this.in_variable) {
			debug("Found atom but was expecting variable, supposing it is part of the name");
			this.current_word += ch;
			continue;
		}

		// Has the character been classified as something we are expecting?
		if(!(cls & expect)) {
			throw new Error("Unexpected " + GET_EX(cls) + ", was expecting: " + GET_EX(this.expect));
		}

		if(cls & EX_OPCHAIN && !(expect & EX_STRING_CHARACTER)) {
			this.expect = EX_OPCHAIN | EX_NUMBER | EX_LITERAL | EX_STRING_DOUBLE | EX_STRING_SINGLE | EX_ATOM | EX_FUNCTION_MARKER;
			this.current_word = '';
			//dest.push([]);
			dest.push(this.parseSection(it, []));
		} else if(cls & EX_OPCHAIN_END && !(expect & EX_STRING_CHARACTER)) {
			if(this.current_word.length > 0)
				dest.push(this.current_word);
			this.expect = EX_OPCHAIN | EX_OPCHAIN_END | EX_NUMBER | EX_STRING_SINGLE | EX_STRING_DOUBLE | EX_VARIABLE | EX_ATOM;
			this.current_word = '';
			return dest;
		} else if(cls & EX_ATOM && expect & EX_ATOM) {
			this.current_word += ch;
			this.expect = EX_ATOM | EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
		} else if(cls & EX_PARAM_SEPARATOR && expect & EX_PARAM_SEPARATOR &&
		        !(expect & EX_STRING_CHARACTER) &&
		        !(expect & EX_FUNCTION_PARAM)) {
			debug("SEPARATOR");
			if(this.current_word.length > 0) {
				dest.push(this.current_word);
			}
			this.current_word = '';
			this.expect = EX_OPCHAIN | EX_VARIABLE | EX_NUMBER | EX_LITERAL | EX_ATOM | EX_STRING_DOUBLE | EX_STRING_SINGLE | EX_ATOM | EX_FUNCTION_MARKER;
			this.in_variable = false;
		} else if(cls & EX_STRING_DOUBLE) {
			if(!(expect & EX_STRING_CHARACTER)) {
				debug("START DOUBLE QUOTE STRING");
				this.expect = EX_STRING_CHARACTER | EX_STRING_DOUBLE;
				this.current_word = ch;
			} else {
				debug("END DOUBLE QUOTE STRING");
				this.current_word += ch;
				if(this.current_word.length > 0)
					dest.push(this.current_word);
				this.expect = EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
				this.current_word = '';
			}
		} else if(cls & EX_STRING_CHARACTER && expect & EX_STRING_CHARACTER) {
			this.current_word += ch;
		} else if(cls & EX_VARIABLE && expect & EX_VARIABLE) {
			this.in_variable = true;
			this.current_word += ch;
			this.expect = EX_VARIABLE | EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
		} else if(cls & EX_NUMBER && expect & EX_NUMBER) {
			this.current_word += ch;
			this.expect = EX_NUMBER | EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
		} else if(cls & EX_FUNCTION_MARKER && expect & EX_FUNCTION_MARKER) {
			debug("BEGIN FUNCTION MARKER");
			// Current: #
			// Next: Arg1[,Arg2] :: Ops
			this.expect = EX_FUNCTION_PARAM | EX_FUNCTION_PARAM_SEP | EX_FUNCTION_BODY | EX_PARAM_SEPARATOR;
		} else if((cls & EX_FUNCTION_PARAM || cls & EX_FUNCTION_PARAM_SEP) &&
		           expect & EX_FUNCTION_PARAM) {
			this.current_word += ch;
			this.in_variable = true;
			debug("CONTINUE FUNCTION PARAM: " + this.current_word);
		} else if(cls & EX_PARAM_SEPARATOR && expect & EX_FUNCTION_PARAM_SEP) {
			debug("PARAMS END");
			this.expect = EX_FUNCTION_BODY;
		} else if(cls & EX_FUNCTION_BODY && expect & EX_FUNCTION_BODY) {
			debug("FUNCTION BODY STARTS, current word: " + this.current_word);
			this.expect = EX_OPCHAIN;
			dest.push(this.parseBody(it, []));
			this.current_word = '';
			return dest;
		} else {
			throw new Error('Unhandled combination');
		}

		debug("State current: ");
		debug("  Ops: ", this.ops);
		debug("  Expect: " + GET_EX(this.expect));
		debug("  Current word: " + this.current_word);
		debug("  Depth: " + this.depth);
	}
	return dest;
}

function BootstrapParser (code) {
	var state = new ParserState();
	var it = code.split('').iterator();
	state.ops = state.parseSection(it, []);
	return state.finalize();
}

exports.BootstrapParser = BootstrapParser;

var code = `(
	(print "Hello, world!")
	(var A 0)
	(if (== A 0) (
		(print "A is zero")
		(print ":)")
	) (else (
		(print "A is not zero, it is " A)
		(print ":(")
	)))
)`;

code = `(
	(def equal #A,B :: ((== A B)))
	(print "Equal: " (equal 0 1))
)`

if(1)code = `(
	(def add #A,B :: ((+ A B)))
	(print "Add 5+10: " (add 5 10))
)`;

code = `
	 ((def fac #N :: (
	    (if (== 0 N) (
			(1)
		) ((else (
			(* N (fac (- N 1)))
		))))
	  ))
	  (var Test 10)
	  (print "factorial of " Test ": " (fac Test))
	 )
`;

if(0) code = `(
	(def test # :: (("Hello")))
	(print "Test: " (test))
)`;
