var util = require('util'),
    inspect = util.inspect;

function AtomValue (value) {
	this.value = value;
	this.type = 'Atom';
	this.name = atoms[this.value];
}
AtomValue.prototype.toString = function() {
	return atoms[this.value];
};

var atoms = {};
var atomid = 0;
function Atom (name) {
	if(!atoms[name]) {
		atoms[name] = ++atomid;
		atoms[atoms[name]] = name;
	}
	return new AtomValue(atoms[name]);
}

exports.Atom = Atom;

function Tuple () {
	this.value = Array.prototype.slice.call(arguments);
	this.type = 'Tuple';
}
Tuple.prototype.get = function(n) { return this.value[n]; };
Tuple.prototype.length = function() { return this.value.length; };
exports.Tuple = Tuple;

function OpChainClosure (owner, parent) {
	this.owner = owner;
	this.parent = parent;
	if(this.parent && this.parent.constructor == OpChain)
		this.parent = parent.closure;
	this.closure = {};
}
OpChainClosure.prototype.getOwner = function() { return this.owner; };
OpChainClosure.prototype.defined = function(name) {
	return Object.keys(this.closure).indexOf(name) != -1;
};
OpChainClosure.prototype.any_defined = function(name) {
	if(this.defined(name))
		return true;
	if(this.parent)
		return this.parent.any_defined(name);
	return false;
};
OpChainClosure.prototype._do_set = function(name, value) {
	if(value !== undefined && value.constructor == LiteralValue)
		value = LiteralValue.value;
	//console.log("(Setting locally)");
	this.closure[name] = value;
};

OpChainClosure.prototype.set = function(name, value) {
	if(this.defined(name)) {
		this._do_set(name, value);
		return true;
	}
	if(this.parent) {
	//console.log("(OpChainClosure.set(" + name + ", " + value + ")");
	//console.log("(Parent is:", this.parent, ")");
		if(this.parent.try_set(name, value)) {
			//console.log("(result from parent.try_set: true)");
			return true;
		}
	}
	this._do_set(name, value);
	return true;
};
OpChainClosure.prototype.set_immediate = function(name, value) {
	this._do_set(name, value);
};
OpChainClosure.prototype.try_set = function(name, value) {
	if(this.defined(name)) {
		this._do_set(name, value);
		return true;
	}
	if(this.parent) {
		return this.parent.try_set(name, value);
	}
	return false;
};
OpChainClosure.prototype.get = function(name) {
	if(this.defined(name))
		return new Tuple("ok", new Tuple(this.closure[name], this));
	if(this.parent)
		return this.parent.get(name);
	return new Tuple("error", new Tuple("not found"));
};
function OpChain (parent, ops) {
	this.parent = parent;
	if(ops && ops.constructor !== Array)
		ops = [ops];
	this.ops = ops || [];
	this.closure = new OpChainClosure(this, parent);
	this.immediate = false;
	this.pos = -1;
}
OpChain.prototype.importClosure = function(lib) {
	for(var k in lib) {
		this.closure.set(k, lib[k]);
	}
};
OpChain.prototype.push = function(e) {
	this.ops.push(e);
};
OpChain.prototype.next = function() {
	//this.current = this.ops.shift();
	this.pos++;
	if(this.pos > this.ops.length)
		return undefined;
	this.current = this.ops[this.pos];
	return this.get();
};
OpChain.prototype.get = function() {
	return this.current;
};
OpChain.prototype.toString = function() {
	return "OpChain (";
};
OpChain.prototype.call_immediate = function() {
	var imm = new OpChain();
	imm.parent = this.parent;
	imm.ops = this.ops;
	imm.closure = this.closure;
	imm.immediate = true;
	return imm;
};
exports.OpChain = OpChain;

function LiteralValue (value) {
	this.value = value;
	this.type = typeof value;
}
exports.LiteralValue = LiteralValue;

function VariableReference (name) {
	this.ref = name;
}
exports.VariableReference = VariableReference;

function FunctionCall (name, params, reentry) {
	// TODO: Later this will allow function reentry, but
	//       for now it just acts as a normal function call.
	//       This does mean head recursive functions can run
	//       out of stack space, but provides a much easier
	//       implementation.
	//this.fn__reentry = false;
	this.fn_args = params.length;
	this.fn_name = name;
	this.fn_params = params;
}
exports.FunctionCall = FunctionCall;

function FunctionReentry (name, params) {
	return new FunctionCall(name, params, true);
}
exports.FunctionReentry = FunctionReentry;

function FunctionDefinition (parent, name, params, body) {
	this.fn_name = name;
	this.fn_params = params;
	this.fn_body = new OpChain(parent, body);
}
exports.FunctionDefinition = FunctionDefinition;

var anonymous_counter = 0;
function AnonymousFunction (parent, params, body) {
	var fn_name = "__anonymous" + (++anonymous_counter);
	return new FunctionDefinition(parent, fn_name, params, body);
}
exports.AnonymousFunction = AnonymousFunction;

function FunctionDefinitionNative (name, params, body) {
	this.fn_name = name;
	this.fn_params = params;
	this.fn_body = body;
}
exports.FunctionDefinitionNative = FunctionDefinitionNative;
