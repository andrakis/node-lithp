/**
 * Bootstrap Parser, Platform V0, for Lithp
 *
 * Main parser for the first version of Lithp. A simple parser that can be used
 * to create a better parser later (Platform V1).
 *
 * See 'run.js' (in the top level directory) for a working usage of this parser.
 */

"use strict";

var util = require('util'),
	inspect = util.inspect;
var lithp = require( './../../index'),
	Lithp = lithp.Lithp,
	parser_debug = lithp.parser_debug,
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

var enable_parser_debug = false;
var parser_debug = function() {
	if(enable_parser_debug)
		console.error.apply(console, arguments);
}
global._lithp.set_parser_debug = function(val) { enable_parser_debug = val; };

var arityBuiltins = {
	print: '*',
	and: '*',
	or: '*',
	'+': '*',
	'++': '*',
	'-': '*',
	'/': '*',
	'*': '*',
	'+': '*',
	'+': '*',
	'+': '*',
	list: '*',
	flatten: '*',
	call: '*',
	'to-string': '*',
	'export': '*',
	'export-global': '*',
	invoke: '*',
	dict: '*',
};

var timespentParsing = 0;
global._lithp.getParserTime = function() { return timespentParsing; };

var EX_LITERAL = 1 << 0,             // Literal (1, 2, "test")
    EX_OPCHAIN = 1 << 1,             // opening OpChain '('
    EX_FUNCTIONCALL = 1 << 2,        // opening FunctionCall '('
    EX_NUMBER  = 1 << 3,             // Collect number (whole or float: [0-9.]+f?$)
    EX_ATOM    = 1 << 4,             // Collect atom
    EX_VARIABLE= 1 << 5,             // Variables
    EX_STRING_CHARACTER  = 1 << 6,   // Collect character
    EX_STRING_SINGLE = 1 << 7,       // Expecting a single quote to end '
    EX_STRING_DOUBLE = 1 << 8,       // Expecting a double quote to end "
    EX_PARAM_SEPARATOR   = 1 << 9,   // Expecting a space
    EX_CALL_END          = 1 << 10,  // Expected a ), end of call
    EX_OPCHAIN_END       = 1 << 11,  // Expect a ), end of opchain
    EX_COMMENT           = 1 << 12,  // Comments
    EX_COMPILED          = 1 << 13,  // Already compiled
    EX_FUNCTION_MARKER   = 1 << 14,  // #     next: Arg1,Arg2 :: (...)
    EX_FUNCTION_PARAM    = 1 << 15,  // #     this: Arg1
    EX_FUNCTION_PARAM_SEP= 1 << 16,  // #Arg1 this: ,
    EX_FUNCTION_BODY     = 1 << 17;  // #Arg1,Arg2  this: ::

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
	this.in_atom = false;
	this.quote_type = undefined;
	this.line = 0;
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
		case ' ': case "\t": case "\r": case "\n":
			val = EX_PARAM_SEPARATOR; break;
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
			else if(ch.match(/^-?[0-9][0-9.]*$/))
				val = EX_NUMBER | EX_ATOM;
			else if(ch.length > 1 && ch.match(/^".*"$/))
				val = EX_STRING_DOUBLE;
			else if(ch.length > 1 && ch.match(/^'.*'$/))
				val = EX_STRING_SINGLE;
			else {
				//parser_debug("WARNING: assuming atom for: " + ch);
				val = EX_ATOM;
			}
	}
	// EX_STRING_CHARACTER is implied
	val |= EX_STRING_CHARACTER;
	return val;
};

ParserState.prototype.mapParam = function(P, chain, fnName) {
	var result = this.mapParamInner(P, chain, fnName);
	parser_debug("mapParam(", P, ") :: ", result);
	return result;
};

// Runs a series of replace actions over a string to replace escape sequences.
function parseString (str) {
	return str.replace(/\\(.)/g, function(FullMatch, Escape)  {
		switch(Escape) {
			case 'n': return "\n";
			case 'r': return "\r";
			case 't': return "\t";
			case '\\': return "\\";
			default: throw new Error('Unknown escape sequence: ' + Escape);
		}
	});
}

