#!/usr/bin/env node

var Lithp = require('./.').Lithp;

var samples = require('./lib/samples');
var lithp = new Lithp();
(require('./lib/builtins')).setup(lithp);
//debug(lithp.functions);
//lithp.run(less_simple_test_code(lithp));
lithp.run(samples.fac_test_code (lithp));

