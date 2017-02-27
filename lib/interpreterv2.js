/**
 * Lithp language interpreter.
 *
 * This is the main interpreter unit, and performs all the basic
 * interpreter functions.
 *
 * It operates only on prepared OpChains, requiring either hand-
 * compilation or a parser (see run.js.)
 *
 * See samples.js for some hand-compiled samples, or samples/ for files
 * that can be run with run.js
 *
 */

"use strict";

var util = require('util'),
	inspect = util.inspect;
var types = require('./types'),
	OpChain = types.OpChain,
	Atom = types.Atom,
	FunctionCall = types.FunctionCall,
	FunctionReentry = types.FunctionReentry,
	FunctionDefinition = types.FunctionDefinition,
	FunctionDefinitionNative = types.FunctionDefinitionNative,
	AnonymousFunction = types.AnonymousFunction,
	LiteralValue = types.LiteralValue,
	VariableReference = types.VariableReference,
	Tuple = types.Tuple,
	samples = require('./samples');

var atomMissing = Atom('missing');

var Ops = {
	PUSH:      0x01,
	PUSH_ATOM: 0x00,
	PUSH_INT:  0x01,
	PUSH_FLOAT:0x02,
	PUSH_STR:  0x04,
	PUSH_REF:  0x08,
	PUSH_CHAIN:0x16,

	CTX:       0x02,
	CTX_PUSH:  0x00,
	CTX_RESOLV:0x01,

	RET:       0x04,

	HINT:      0x08,
	HINT_FUN:  0x00,
	HINT_PARAM:0x01,
};

function MakeOp (Op, SubOp, Value) {
	return (((Op << 8) | SubOp << 8) | Value) >>> 0;
}

function UnmakeOp (Op) {
	return [Op >> 24, Op >> 16 & 0xFF, Op & 0xFFFF]
}

function InterpreterV2 (chain) {
	this.chain = chain;
	this.code  = this.compileChain(chain);
}

InterpreterV2.prototype.compileChain = function(chain) {
	var code = [];

};
