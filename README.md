Lithp
=====

A small Lisp-like programming language, with a very small interpreter.

The main interpreter is less than 200 lines of code (not counting
structures.)

No parser yet exists, this is being worked on. The sample code
constructs the correct parsing tree.


Examples
========

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

Define a recursive functino that calculates the factorial of the
given number, and call it.

	 ((def fac #N :: (
	    (if (== 0 N) (1)
	        (else ((* N (fac (- N 1))))))
	  ))
	  (set Test 10)
	  (print "factorial of " Test ": " (fac Test)))
