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

exports.simple_test_code = function (lithp) {
	/**
	 ((set Test "test")
	  (print "Test: " (get Test)))
	*/
	var chain = new OpChain();
	chain.push(
		new FunctionCall('set/2', [new VariableReference('Test'), new LiteralValue("test")])
	);
	chain.push(
		new FunctionCall('print/2', [new LiteralValue("Test: "), new FunctionCall('get/1', [new VariableReference('Test')])])
	);
	chain.importClosure(lithp.functions);
	//console.log(inspect(chain, {depth:null, colors:true}));
	return chain;
};

exports.simple_test_code2 = function (lithp) {
	/**
	 ((def add #A,B :: ((+ (get A) (get B))))
	  (print "Add 5+10: " (add 5 10))
	 )
	*/
	var chain = new OpChain();
	var add2_params = ["A", "B"];
	var add2_body = new OpChain(chain,
		new FunctionCall('+/2', [new FunctionCall('get/1', [new VariableReference('A')]), new FunctionCall('get/1', [new VariableReference('B')])])
	);
	chain.push(
		new FunctionCall('def/2', [new Atom("add"), AnonymousFunction(chain, add2_params, add2_body)])
	);
	chain.push(
		new FunctionCall('print/2', [new LiteralValue("Add 5+10: "), new FunctionCall('add/2', [new LiteralValue(5), new LiteralValue(10)])])
	);
	chain.importClosure(lithp.functions);
	//console.log(inspect(chain, {depth:null, colors:true}));
	return chain;
}

exports.fac_test_code = function(lithp) {
	/**
	 ((def fac #N :: (
	    (if (== 0 (get N)) (1)
	        (else ((* (get N) (fac (- (get N) 1))))))
	  ))
	  (set Test 10)
	  (print "factorial of " (get Test) ": " (fac (get Test)))
	 )
	*/
	var chain = new OpChain();
	var fac1_body = new OpChain(chain);
	var fac1_body_if_true_body = new OpChain(fac1_body, new LiteralValue(1));
	var fac1_body_if_else_body = new OpChain(fac1_body,
		new FunctionCall("*/2", [
			new FunctionCall("get/1", [new VariableReference("N")]),
			new FunctionCall("fac/1", [
				new FunctionCall("-/2", [
					new FunctionCall("get/1", [new VariableReference("N")]),
					new LiteralValue(1)
				])
			])
		])
	);
	fac1_body.push(
		new FunctionCall("if/3", [
			new FunctionCall("==/2", [
				new LiteralValue(0),
				new FunctionCall("get/1", [new VariableReference("N")])
			]),
			new OpChain(fac1_body, fac1_body_if_true_body.ops),
			new FunctionCall("else/1", [new OpChain(fac1_body, fac1_body_if_else_body.ops)])])
	);
	chain.push(
		new FunctionCall("def/2", [new Atom("fac"), AnonymousFunction(chain, ["N"], fac1_body)])
	);
	chain.push(
		new FunctionCall("set/2", [new Atom("Test"), new LiteralValue(10)])
	);
	chain.push(
		new FunctionCall("print/4", [
			new LiteralValue("Factorial of "),
			new FunctionCall("get/1", [new VariableReference("Test")]),
			new LiteralValue(":"),
			new FunctionCall("fac/1", [new FunctionCall("get/1", [new VariableReference("Test")])])
		])
	);
	//console.log(inspect(chain, {depth:null, colors:true}));
	chain.importClosure(lithp.functions);
	return chain;
};

exports.less_simple_test_code = function (lithp) {
	// TODO: allow VariableReference to be passed around so that
	//       get/1 only has to be called once.
	/**
	 (
	 	(def is_zero#N :: ((== 0 (get N))))
		(def test#N :: (
			(if (is_zero (get N)) (
				(print "N is zero")
			) (else (
				(print "N is not zero, it is: " (get N))
			)))
		))
		(test 1)
		(test 0)
	*/
	var chain = new OpChain();
	var is_zero1_body = new OpChain(chain,
		new FunctionCall("==/2", [new LiteralValue(0), new FunctionCall("get/1", [new VariableReference("N")])])
	);
	var test1_body = new OpChain(chain);
	var test1_body_if_true_body = new OpChain(test1_body, new FunctionCall("print/1", [new LiteralValue("N is zero")]));
	var test1_body_if_else_body = new OpChain(test1_body, new FunctionCall("print/2", [new LiteralValue("N is not zero, it is: "), new FunctionCall("get/1", [new VariableReference("N")])]));
	test1_body.push(
		new FunctionCall("if/3", [new FunctionCall("is_zero/1", [new FunctionCall("get/1", [new VariableReference("N")])]),
		                         new OpChain(test1_body, test1_body_if_true_body.ops),
								 new FunctionCall("else/1", [new OpChain(test1_body, test1_body_if_else_body.ops)])])
	);
	chain.push(
		new FunctionCall("def/2", [new Atom("is_zero"), AnonymousFunction(chain, ["N"], is_zero1_body)])
	);
	chain.push(
		new FunctionCall("def/2", [new Atom("test"), AnonymousFunction(chain, ["N"], test1_body)])
	);
	chain.push(
		new FunctionCall("test/1", [new LiteralValue(1)])
	);
	chain.push(
		new FunctionCall("test/1", [new LiteralValue(0)])
	);
	//console.log(inspect(chain, {depth:null, colors:true}));
	chain.importClosure(lithp.functions);
	return chain;
};


