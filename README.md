Lithp
=====

A small Lisp-like programming language, with a very small interpreter.

The main interpreter is just under 300 lines of sparse code (not counting
structures and runtime library.) This size would be even lower without the
debug statements and detailed comments.

A working parser exists, known as the Bootstrap Parser or Platform V0 Parser.
This parser is very simple and will not protect you from simple mistakes like
too many closing brackets. The parser in Platform V1 will be designed with
better parsing and error messages.

See `run.js` or the next section for information on how to run some sample code.

Running some sample code
========================

Use the file 'run.js' in the top level directory, and specify a path to a Lithp
source file. There are 3 provided in `l_src` that work with the current parser.

```
	node run.js l_src/factorial.lithp
```

Design
======

The basic syntax is very Lisp-like, however it has its own runtime library
that uses much different names, design, and implementation. For instance, the
Lithp code is broken down in OpChains, function calls, and literal values, and
these are used to run the program. In comparison, Lisp often uses a low level
virtual machine or assembly language to run your code.

It also borrows from Erlang, in that it supports the following constructs:

	* Tuples: {val1, val2, ...}     (tuple val1 val2 ...)
	* Atoms: lowercase-is-atom      (atom lowercase-is-atom)
	* Variables always start with an uppercase letter

However, features such as destructive assignment are present, which differs
from Erlang.

A standard Lithp script compiles to an OpChain, which contains function calls
and literal values.

A simple program:

	((print "Hello, world!"))

This is an OpChain consisting of a single function call, with a single literal
value as a parameter. Parameters are separated by spaces.

Each function call may itself have additional function calls for the values of
the parameters. This is the meat of the language.

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
with Platform V0 which has a much expanded runtime library building upon
the existing runtime library.

Some functions are provided for readability, such as in an if construct:

		(if (== 0 N) (1)
			(else ((* N (fac (- N 1)))))
		)

In this case, else is just a function that calls the given function chain.
It could be ommitted, but it provides better readability in a language that
is very terse.

Examples
========

The following examples are implemented in `lib/samples.js`.

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

Note: this example is implemented in `platform/v1/parser.js`, and relies on
functions provided by Platform 1.

Additionally, it is using the Node.js API. It will be replaced with native
functions in the future.

	 (
		(var Fs (require "fs"))
		(var FsReadFile (dict-get Fs "readFile"))
		(print "readFile:" (inspect FsReadFile))
		(var Our_callback (js-bridge #Err,Data :: (
			(print "Err:  " Err)
			(print "Data: " Data)
		)))
		% You can call FsReadFile using call (a parser-specific builtin.)
		(call FsReadFile "index.js" Our_callback)
	 )


Syntax Highlighting
===================

See the directory `syntax` for Lithp syntax files.

Presently, only EditPlus syntax files are provided. Submissions for
syntax files for other popular editors welcome. In particular, a VI
syntax file would be a great addition.
