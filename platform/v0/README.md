Parser version 1 (Platform version 0)
=====================================

TODO: The formatting is probably incorrect. View in a fixed-width font for best
      results.

This initial parser will be very simple, and will emit an OpChain after parsing
a string.

The current language design is very simple. Function calls perform all of the
work, but have to be passed the current values. Each parameter is separated by
a space. The only known language constructs are:

* OpChains (containing closures and the function calls to run)

* Atoms

* Literal values (1, "Test", an OpChain)

* VariableReference's

* Function Calls

Each new FunctionCall often passes an OpChain (such as when using if/3), so the
parser creates new OpChains parented to the current OpChain. This is the same
approach used in the current samples (`lib/samples.js`) to provide subsequent
OpChains access to parameters and variables. An OpChain may contain many
OpChains in its list of ops, and these are evaluated recursively in the
interpreter.

All other important features are implemented as FunctionDefinitionNative in
the parent language, and provide basic arithmatic, control flow, and utility
functions. The parser provides its own additional runtime, in hand-compiled
Lithp.

Platform version 1 will re-implement the parser and provide additional runtime
modules, however large parts will be written in Lithp and parsed by this parser.
This will make it much easier to maintain.

Platform version 0 is therefore more of a bootstrap to allow compilation of the
basic language from source files to OpChains.

Platform version 1 will be the intended end-user experience for using the language,
and contain a REPL environment, compilation from source to loadable object, and
a standard API, all implemented in the language itself (!).

Because the design of the BootStrap parser is so simple, error reporting is
minimal and only a few constructs are to be supported. These are enough to
implement all of the current examples:

* Call a function and parse the parameters:

	(print "Hello") -> new FunctionCall("print/1", [new LiteralValue("Hello")])

* Recursively perform this for additional function calls:

	(print "5+10:" (+ 5 10)) ->
		new FunctionCall("print/2", [
			new LiteralValue("5+10:"),
			new FunctionCall("+/2", [new LiteralValue(5), new LiteralValue(10)])
		])

* Understand the following:

	** Lowercase and most other non-alphanumeric symbols represent atoms. However,
	   if they are the first argument in the parser's chain, it is considered to be
	   a function call and converted to a string with the arity of parameters given
	   to it.

		'test'   -> Atom('test')
		test     -> Atom('test')
		foo-bar  -> Atom('foo-bar')
		+        -> Atom('+')
		(+ 1 2)  -> new FunctionCall("+/2", [new LiteralValue(1), new LiteralValue(2)])
		(foo bar)-> new FunctionCall("foo/1", [Atom("bar")])
```
		(def multi_args/* #Args :: (do-something Args)) ->
			new FunctionCall("def/2", [
				new Atom("multi_args/*"),
				new AnonymousFunction(current_chain, ["Args"], new OpChain(
					current_chain,
					new FunctionCall("do-something/1", [new VariableReference("Args")])
				))
			])
```

	** Strings
	
		"Test"   -> new LiteralValue("Test")

	** Numbers

		1        -> new LiteralValue(1)
		1.00     -> new LiteralValue(1.00)

	** VariableReferences
	
		** Variables always start with an uppercase letter.

		** When used in set/2 and get/1:

			(set Test 0) -> new FunctionCall("set/2", [
				new VariableReference("Test"),
				new LiteralValue(0)
			])
			(get Test) -> new FunctionCall("get/1", [new VariableReference("Test")])

		** When used anywhere else, automatically convert to get/1 calls:
		
			(+ A 1) -> new FunctionCall("+/2", [new FunctionCall("get/1", [
				new VariableReference("A")
			]),
				new LiteralValue(1)
			])

	** Anonymous function definitions:

		** Syntax:  #(Param List) :: Body

		** (Param List) is zero or more comma-separated variables (ie, start with uppercase)

		** If function name contains arity, then the atom will include the arity.

			(def foo/* #Args :: (...))

		** Example:

			(def add #A,B :: ((+ A B))) ->

				new FunctionCall("def/2", [new Atom("add"),
					new AnonymousFunction(current_chain, ["A", "B"], new OpChain(
						current_chain, [
							new FunctionCall("+/2", [
								new FunctionCall("get/1", [new VariableReference("A")]),
								new FunctionCall("get/1", [new VariableReference("B")])
							])
						]
					))
				])