////////////////////////////////////////////////////
// The following is theory that is not currently
// implemented.
////////////////////////////////////////////////////

function listener_code (lithp) {
	/**
	 (
	 	(open-stdin)
		(stdin-add-listener "data" #D :: (
			(print "You entered: [" (trim (tostring (get D))) "]")
		))
	 )
	*/
}

function readline_code (lithp) {
	/**
	(
		(set Readline (require "readline"))
		(set RL (callmember (get Readline) "createInterface" (process-stdin) (process-stdout)))
		(callmember (get RL) setPrompt "guess> ")
		(callmember (get RL) prompt)
		(callmember (get RL) on "line" #Line :: (
			(if (== (get Line) "right") (
				(callmember (get RL) close)
			))
			(callmember (get RL) prompt)
		))
		(callmember (get RL) on "close" # :: (
			(exit 0)
		))
	)
	*/
}

var code = `
(
	% Defines function fac in current OpChain.
	% def/2 is provided with an anonymous function that takes
	% param N.
	(def fac #N :: (
		(if (== (get N) 0) (1)
			% TODO: This is not currently implemented.
			% The interpreter attempts to optimize head recursion.
			% Usually, this call to fac/1 would result in multiple
			% calls to fac/1, all with a new closure / stack
			% (ie, deep calls.)
			% Because the parser recognises we are calling the same
			% function in a head recursive manner, it uses reentry
			% to optimize the call. The value passed to */2 will be
			% a VariableReference("N"), Result_of_HeadRecursion("fac/1", (- N 1)).
			% Each reentry call will return a chain that calculates N
			% to the next literal value by calling (- (current value of N) 1).
			% This means that all functions must eventually return a real value
			% when executed.
			% This is a form of keeping track of an accumulator.
			% It keeps the current stack (that is, */2 N) and reenters
			% fac/1 using the supplied value (result of (- N 1)).
			% When the function no longer attempts to call itself,
			% the pending final chain will be returned and the
			% resulting chain will look like:
			%   (* 3 (* 2 (* 1 (- 2 1))) (- 3 1))
			% for a call to (fac 3).
			% Because these are evaluated as they are called, it keeps
			% stack usage low.
			% Essentially, this inlines the fac/1 call within the
			% function itself, infinitely recursive in a reentrant
			% manner.
			% A head recursive function can therefore call itself
			% an infinite number of times, just as a tail recursive
			% function can.
			% In the future these could be optimized to calculate the
			% result during parsing, optimizing the whole call to the
			% result of the above chain result.
	    	(else ((* (get N) (fac (- (get N) 1)))))
		)
	))
	(print (fac 10))
)
`;


// function test_code (lithp) {
// 	var chain = new OpChain();
// 	var fac1_params = ["N"];
// 	var fac1_body = new OpChain(chain,
// 		new FunctionCall('if/3', [
// 			new FunctionCall('==/2', [
// 				new VariableReference('N'),
// 				new LiteralValue(0)
// 			]),
// 			new OpChain(chain,
// 				new LiteralValue(1)
// 			),
// 			new FunctionCall('else/1', [
// 				new OpChain(chain,
// 					new FunctionCall('*/2',
// 						[
// 							new VariableReference('N'),
// 							new FunctionReentry('fac/1', [
// 								new FunctionCall('-/2', [new VariableReference('N'), new LiteralValue(1)])
// 							])
// 						]
// 					)
// 				)
// 			])
// 		])
// 	);
// 	// def automatically detects arity using AnonymousFunction params data.
// 	// 
// 	chain.push(new FunctionCall("def/2", [new Atom("fac"), AnonymousFunction(chain, ["N"], fac1_body)]));
// 	chain.push(new FunctionCall("print/1", [new FunctionCall("fac/1", [new LiteralValue(10)])]));
// 	chain.importClosure(lithp.functions);
// 	console.log(inspect(chain, {depth:null, colors:true}));
// 	return chain;
// }

