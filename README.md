Lithp
=====

A small Lisp-like programming language, with a very small interpreter.
----------------------------------------------------------------------

This language borrows some ideas from Lisp (functional programming, the
function call syntax itself) but is designed around a small interpreter to
carry out the basic execution, and builtin library functions to provide
control flow, function definitions, and basic arithmatic and similar
operations.

It aims to provide a basic framework as powerful as JavaScript. To this end,
one of the current features is the abililty to import Node.js modules, call
the imported functions passing native Lithp values, and provide a "bridge"
function to allow functions that require JavaScript callbacks to be used with
Lithp functions directly.

The [readfile example](https://github.com/andrakis/node-lithp/blob/master/l_src/readfile.lithp) demonstrates all of the above features, importing the
Node.js `fs` module, and calling `fs.readFileSync` and `fs.readFile` using a
callback and a Lithp function to print the results.

The main interpreter is just under 350 lines of sparse code (not counting
structures and runtime library.) This size would be even lower without the
debug statements and detailed comments.

Language Status
===============

Version: 0.5
------------

Currently the language can run hand-compiled code or use the Bootstrap Parser
for a fairly feature-complete compilation experience. The parser does not
currently supports all the constructs it should - these are being corrected
as they are found.

See `run.js` or the `Running some sample code` section for information on how
to run existing examples of Lithp code, parsed by the Bootstrap Parser.

The Bootstrap Parser or Platform V0 Parser is written in JavaScript for
quick implementation. See the `Longterm goals` section for information about
the design of a new parser, implemented in Lithp.

The Bootstrap Parser is very simple and will not protect you from simple mistakes
like too many closing brackets. It also gets tripped up over some slight syntax
issues, but the basic framework implemented should allow for all of these to be
corrected.

Shorterm goals
--------------

These features are presently being worked on.

* A module system is being worked on. (2.5 / 6 goals reached)

  * Allows scripts to import another module. This will parse and compile the
    module in a new interpreter instance. (Implemented)

  * Modules can define their own functions, call any function they want, and
    export defined functions. (Implemented)

  * Scripts that import modules add them to their function definition tree.

  * Imported functions run in the new instance, retaining access to all their
    own functions and variables. (Partially implemented)

  * Scripts that call imported functions can be passed any Lithp object,
    including anonymous functions.

  * When passed anonymous functions will, like the imported module functions,
    run in the instance of the interpreter in which they were defined. This
    retains their access to all defined functions and variables.

Longterm goals
-------------- 

These features are desired, but may be a long time coming.

* Platform V1: Parser

	The new native parser will feature more language features, including the ability
	to alter the parser itself at runtime, allowing completely new features to be
	implemented at runtime.

Running some sample code
========================

Use the file `run.js` in the top level directory, and specify a path to a Lithp
source file. There are [several provided](https://github.com/andrakis/node-lithp/tree/master/l_src) that work with the current parser.

To run [the factorial example](https://github.com/andrakis/node-lithp/blob/master/l_src/factorial.lithp):

```
	node run.js l_src/factorial.lithp
```

You can see the internals of what the parser and interpreter are doing by passing
the `-d` flag to run.js to enable debug mode. This prints out a tree of function
calls, allowing you to follow the interpreters call sequence.

Design
======

The basic syntax is very Lisp-like, however it has its own runtime library
that uses much different names, design, and implementation. For instance, the
Lithp code is broken down in OpChains, function calls, and literal values, and
these are interpreted to run the program. In comparison, Lisp implementations
often uses a low level virtual machine or compiles your code to an executable.

It also borrows from Erlang, in that it supports the following constructs:

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

However, features such as destructive assignment are present, which differs
from Erlang. Additionally, one may define functions with an arity of *, which
passes all parameters in the first parameter:

	((def count_params/* #List :: ((print "You gave me " (length List) " parameters")))
	 (count_params 1 2 3 atom "string" 'quoted atom' #N :: ("anonymous function")))

Other features are available in many other languages. The prime ones of these
is the functional programming approach. All functions return the value of the
last executed function call, even if there are multiple function calls
preceding it.

All Lithp functions are implemented as anonymous functions, which allows you
to assign them to variables, provide them as function arguments, and call them
using the call/* function.

Variable scoping (closures) is somewhat implemented, but none yet to liking.
Presently, one needs to call the scope/1 function. This takes an anonymous
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

Examples
========

Some following examples are implemented in `lib/samples.js`.

The rest of the examples are in the [l_src](https://github.com/andrakis/node-lithp/tree/master/l_src) directory.

It shows how the following examples are constructed for
running in the interpreter. The file `test.js` uses the
recursive factorial example.

To see further into the details of the interpreter, edit
the file `lib/lithp.js` and set the `debug` flag to true.
The output will include function calls and stack depth.

Simple test
-----------

Print a string.

	((set Test "test")
	 (print "Test: " Test))


Simple function
---------------

Define a simple function and call it.

	((def add #A,B :: ((+ A B)))
	 (print "Add 5+10: " (add 5 10)))


Multiple functions and logic
----------------------------

Define two functions and use comparison logic to print a message
based on the input.

	(
		(def is_zero#N :: ((== 0 N)))
		(def test#N :: (
			(if (is_zero N) (
				(print "N is zero")
			) (else (
				(print "N is not zero, it is: " N)
			)))
		))
		(test 1)
		(test 0)
	)

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
		(print "factorial of " Test ": " (fac Test))
	)

Read a file
-----------

Note: this example is further demonstrated in [l_src/readfile.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/readfile.lithp),
and relies on functions provided by Platform 1.

Additionally, it is using the Node.js API. It will be replaced with native
functions in the future.

	(
		% The require/1 function requires Platform V1 functionality.
		(var Fs (require "fs"))
		(var FsReadFile (dict-get Fs "readFile"))
		(print "readFile:" (inspect FsReadFile))
		(var Our_callback (js-bridge #Err,Data :: (
			(print "Err:  " Err)
			(print "Data: " Data)
		)))
		% You can call FsReadFile using call (a standard builtin.)
		(call FsReadFile "index.js" Our_callback)
	)


Syntax Highlighting
===================

See the directory `syntax` for Lithp syntax files.

Presently, only EditPlus syntax files are provided. Submissions for
syntax files for other popular editors welcome. In particular, a VI
syntax file would be a great addition.

