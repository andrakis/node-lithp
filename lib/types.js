/**
 * Provide the basic Lithp structure types used by the interpreter.
 */

var util = require('util'),
    inspect = util.inspect;

function AtomValue (value, name) {
	this.value = value;
	this.type = 'Atom';
	this.name = name;
}
// This must not be changed, as it becomes the key for function names.
AtomValue.prototype.toString = function() {
	return this.name;
};

var atoms = {};
var atomid = 0;
function Atom (name) {
	if(!atoms[name]) {
		var atom = new AtomValue(++atomid, name);
		atoms[name] = atom;
		atoms[atomid] = atom;
	}
	return atoms[name];
}

exports.Atom = Atom;

exports.GetAtoms = () => atoms;

function Tuple () {
	this.value = Array.prototype.slice.call(arguments);
	this.length = this.value.length;
	this.type = 'Tuple';
	// Make all tuple items available via [index]
	for(var i = 0; i < this.value.length; i++)
		this[i] = this.value[i];
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
	//console.log("(Setting locally: " + name + " =", value, ")");
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
OpChainClosure.prototype.getDefined = function(depth) {
	if(depth === undefined)
		depth = 1;
	
	var result = {};
	for(var k in this.closure)
		result[k] = this.closure[k];
	if(--depth > 0 && this.parent) {
		var parentDefines = this.parent.getDefined(depth);
		for(var k in parentDefines)
			result[k] = parentDefines[k];
	}

	return result;
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
	var ops = [];
	this.ops.forEach(Op => {
		ops.push(Op.toString());
	});
	return "OpChain [" + ops.join(',') + "]";
};
OpChain.prototype.call = function(variables) {
	var non_imm = new OpChain();
	non_imm.parent = this.parent;
	non_imm.ops = this.ops;
	non_imm.closure = new OpChainClosure(this, this);
	non_imm._set_variables(variables);
	non_imm.non_immediate = false;
	return non_imm;
};
OpChain.prototype.call_immediate = function(variables) {
	var imm = new OpChain();
	imm.parent = this.parent;
	imm.ops = this.ops;
	imm.closure = new OpChainClosure(this, this);
	imm._set_variables(variables);
	imm.immediate = true;
	return imm;
};

OpChain.prototype._set_variables = function(variables) {
	variables = variables || {};
	for(var name in variables)
		this.closure.set_immediate(name, variables[name]);
};

exports.OpChain = OpChain;

function LiteralValue (value) {
	this.value = value;
	this.type = typeof value;
}
LiteralValue.prototype.toString = function() {
	return inspect(this.value);
};
exports.LiteralValue = LiteralValue;

function VariableReference (name) {
	this.ref = name;
}
VariableReference.prototype.toString = function() {
	return this.ref;
};
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
FunctionCall.prototype.toString = function() {
	return "FnCall " + this.fn_name;
};
exports.FunctionCall = FunctionCall;

function FunctionReentry (name, params) {
	return new FunctionCall(name, params, true);
}
exports.FunctionReentry = FunctionReentry;

function FunctionDefinition (parent, name, params, body) {
	if(arguments.length > 0) {
		this.fn_name = name;
		this.fn_params = params;
		this.fn_body = new OpChain(parent, body);
		var m = name.match(/\/(\d+|\*)$/);
		if(!m)
			throw new Error("Could not parse function name for arity: " + inspect(name));
		this.arity = m[1] == '*' ? '*' : parseInt(m[1]);
	}
}
FunctionDefinition.prototype.clone = function() {
	var obj = new FunctionDefinition();
	obj.fn_name = this.fn_name;
	obj.fn_params = this.fn_params;
	obj.fn_body = this.fn_body.call();
	obj.arity = this.arity;
	return obj;
};
FunctionDefinition.prototype.toString = function() {
	return "(FnDef:" + this.fn_name + ", " + (this.scoped ? "scoped, " : "") +
		"params: " + inspect(this.fn_params) +
		", body: " + this.fn_body.ops + ")";
};
exports.FunctionDefinition = FunctionDefinition;

var anonymous_counter = 0;
function AnonymousFunction (parent, params, body) {
	// Anonymous functions cannot have arity *
	var fn_name = "__anonymous" + (++anonymous_counter) + "/" + params.length;
	return new FunctionDefinition(parent, fn_name, params, body);
}
exports.AnonymousFunction = AnonymousFunction;

function FunctionDefinitionNative (name, params, body) {
	this.fn_name = name;
	this.fn_params = params;
	this.fn_body = body;
	var m = name.match(/\/(\d+|\*)$/);
	if(!m)
		throw new Error("Could not parse function name for arity: " + inspect(name));
	this.arity = m[1] == '*' ? '*' : parseInt(m[1]);
}
exports.FunctionDefinitionNative = FunctionDefinitionNative;
