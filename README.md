Lithp
=====

A small Lisp-like programming language, with a small interpreter.
-----------------------------------------------------------------

This language borrows some ideas from Lisp (functional programming, the
function call syntax itself) but is designed around a small interpreter to
carry out the basic execution, and builtin library functions to provide
control flow, function definitions, and basic arithmatic and similar
operations.

It aims to provide a basic framework as powerful as JavaScript. Much of this
is accomplished through the use of native Lithp [modules](https://github.com/andrakis/node-lithp/tree/master/modules)
and some powerful builtin functions allowing use of native Node.js modules.

An online [web IDE](http://webide.sharafi.me) is available for running Lithp code in your browser. Parts of the web IDE are written in Lithp.

The [main interpreter](https://github.com/andrakis/node-lithp/blob/master/lib/interpreter.js) is around 270 lines of sparse code.
This size would be even lower without the
debug statements and detailed comments.

Language Examples
=================

More examples are in the [samples](https://github.com/andrakis/node-lithp/tree/master/samples) directory.

Simple test
-----------

Print a string.

	((set Test "test")
	 (print "Test: " Test))

[Try it online!](https://andrakis.github.io/lithp-webide/?code=JSBQcmludCBhIHN0cmluZy4KKAogICAgKHNldCBUZXN0ICJ0ZXN0IikKICAgIChwcmludCAiVGVzdDogIiBUZXN0KQopCg==)

Simple function
---------------

Define a simple function and call it.

	((def add #A,B :: ((+ A B)))
	 (print "Add 5+10: " (add 5 10)))

[Try it online!](https://andrakis.github.io/lithp-webide/?code=JSBEZWZpbmUgYSBzaW1wbGUgZnVuY3Rpb24gYW5kIGNhbGwgaXQuCigKICAgIChkZWYgYWRkICNBLEIgOjogKCgrIEEgQikpKQogICAgKHByaW50ICJBZGQgNSsxMDogIiAoYWRkIDUgMTApKQopCg==)

Multiple functions and logic
----------------------------

Define two functions and use comparison logic to print a message
based on the input.

	(
		(def is_zero #N :: ((== 0 N)))
		(def test #N :: (
			(if (is_zero N) (
				(print "N is zero")
			) (else (
				(print "N is not zero, it is: " N)
			)))
		))
		(test 1)
		(test 0)
	)

[Try it online!](https://andrakis.github.io/lithp-webide/?code=JSBEZWZpbmUgdHdvIGZ1bmN0aW9ucyBhbmQgdXNlIGNvbXBhcmlzb24gbG9naWMgdG8gcHJpbnQgYSBtZXNzYWdlCiUgYmFzZWQgb24gdGhlIGlucHV0LgooCiAgICAoZGVmIGlzX3plcm8gI04gOjogKCg9PSAwIE4pKSkKICAgIChkZWYgdGVzdCAjTiA6OiAoCiAgICAgICAgKGlmIChpc196ZXJvIE4pICgKICAgICAgICAgICAgKHByaW50ICJOIGlzIHplcm8iKQogICAgICAgICkgKGVsc2UgKAogICAgICAgICAgICAocHJpbnQgIk4gaXMgbm90IHplcm8sIGl0IGlzOiAiIE4pCiAgICAgICAgKSkpCiAgICApKQogICAgKHRlc3QgMSkKICAgICh0ZXN0IDApCikK)

A recursive function
--------------------

Define a recursive function that calculates the factorial of the
given number, and call it.

	((def fac #N :: (
		(if (== 0 N) (1)
			(else ((* N (fac (- N 1)))))
		)
	))
	(set Test 10)
	(print "factorial of " Test ": " (fac Test)))

[Try it online!](https://andrakis.github.io/lithp-webide/?code=JSBEZWZpbmUgYSByZWN1cnNpdmUgZnVuY3Rpb24gdGhhdCBjYWxjdWxhdGVzIHRoZSBmYWN0b3JpYWwgb2YgdGhlCiUgZ2l2ZW4gbnVtYmVyLCBhbmQgY2FsbCBpdC4KKAogICAgKGRlZiBmYWMgI04gOjogKAogICAgICAgIChpZiAoPT0gMCBOKSAoMSkKICAgICAgICAgICAgKGVsc2UgKCgqIE4gKGZhYyAoLSBOIDEpKSkpKQogICAgICAgICkKICAgICkpCiAgICAoc2V0IFRlc3QgMTApCiAgICAocHJpbnQgImZhY3RvcmlhbCBvZiAiIFRlc3QgIjogIiAoZmFjIFRlc3QpKQopCg==)

A tail recursive function
-------------------------

Tail recursion is implemented via the builtin recurse/* function.

	((def fac-recursive #N :: (
		(def inner #N,Acc :: (
			(if (== 0 N) (
				(Acc)
			) (else (
				(recurse (- N 1) (* N Acc))
			)))
		))
		(inner N 1)
	))
	(print (fac-recursive 50)))

[Try it online!](https://andrakis.github.io/lithp-webide/?code=JSBUYWlsIHJlY3Vyc2lvbiBpcyBpbXBsZW1lbnRlZCB2aWEgdGhlIGJ1aWx0aW4gcmVjdXJzZS8qIGZ1bmN0aW9uLgooCiAgICAoZGVmIGZhYy1yZWN1cnNpdmUgI04gOjogKAogICAgICAgIChkZWYgaW5uZXIgI04sQWNjIDo6ICgKICAgICAgICAgICAgKGlmICg9PSAwIE4pICgKICAgICAgICAgICAgICAgIChBY2MpCiAgICAgICAgICAgICkgKGVsc2UgKAogICAgICAgICAgICAgICAgKHJlY3Vyc2UgKC0gTiAxKSAoKiBOIEFjYykpCiAgICAgICAgICAgICkpKQogICAgICAgICkpCiAgICAgICAgKGlubmVyIE4gMSkKICAgICkpCiAgICAocHJpbnQgKGZhYy1yZWN1cnNpdmUgNTApKQopCg==)

List comprehension
------------------

List comprehension is provided by the `lists` module. Here is an example usage:

	Code:
		(import lists)
		% Supply 3 generators
		(set Generators (list (seq 1 10) (seq 1 5) (seq 1 3)))
		% Handler simply returns a list of given numbers
		(set Handler #X,Y,Z::((list X Y Z)))
		% Filter checks that X, Y, and Z are divisible by two using modulo (@).
		(set Filter #X,Y,Z::((and (== 0 (@ X 2)) (== 0 (@ Y 2)) (== 0 (@ Z 2)))))
		(print "List comprehension test: " (lcomp Handler Generators Filter))
	Output:
		List comprehension test:  [ [ 2, 2, 2 ],
		  [ 2, 4, 2 ],
		  [ 4, 2, 2 ],
		  [ 4, 4, 2 ],
		  [ 6, 2, 2 ],
		  [ 6, 4, 2 ],
		  [ 8, 2, 2 ],
		  [ 8, 4, 2 ],
		  [ 10, 2, 2 ],
		  [ 10, 4, 2 ] ]

[Try it online!](https://andrakis.github.io/lithp-webide/?code=JSBMaXN0IGNvbXByZWhlbnNpb24gaXMgcHJvdmlkZWQgYnkgdGhlIGBsaXN0c2AgbW9kdWxlLiBIZXJlIGlzIGFuIGV4YW1wbGUgdXNhZ2U6CigKICAgIChpbXBvcnQgbGlzdHMpCiAgICAlIFN1cHBseSAzIGdlbmVyYXRvcnMKICAgIChzZXQgR2VuZXJhdG9ycyAobGlzdCAoc2VxIDEgMTApIChzZXEgMSA1KSAoc2VxIDEgMykpKQogICAgJSBIYW5kbGVyIHNpbXBseSByZXR1cm5zIGEgbGlzdCBvZiBnaXZlbiBudW1iZXJzCiAgICAoc2V0IEhhbmRsZXIgI1gsWSxaOjooKGxpc3QgWCBZIFopKSkKICAgICUgRmlsdGVyIGNoZWNrcyB0aGF0IFgsIFksIGFuZCBaIGFyZSBkaXZpc2libGUgYnkgdHdvIHVzaW5nIG1vZHVsbyAoQCkuCiAgICAoc2V0IEZpbHRlciAjWCxZLFo6OigoYW5kICg9PSAwIChAIFggMikpICg9PSAwIChAIFkgMikpICg9PSAwIChAIFogMikpKSkpCiAgICAocHJpbnQgIkxpc3QgY29tcHJlaGVuc2lvbiB0ZXN0OiAiIChsY29tcCBIYW5kbGVyIEdlbmVyYXRvcnMgRmlsdGVyKSkKKQ==)

Running some sample code
========================

You have four options:

  * The online Web IDE

     An [IDE capable of running Lithp code](https://andrakis.github.io/lithp-webide) directly is available.

  * The online REPL

     A REPL is [available online](https://andrakis.github.io/lithp/) that will run basic code snippits. This does not yet support running an entire script.

  * The console REPL

     The REPL, or Read Execute Print Loop, is available in the top level directory. To start it invoke:

		./repl          or
		./repl.lithp

  * Run a script file

     Use the file `run.js` in the top level directory, and specify a path to a Lithp
     source file. There are [several provided](https://github.com/andrakis/node-lithp/tree/master/samples) that work with the current parser.

    To run the [factorial example](https://github.com/andrakis/node-lithp/blob/master/samples/factorial.lithp):

    ```
        node run.js samples/factorial.lithp
    ```

    You can see the internals of what the parser and interpreter are doing by passing
    the `-d` flag to run.js to enable debug mode. This prints out a tree of function
    calls, allowing you to follow the interpreters call sequence.

Language Status
===============

Version: 0.24.0 (STABLE)
---------------------

A [web IDE](http://webide.sharafi.me) is available for developing in your browswer. (A backup is also [available](https://andrakis.github.io/lithp-webide).)

Currently the language can run hand-compiled code or use the Bootstrap Parser
for a fairly feature-complete compilation experience. The parser does not
currently supports all the constructs it should - these are being corrected
as they are found.

Modules are supported, and a standard library is starting to be expanded upon.
For more information on modules, see the [module](https://github.com/andrakis/node-lithp/blob/master/samples/module.lithp) example for how functions may be defined, exported,
and imported.

See `run.js` or the `Running some sample code` section for information on how
to run existing examples of Lithp code, parsed by the Bootstrap Parser.

The Bootstrap Parser or Platform V0 Parser is written in JavaScript for
quick implementation. See the `Longterm goals` section for information about
the design of a new parser, implemented in Lithp.

The Bootstrap Parser is very simple and will not protect you from simple mistakes
like too many closing brackets. It also gets tripped up over some slight syntax
issues, but the basic framework implemented should allow for all of these to be
corrected.

Implemented milestones
----------------------

* Lithp in the browser

  * [lithp-pkg](https://github.com/andrakis/lithp-pkg) has been used to package all of Lithp up into a set of files that browserify can use.

  * [Online web IDE](https://andrakis.github.io/lithp-webide), developed using [lithp-webide](https://github.com/andrakis/lithp-webide).

* Parsing

  * Serialization of compiled OpChains to AST. Allows for other Lithp interpreters to run parsed code. (A C# interpreter is in progress.)

  * AST parsing and compilation has been implemented.

  * This allows faster script startup, and allows packaging the entire project using browserify.

* Modules

  * A list comprehension function, `lcomp`, is available in the [lists module](https://github.com/andrakis/node-lithp/blob/master/modules/lists.lithp)

  * The same module also provides a flat-map function.

  * Lists module has been improved with use of recursive functions.

* REPL

  * An online REPL is [available](https://andrakis.github.io/lithp/)

  * A REPL is available for Node.js. Simply run `./repl` to start it. Type `?` for help.

* Language enhancements

  * Package the REPL using browserify to provide an online interpreter. (see [lithp-pkg](https://github.com/andrakis/lithp-pkg))

  * Implemented `recurse/*`, enabling tail recursion.

  * Implemented `while/2`, enabling non-recursive looping.

  * The lists module has been rewritten to use `while/2`, resulting in much less
    memory usage and improved runtime speed.

  * Moved many functions from `Platform V1` to standard builtin library.

  * Added many math builtins.

  * Added missing regex test function (`test/2`)

  * Added `env/0`, `argv/0`, `cwd/0` for command line information.

  * Added number parsing: `parse-float/1`, `parse-int/1`

  * Added `eval/1` allowing runtime code evaluation using the Bootstrap Parser.
    Also adds `eval/*` for providing additional variables.

  * Added `chr/1` and `asc/1` for converting to and from character codes and strings.

* Debugging enhancements

  * User defined functions now have a readable name, resulting in much more readable
    debug output.

  * The spacing and depth indications have been corrected and are now more consistent.

  * No longer prints known symbol names when a symbol is not found. This was proving to
    be too useless.

* BootStrap Parser

  * This basic parser, written in JavaScript, is able to convert scripts to the
    OpChains the interpreter needs.

  * It is designed to be powerful enough to parse enough Lithp code with which
    to implement a better parser. To this end, there are numerous [examples](https://github.com/andrakis/node-lithp/tree/master/samples)
    demonstrating the language and what the parser is capable of parsing.

  * It is considered feature complete. Only bugfixes are to be implemented.

  * Future parsing work is to be done on the Platform V1 parser, implemented
    in Lithp and parsed by this parser. This should make maintenance and enhancements
    easier to implement.

  * Now recognises a number of builtin functions and saves runtime speed by resolving
    these to arity star functions during parsing.

  * Floating point numbers now work correctly, as does \t escape sequence.

  * Issues parsing tabs and newlines corrected.

* Module system

  * Allows scripts to import another module. Imported module is parsed by
    the BootStrap parser and all functions run in their own instance of Lithp.

  * A small standard library is provided. This is being expanded upon.

  * Modules can define their own functions, call any function they want, and
    export defined functions.

  * Scripts that import modules add them to their function definition tree.

  * Imported functions run in the new instance, retaining access to all their
    own functions and variables.

  * Scripts that call imported functions can be passed any Lithp object,
    including anonymous functions.

  * When passed anonymous functions will, like the imported module functions,
    run in the instance of the interpreter in which they were defined. This
    retains their access to all defined functions and variables.

  * Enhanced import/1 to search a set of module paths, allowing for greater
    flexibility.

  * Several standard modules are now provided

  * Added `import-instance/1` which retains the old behaviour of `import/1`.
    `import/1` no longer imports modules into a new instance.

* Speed improvements

  * A number of enhancements have been made that improve the runtime speed
    of the language. These include quicker name lookups, caching of arity
    star functions once recognised, and strict mode.

  * Strict mode is now implemented across all files.

Short term goals
----------------

* Implement a Lithp package system with library dependancies.

* Expand the standard module library.

* The language is considered powerful enough and feature complete that
  personal work has begun on new projects using Lithp as their base language. These are all works in progress.

  * [Livium](https://github.com/andrakis/lithp-livium) - an implementation of Vi in Lithp.

  * [Lithp-pkg](https://github.com/andrakis/lithp-pkg) - package Lithp into a browserified file.

  * [Lithp-webide](https://github.com/andrakis/lithp-webide) - an IDE for the browser supporting Lithp.

  * [Dungeons of Lithp](https://github.com/andrakis/lithp-dol) - a MUD-style dungeon crawler.

Longterm goals
--------------

These features are desired, but may be a long time coming.

* Platform V1: Parser

	The new native parser will feature more language features, including the ability
	to alter the parser itself at runtime, allowing completely new features to be
	implemented at runtime.

Design
======

The basic syntax is very Lisp-like, however it has its own runtime library
that uses much different names, design, and implementation. For instance, the
Lithp code is broken down in OpChains, function calls, and literal values, and
these are interpreted to run the program. In comparison, Lisp implementations
often use a low level virtual machine or compiles your code to an executable.

It also borrows some core ideas from Erlang:

	* Tuples:                       {val1, val2, ...}
	* Atoms:                        lowercase-Start-Is-Atom
	* Quoted Atoms:                 'A quoted atom'
	* Variables:                    StartWithUpperCase
	* Functions include arity:      (def add/2 #A,B :: ((+ A B)))
	                                Note that if not provided, this is
	                                automatically added according to the
	                                number of parameters the function takes.
	                                All functions in the definition table
	                                have the arity in their name.
	* Modules can export functions: (export add/2 divide/2)
	* Scripts can import modules:   (import "lib")
	                                Note that Erlang expects a list of function
	                                arity definitions for importing, whereas
	                                all exported functions are imported here.


However, features such as destructive assignment are present, which differs
from Erlang. A number of other useful features such as pattern matching,
list comprehension, binary buffers are implemented as modules.

Additionally, one may define functions with an arity of *, which
passes all parameters in the first parameter:

	((def count_params/* #List :: ((print "You gave me " (length List) " parameters")))
	 (count_params 1 2 3 atom "string" 'quoted atom' #N :: ("anonymous function")))

Other features are available in many other languages. The prime one of these
is the functional programming approach. All functions return the value of the
last executed function call, even if there are multiple function calls
preceding it.

All Lithp functions are implemented as anonymous functions, which allows you
to assign them to variables, provide them as function arguments, and call them
using the `call` function. The builtin `def` function adds anonymous functions
to a closure table allowing them to be called at runtime by name. All builtins
are also added to this table, making them indistuinguisable from user defined
functions.

Variable scoping (closures) is somewhat implemented, but none yet to liking.
Presently, one needs to call the `scope/1` function. This takes an anonymous
function as its parameter, and returns a callable function which retains
access to the scope in which it was defined. Ideally this would be implemented
as a parser feature.

A standard Lithp script compiles to an OpChain, which contains function calls,
literal values, and potentially more OpChains with the same.

A simple program:

	((print "Hello, world!"))

This is an OpChain consisting of a single function call, with a single literal
value as a parameter. Parameters are separated by spaces, and the function name
appears as the first token after the opening bracket. Any function currently
defined by builtins or using the def/2 function is callable in this way.

Other functions, such as those assigned to variables, must be called with the
call/* function.

Each function call may itself have additional function calls for the values of
the parameters. These are parsed first, and this process repeats recursively
until all parameters for the current function call have been resolved. This
usually involves calling intermediate functions, which repeat the same process.
This is the meat of the language.

	 ((def add #A,B :: ((+ A B)))
	  (print "Add 5+10: " (add 5 10)))

This simple design, consisting of only nested function calls and literal values,
allows for a very simple interpreter that can implement powerful constructs.

Lithp functions are always anonymous, take a certain number of parameters (in
the above example, A and B), and assign this anonymous function to an atom in
the current closure, allowing it to be called like other inbuilt functions.

When functions are set in the closure, they include in their name the arity of
the function. This is either a zero-or-positive-number, or * to indicate the
function takes an unlimited number of parameters. In the case of arity * all
arguments are passed in the first parameter of the function.

Print itself is an arity * builtin runtime function defined in JavaScript.
Most low level functions are provided in JavaScript, such as basic control
flow, comparison, assignment and retrieval, and defining new functions in the
Lithp language itself.

The runtime library is fairly small, aiming for a very basic but usable
set of functions that can implement most algorithms.
More advanced functionality is provided by additional libraries, such as
with Platform V1 which has functions for manipulating native Lithp types
(for creating and filling OpChains.)

Some functions are provided for readability, such as in an if construct:

		(if (== 0 N) (1)
			(else ((* N (fac (- N 1)))))
		)

In this case, else is just a function that calls the given function chain.
It could be ommitted, but it provides better readability in a language that
is very terse.

Modules
=======

Modules allow functions from one script to be exported to another script.

An example is provided, consisting of a [module](https://github.com/andrakis/node-lithp/blob/master/samples/module_lib.lithp) and a [script](https://github.com/andrakis/node-lithp/blob/master/samples/module.lithp) to call it.

The module is a standard Lithp script that contains calls to export/* to
note symbols to export:

	% lib.lithp
	((def add #A,B :: ((+ A B)))
	 (export add/2))

A different Lithp script may then use import/1 to bring all exported
definitions into the running script's closure:

	% main.lithp
	((import "lib")
	 (print "2+2:" (add 2 2)))

However, a key point is that imported functions run in a different instance
of the interpreter, allowing them to perform their own runtime logic completely
independent of the script that imported it.

Since variables and function calls are resolved prior to calling a function, one
may call an imported function and provide it parameters and callbacks native to
the a different instance of the Lithp interpreter than the module.

To put it another way, module functions run in their own instance, but you can pass
them any usual value, including callbacks that retain access to defined values.

Syntax Highlighting
===================

See the directory `syntax` for Lithp syntax files.

The following syntax files are provided:

* EditPlus

   Standard EditPlus syntax file. Seems to work correctly.

* VIM

   Based upon the Lisp syntax file. The author's understanding of VIM syntax files
   is not very good, hence it doesn't do everything correctly.
