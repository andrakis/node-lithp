#!/usr/bin/env node

/**
 * Provides the interface to Lithp to other modules.
 */

var lithp = require('./lib/lithp');
exports.Lithp = lithp.Lithp;
exports.debug = lithp.debug;
exports.get_debug_flag = lithp.get_debug_flag;
exports.set_debug_flag = lithp.set_debug_flag;
exports.Types = require('./lib/types');
exports.Parser = require('./platform/v0/parser').BootstrapParser;
