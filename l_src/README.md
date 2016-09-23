Lithp Source Example Files
==========================

Each of the provided example files work with the current parser. Just provide
the path of one to run js, such as:

	node run.js l_src/factorial.lithp

Each example has its own more detailed comments outlining what it does and
sometimes a look into how the intrepeter does it.

Some examples require the -v1 switch, to allow use of Platform V1 features.
These examples mention this, and if you try run them without the switch you
will receive an unknown function call error.

The run script also provides some additional options, such as -d to print
parsing and interpreting debug information, and -t to print load, parse, and
execution times.

Current files
-------------

* [atoms.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/atoms.lithp)

	Demonstrate using atoms as function calls.

* [complex.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/complex.lithp)

	This is a test of nested if and print states to check control flow.

* [factorial.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/factorial.lithp)

	Calculate the factorial of a number using recursive function calls.

* [oddword.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/oddword.lithp)

	A valid solution to a [Programming Puzzles and Code Golf Challenges post](http://codegolf.stackexchange.com/questions/93906/is-it-an-odd-word).
	Link to post included in file.

* [scope.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/scope.lithp)

	Test variable scoping, offers similar functionality to JavaScript closures.

* [readfile.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/readfile.lithp)

	Demonstrate reading a file by calling native Node.js functions.

* [scope.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/scope.lithp)

	Demonstrate variable scope and returning functions that can be called.

* [simple.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/atoms.lithp)

	Simple working example. Calls some functions, uses some variables.

* [subchains.lithp](https://github.com/andrakis/node-lithp/blob/master/l_src/atoms.lithp)

	Test out control flow.
