#!/usr/bin/env node

/**
 * Provides the interface to Lithp to other modules.
 */

var lithp = require('./lib/lithp');
exports.Lithp = lithp.Lithp;
exports.debug = lithp.debug;
exports.get_debug_flag = lithp.get_debug_flag;
exports.Types = require('./lib/types');