ParserState.prototype.mapParamInner = function(P, chain, fnName) {
	if(!Array.isArray(P)) {
		var cls = this.classify(P);
		parser_debug("Classified: " + GET_EX(cls));
		if(cls & EX_STRING_DOUBLE || cls & EX_STRING_SINGLE) {
			var parsed = parseString(P.slice(1, P.length - 1)); 
			if(cls & EX_STRING_DOUBLE)
				return new LiteralValue(parsed);
			else if(cls & EX_STRING_SINGLE)
				return Atom(parsed);
		} else if(cls & EX_VARIABLE) {
			if(fnName == 'get' || fnName == 'set' || fnName == 'var')
				return new VariableReference(P);
			return new FunctionCall("get/1", [new VariableReference(P)]);
		} else if(cls & EX_NUMBER)
			return new LiteralValue(Number(P));
		else if(cls & EX_ATOM)
			return Atom(P);
	} else {
		return this.convert(chain, P);
	}
	throw new Error("Unable to map parameter: " + inspect(P));
};

ParserState.prototype.convert = function(chain, curr) {
	var eleFirst = curr[0];
	var clsFirst = this.classify(eleFirst);
	var op;
	parser_debug("  First element: ", eleFirst);
	parser_debug("     Classified: ", GET_EX(clsFirst));
	if(curr.length == 0)
		return undefined;
	if(curr._fndef) {
		parser_debug("FNDEF");
		parser_debug("Params: ", curr._fnparams);
		var params = curr._fnparams;
		curr._fndef = false;
		//var newChain = new OpChain(chain);
		var body = this.convert(chain, curr);
		var anon = AnonymousFunction(chain, params, body);
		parser_debug("Got body for function:", body.toString());
		return anon;
	}
	if(clsFirst & EX_STRING_SINGLE) {
		// Convert to a (call (get 'FnName') Params...)
		parser_debug("STRING_SINGLE, convert to FunctionCall: (call/* (get/1 : " + eleFirst + " ... ");
		eleFirst = eleFirst.slice(1, eleFirst.length - 1);
		clsFirst = this.classify(eleFirst);
		parser_debug("    First element: ", eleFirst);
		parser_debug("    Re-Classified: ", GET_EX(clsFirst));
	}
	if(clsFirst & EX_ATOM) {
		// FunctionCall
		parser_debug(" PARSE TO FUNCTIONCALL: ", curr);
		var params = curr.slice(1);
		params = params.map(P => this.mapParam(P, chain, eleFirst));
		if(params.length == 0 && this.classify(eleFirst) & EX_NUMBER) {
			parser_debug("CONVERT TO LITERAL");
			return this.mapParam(eleFirst, chain, eleFirst);
		} else {
			var plen = params.length;
			if(eleFirst in arityBuiltins)
				plen = arityBuiltins[eleFirst];
			parser_debug("FUNCTIONCALL " + eleFirst + "/" + plen);
			op = new FunctionCall(eleFirst + "/" + plen, params);
			return op;
		}
	} else if(Array.isArray(eleFirst)) {
		// Must be an OpChain
		var newChain = new OpChain(chain);
		for(var i = 0; i < curr.length; i++) {
			parser_debug("Member " + i + " of chain: ", curr[i]);
			newChain.push(this.convert(newChain, curr[i]));
		}
		return newChain;
	} else if(curr.length > 0) {
		// Must be an OpChain
		parser_debug(" PARSE TO OPCHAIN");
		var newChain = new OpChain(chain);
		for(var i = 0; i < curr.length; i++) {
			parser_debug("Member " + i + " of chain: ", curr[i]);
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
	parser_debug("Finalize tree: ", this.ops);
	var chain = new OpChain();
	var it = this.ops.iterator();
	var curr;
	while((curr = it.next())) {
		var c = this.convert(chain, curr);
		parser_debug("Got from convert: ", c);
		if(c)
			chain.push(c);
	}
	return chain;
};

ParserState.prototype.parseBody = function(it, dest) {
	var params = this.current_word.length > 0 ?
		this.current_word.split(',') : [];
	parser_debug(" Body: params count: " + params.length);
	this.current_word = '';
	var d = [];
	d._fndef = true;
	d._fnparams = params;
	var chain = this.parseSection(it, d);
	parser_debug(" Body chain: " + inspect(chain, {depth: null, colors:true}));
	return chain;
};

var characters = 0;
ParserState.prototype.parseSection = function(it, dest) {
	var ch;
	var self = this;

	// Move to the next valid character.
	// Skips newlines, tabs, and also strips comment lines.
	function moveNext () {
		var expect = self.expect;
		var ch = it.next();
		if(ch === undefined)
			return ch;
		function ignore_line () {
			var chCode = ch.charCodeAt(0);
			while(chCode != 10) {
				ch = it.next();
				characters++;
				if(ch === undefined)
					return ch;
				chCode = ch.charCodeAt(0);
			}
			ch = it.next();
		}
		if(characters == 0 && ch == '#') {
			ch = it.next();
			if(ch == '!') {
				// Shebang, ignore line
				ignore_line();
			} else
				throw new Error('Unexpected token and not shebang');
		}
		characters++;
		if(ch === undefined)
			return ch;
		if(ch == '%' && !(self.expect & EX_STRING_CHARACTER)) {
			// Comment and not in speech, ignore this line.
			// Must keep running in a loop, in case there are more
			// comments.
			while(ch == '%') {
				parser_debug("COMMENT");
				ignore_line();
			}
		}
		return ch;
	}

	var depth = 1;

	while( (ch = moveNext()) != undefined) {
		parser_debug("Parse character: " + ch + " " + ch.charCodeAt(0).toString(10));

		// Classify the current character
		var cls = this.classify(ch);
		parser_debug("      Type     : " + GET_EX(cls));
		parser_debug("  expect_current: 0x" + this.expect.toString(16) + " (" + GET_EX(this.expect) + ")");
		parser_debug("     In var    : " + this.in_variable);
		if(this.quote_type !== undefined)
			parser_debug("     Quote Type: " + this.quote_type);

		// Skip spaces we are not expecting. This really only affects extra
		// space characters within a line.
		var expect = this.expect;
		if(cls & EX_PARAM_SEPARATOR &&
			!(expect & EX_PARAM_SEPARATOR) &&
			!(expect & EX_STRING_CHARACTER)) {
			parser_debug("Space when not expecting, ignoring");
			continue;
		}

		if(cls & EX_FUNCTION_BODY &&
		   !(expect & EX_FUNCTION_BODY) &&
		   !(expect & EX_STRING_CHARACTER)) {
			parser_debug("Found the extra :, ignoring");
			continue;
		}

		// When a variable goes from CAPStosmall
		if(cls & EX_ATOM &&
			(expect & EX_VARIABLE || expect & EX_FUNCTION_PARAM) &&
			this.in_variable) {
			parser_debug("Found atom but was expecting variable, supposing it is part of the name");
			this.current_word += ch;
			continue;
		}

		// When an atom goes from smallToCaps
		if(cls & EX_VARIABLE && expect & EX_ATOM && this.in_atom) {
			parser_debug("Found variable but was expecting atom, supposing it is part of the name");
			this.current_word += ch;
			continue;
		}

		// OpChain begin but expecting separator?
		if(cls & EX_OPCHAIN && expect & EX_PARAM_SEPARATOR) {
			// Change character to separator, next loop we will get the EX_OPCHAIN again.
			ch = ' ';
			cls = this.classify(ch);
			it.prev();
		}

		// Has the character been classified as something we are expecting?
		if(!(cls & expect)) {
			throw new Error("Unexpected character " + ch + " (" + GET_EX(cls) + "), was expecting: " + GET_EX(this.expect));
		}

		if(cls & EX_OPCHAIN && !(expect & EX_STRING_CHARACTER)) {
			// Open an Opchain
			this.expect = EX_OPCHAIN | EX_NUMBER | EX_LITERAL | EX_STRING_DOUBLE | EX_STRING_SINGLE | EX_ATOM | EX_FUNCTION_MARKER | EX_VARIABLE;
			this.current_word = '';
			//dest.push([]);
			dest.push(this.parseSection(it, []));
		} else if(cls & EX_OPCHAIN_END && !(expect & EX_STRING_CHARACTER)) {
			// Close an OpChain
			if(this.current_word.length > 0)
				dest.push(this.current_word);
			this.expect = EX_OPCHAIN | EX_OPCHAIN_END | EX_FUNCTION_MARKER | EX_NUMBER | EX_STRING_SINGLE | EX_STRING_DOUBLE | EX_VARIABLE | EX_ATOM;
			this.current_word = '';
			this.in_variable = false;
			return dest;
		} else if(cls & EX_ATOM && expect & EX_ATOM) {
			// Continue an atom
			this.current_word += ch;
			this.in_atom = true;
			this.expect = EX_ATOM | EX_PARAM_SEPARATOR | EX_FUNCTION_MARKER | EX_OPCHAIN_END | EX_FUNCTIONCALL;
		} else if(cls & EX_PARAM_SEPARATOR && expect & EX_PARAM_SEPARATOR &&
		        !(expect & EX_STRING_CHARACTER) &&
		        !(expect & EX_FUNCTION_PARAM)) {
			// Space not in string, param separator
			parser_debug("SEPARATOR");
			if(this.current_word.length > 0) {
				dest.push(this.current_word);
			}
			this.current_word = '';
			this.expect = EX_OPCHAIN | EX_VARIABLE | EX_NUMBER | EX_LITERAL | EX_ATOM | EX_STRING_DOUBLE | EX_STRING_SINGLE | EX_ATOM | EX_FUNCTION_MARKER | EX_OPCHAIN_END;
			this.in_variable = false;
			this.in_atom = false;
		} else if(cls & EX_STRING_SINGLE && this.quote_type != '"') {
			// Start or end a single quote string, if not already in a double quote string
			if(!(expect & EX_STRING_CHARACTER)) {
				parser_debug("START SINGLE QUOTE STRING");
				this.expect = EX_STRING_CHARACTER | EX_STRING_SINGLE;
				this.current_word = ch;
				this.quote_type = "'";
			} else {
				parser_debug("END SINGLE QUOTE STRING");
				this.current_word += ch;
				if(this.current_word.length > 0)
					dest.push(this.current_word);
				this.expect = EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
				this.current_word = '';
				this.quote_type = undefined;
			}
		} else if(cls & EX_STRING_DOUBLE && this.quote_type != "'") {
			// Start or end a double quote string, if not already in a single quote string
			if(!(expect & EX_STRING_CHARACTER)) {
				parser_debug("START DOUBLE QUOTE STRING");
				this.expect = EX_STRING_CHARACTER | EX_STRING_DOUBLE;
				this.current_word = ch;
				this.quote_type = '"';
			} else {
				parser_debug("END DOUBLE QUOTE STRING");
				this.current_word += ch;
				if(this.current_word.length > 0)
					dest.push(this.current_word);
				this.expect = EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
				this.current_word = '';
				this.quote_type = undefined;
			}
		} else if(cls & EX_STRING_CHARACTER && expect & EX_STRING_CHARACTER) {
			// Continue string character reading
			this.current_word += ch;
		} else if(cls & EX_VARIABLE && expect & EX_VARIABLE) {
			// Start or continue variable
			this.in_variable = true;
			this.current_word += ch;
			this.expect = EX_VARIABLE | EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
		} else if(cls & EX_NUMBER && expect & EX_NUMBER) {
			// Start or continue number
			this.current_word += ch;
			this.expect = EX_NUMBER | EX_PARAM_SEPARATOR | EX_OPCHAIN_END;
		} else if(cls & EX_FUNCTION_MARKER && expect & EX_FUNCTION_MARKER) {
			// Start or begin function
			parser_debug("BEGIN FUNCTION MARKER");
			// Current: #
			// Next: Arg1[,Arg2] :: Ops
			this.expect = EX_FUNCTION_PARAM | EX_FUNCTION_PARAM_SEP | EX_FUNCTION_BODY | EX_PARAM_SEPARATOR;
		} else if((cls & EX_FUNCTION_PARAM || cls & EX_FUNCTION_PARAM_SEP) &&
		           expect & EX_FUNCTION_PARAM) {
			// Continue reading function parameters
			this.current_word += ch;
			this.in_variable = true;
			parser_debug("CONTINUE FUNCTION PARAM: " + this.current_word);
		} else if(cls & EX_PARAM_SEPARATOR && expect & EX_FUNCTION_PARAM_SEP) {
			// Function parameters end, body starts soon
			parser_debug("PARAMS END");
			this.expect = EX_FUNCTION_BODY;
			this.in_variable = false;
		} else if(cls & EX_FUNCTION_BODY && expect & EX_FUNCTION_BODY) {
			parser_debug("FUNCTION BODY STARTS, current word: " + this.current_word);
			this.expect = EX_OPCHAIN;
			this.in_variable = false;
			dest.push(this.parseBody(it, []));
			this.current_word = '';
			return dest;
		} else {
			throw new Error('Unhandled combination');
		}

		parser_debug("State current: ");
		parser_debug("  Ops: ", this.ops);
		parser_debug("  Expect: " + GET_EX(this.expect));
		parser_debug("  Current word: " + this.current_word);
		parser_debug("  Depth: " + this.depth);
	}
	return dest;
}

function BootstrapParser (code) {
	characters = 0;
	var start = (new Date()).getTime();
	var state = new ParserState();
	var it = code.split('').iterator();
	state.ops = state.parseSection(it, []);
	var fin = state.finalize();
	timespentParsing += (new Date()).getTime() - start;
	return fin;
}

exports.BootstrapParser = BootstrapParser;

