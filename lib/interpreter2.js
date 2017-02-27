"use strict";

console.log("Stackless Lithp");

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
	Tuple = types.Tuple;

var atomNil = Atom('nil');
var atomMissing = Atom('missing');

var frames = [];
function Frame (fncall, chain) {
	this.last = atomNil;
	this.fncall = fncall;
	this.chain = chain;
	this.params_remaining = fncall.fn_params;
	this.params_resolved  = [];
	//console.log("Frame created: ", this.params_remaining.length, ' params');
}
Frame.prototype.perform_single = function(lithp) {
	if(this.params_remaining.length == 0)
		return this.perform_call(lithp);
	var current = this.params_remaining.shift();
	return this.perform_single_op(current, lithp);
};
Frame.prototype.perform_call = function(lithp) {
	console.log("TIME TO PERFORM CALL", this.chain.ops);
	console.log("Resolved params: ", this.params_resolved);
//Lithp.prototype.invoke_functioncall = function(chain, fndef, params) {
	//lithp_debug("FunctionCall " + i.fn_name + "(...)");
	var fn_call = this.fncall, fn_name = fn_call.fn_name;
	var chain = this.chain;
	//console.log(this);
	var fndef = chain.closure.get_or_missing(fn_name);
	if(fndef == atomMissing) {
		// Check for a function with any arity assigned (*)
		fn_name = fn_name.replace(/\d+$/, '*');
		fndef = chain.closure.get_or_missing(fn_name);
		if(fndef == atomMissing) {
			throw new Error('Error, unknown function: ' + fn_name);
		}
		//i.fn_name = fn_name; // Update reference for future
	}
	// Get the real values of all parameters. This may recursively invoke
	// this function to satisfy calls.
	var self = this;
	var params = this.params_resolved;
	//lithp_debug("Final params: ", inspect(params));
	//lithp_debug("Requesting invoke for: ", i);
	//lithp_debug("Found fndef: ", fndef);
	//lithp_debug("Actual fndef: ", fndef);
	frames.pop();
	//console.log("Popping frame: ", this);
	var parent = frames[frames.length - 1];
	//console.log("Parent frame: ", parent);
	var result = lithp.invoke_functioncall(chain, fndef, params);
	console.log("from invoke: got ", result);
	if(parent) {
		console.log(" Adding to parent");
		parent.params_resolved.push(result);
	} else {
		console.log(" Adding to current");
		this.params_resolved.push(result);
	}
	return result;
};
Frame.prototype.perform_single_op = function(op, lithp) {
	if(op) {
		switch(op.constructor) {
			case OpChain:
				return lithp.run(op);
			case LiteralValue:
				this.params_resolved.push(op.value);
				break;
			case FunctionDefinition:
			case FunctionDefinitionNative:
				this.params_resolved.push(op);
				break;
			case FunctionCall:
				frames.push(new Frame(op, this.chain));
				console.log("Pushing a new call frame");
				console.log("Current unresolved: ", this.params_remaining);
				this.params_remaining.push(op);
				break;
			default:
				this.params_resolved.push(op);
				break;
		}
	} else {
		this.params_resolved.push(op);
	}
};
Frame.prototype.resolve = function(lithp) {
	do {
		if(frames.length > 0) {
			var frame = frames[frames.length - 1];
			frame.perform_single(lithp);
		}
	} while(frames.length > 0);
};

/**
 * Run a function chain and return its value.
 * The is the top level interpreter, responsible for moving through
 * an OpChain and executing instructions, or just getting values
 * from LiteralValue returns.
 * This is the main function for running Lithp code.
 */
Lithp.prototype.run = function(chain) {
	//console.log("Frames to run: ", frames);
	var result = atomNil;
	do {
		this.setup_frame(chain);
		if(frames.length > 0) {
			var frame = frames[frames.length - 1];
			result = frame.perform_single(this);
		}
	} while(frames.length > 0);
	return result;
};

Lithp.prototype.setup_frame = function(chain) {
	if(this.stopped)
		throw new Error('Error: this instance has been stopped - ' + this.Defined(chain, '__filename'));
	this.last_chain = chain;
	var value = Atom("nil");
	//lithp_debug(chain);
	//console.log("Resuming chain from pos: " + chain.pos);
	if(this.depth > 32)
		throw new Error('depth exceed');
	while(chain.next()) {
		var i = chain.get();
		switch(i.constructor) {
			case OpChain:
				//lithp_debug("(run: current closure: ", i.closure.closure);
				//lithp_debug("(      parent closure: ", i.closure.parent);
				if(frames.length > 0) {
					frames[frames.length - 1].resolve(this);
				}
				this.setup_frame(new OpChain(chain, i.ops));
				break;
			case FunctionCall:
				/*if(frames.length > 0) {
					frames[frames.length - 1].resolve(this);
				}*/
				//frames.push(new Frame(i, chain));
				//this.setup_frame(new OpChain(chain, [i]));
				//frames.push(new Frame(i, chain));
				frames[frames.length - 1].params_resolved.push(new Frame(i, chain).resolve());
				break;
			default:
				console.error("Dont know what to do with: ", i);
				break;
		}
	}
	//lithp_debug("Final value: " + value + " (" + ((value && value.type) ? value.type : typeof value) + ")");
	return value;
};
