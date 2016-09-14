/**
 * Provides some additional utility functions.
 */

global.__lithp = {};
global.__lithp_define = (Name, Value) => global.__lithp[Name] = Value || 1;
global.__lithp_defined = (Name) => Name in global.__lithp;

if(!__lithp_defined('util')) {

__lithp_define('util');

// Add non-destructive methods of moving through an Array
Array.prototype.iterator = function() { return new ArrayIterator(this); };

function ArrayIterator (arr) {
	this.array = arr;
	this.length = this.array.length;
	this.rewind();
}

ArrayIterator.prototype.rewind = function() { this.index = 0; };
ArrayIterator.prototype.next   = function() {
	if(this.index >= this.array.length)
		return undefined;
	return this.array[this.index++];
};

} // if(!__lithp_defined('util'))
