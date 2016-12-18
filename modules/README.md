Native Lithp Modules
====================

This directory contains native lithp modules. Most of the runtime library is
implemented as modules. Some of these modules use native Node.js modules.


Modules overview
----------------

  * [bignum](https://github.com/andrakis/node-lithp/blob/master/modules/bignum.lithp) provides an
    interface to the Node.js bignum library.

     You must install the bignum library separately using: `npm install bignum`

  * [buffer](https://github.com/andrakis/node-lithp/blob/master/modules/buffer.lithp) provides an
    interface to Node.js `Buffer` module.

  * [cache](https://github.com/andrakis/node-lithp/blob/master/modules/cache.lithp) provides
    function result caching functionality.

  * [file](https://github.com/andrakis/node-lithp/blob/master/modules/file.lithp) provides file IO.

     Currently only reading files is supported, and a limited set of directory / file functions.

  * [lists](https://github.com/andrakis/node-lithp/blob/master/modules/lists.lithp) provides many
    list related functions.

     Among the more interesting functions are:

       * map/2 - Map over a list with a callback

       * each/2 - Run a callback over a list

       * foldl/3 - Fold a list left using an accumulator and a callback

       * seq/2, seq/3 - Generate a sequence list from start to end, with optional given increment.

       * permutations/1 - Get all permutations of a given list.

       * lcomp/3 - List comprehension

  * [pivot](https://github.com/andrakis/node-lithp/blob/master/modules/pivot.lithp) provides a
    primitive math pivot function.


  * [random](https://github.com/andrakis/node-lithp/blob/master/modules/random.lithp) provides
    functions for random number generation and picking a random element from a list.

  * [readline](https://github.com/andrakis/node-lithp/blob/master/modules/readline.lithp) provides
    an interface to the Node.js readline module.

  * [repl](https://github.com/andrakis/node-lithp/blob/master/modules/repl.lithp) provides a functional
    Read Execute Print Loop.

  * [stderr](https://github.com/andrakis/node-lithp/blob/master/modules/stderr.lithp) provides functions
    for outputting to standard error.

  * [stream](https://github.com/andrakis/node-lithp/blob/master/modules/stream.lithp) provides functions
    for working with streams.

      Is able to read all of standard input and return it as a string.

  * [switch](https://github.com/andrakis/node-lithp/blob/master/modules/switch.lithp) provides a switch
    mechanism, as one might see in JavaScript or C.

  * [symbols](https://github.com/andrakis/node-lithp/blob/master/modules/symbols.lithp) provides some
    basic functions for calling functions at runtime by name.


