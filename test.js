#!/usr/bin/env node

/**
 * Run a sample Lithp program.
 */

var Lithp = require('./.').Lithp;

var samples = require('./lib/samples');
var lithp = new Lithp();
(require('./lib/builtins')).setup(lithp);

var sample;
// Select your desired sample here
//sample = samples.simple_test_code(lithp);
//sample = samples.simple_test_code2(lithp);
//sample = samples.less_simple_test_code(lithp);
sample = samples.fac_test_code(lithp)

// Run the chosen sample
lithp.run(sample);

