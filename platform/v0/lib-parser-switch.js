/**
 * Provides:
 *  - switch/*
 *  - case/2
 *  - default/1
 *
 * This is implemented in hand-compiled Lithp, and tries to use as little
 * FunctionDefinitionNative calls as possible. The more that can be
 * implemented in the language itself, the better.
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

function lib_case (lithp) {
	/**
	 (
		% For use with switch/*, a case statement that returns a function that
		% is called by switch/*, and if the Value given by switch/* matches,
		% {ok, Result} is returned. Otherwise {false} is returned.
		(def case #Eq,Result :: (
			% Ignore:
			% // Return a function that retains access to the outside closure
			% // variables (Eq and Result) to perform a comparison.
			% // This is a little convoluted because we need to ensure a new
			% // closure is generated that has access to the Eq and Result values.
			%
			% //If we did not do this, we may end up using old values of Eq and Result.
			%
			% TODO: Verify the above logic is correct. Since each call is already in
			%       a new OpChain, it should retain access to the variables.
			#Value :: (
				(if (== Eq Value) ((tuple ok Result))
					(else (tuple false))
				)
			)
		))
	 )
	*/
}

function lib_default (lithp) {
	/**
		% For use with switch/*, a default value if no matching cases are found.
		(def default #Result :: (tuple default Result))
	**/
}

function lib_switch_inner (chain) {
	/*
		(def _switch_inner #Possibility :: (
			% Use call/* to call the provided function with one parameter.
		// Value comes from chain
			(var Result (call Possibility Value))
			(if (== (tuple-get Result 0) ok) (Result)
				(else (
					(if (== (tuple-get Result 0) default) (
							(set Default (tuple-get Result 1))
						) (else ((tuple false)))
					)
				))
			)
		))
	 */
}

function lib_switch_loop (chain) {
	/**
		(def _switch_loop #List :: (
			(if (== 0 (length List)) (
				(tuple notfound)
			) (else (
				(var Head (head List))
				(var Tail (tail Possibiilties))
				(var Test (call _switch_inner Head))
				(if (== (tuple-get Test 0) ok) (Test)
					(else (
						% Must be tuple false
						% Could skip this check
						(assert (== (tuple-get Test 0) false))
						% Call recursively to check the rest
						(call _switch_loop Tail)
					))
				)
			)))
		))
	*/
}

function lib_switch (lithp) {
	/**
		(def switch/* #Params :: (
			(var Value (head Params))
			(var Possibilities (tail Params))
			% Scope of _switch_inner is this function call
			(var Default nil)
			% Test if the given possibility matches. Also detects the presence
			% of a default clause, and sets Default if found.
(def _switch_inner #Possibility ... from lib_switch_inner.
			% Recursive local function that runs through the list of possibilities,
			% returning {ok, Result} if a match is found, or {notfound}.
(def _switch_loop #List ... from lib_switch_loop
			(var Test (_switch_loop Possibilities))
			(if (== (tuple-get Test 0) notfound) (
				% Not found return Default or nil
				(if (!= Default nil) (Default)
					% Return nil if there is no default tuple found
				    (else (nil))
				)
			) else (
				% Could skip this check
				(assert (== (tuple-get Test 0) ok))
				(tuple-get Test 1)
			))
		)
	*/
}
