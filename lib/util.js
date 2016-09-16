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

Object.clone = function(src) { return Object.assign({}, src); };

/*
	Taken from: http://stackoverflow.com/questions/10539938/override-the-equivalence-comparison-in-javascript

	Object.equals

	Desc:       Compares an object's properties with another's, return true if the objects
	            are identical.
	params:
		obj = Object for comparison
*/
Object.equals = function(a, b)
{
	/*Make sure the object is of the same type as this*/
	if(typeof b != typeof a)
		return false;

	/*Iterate through the properties of a bect looking for a discrepancy between a and b*/
	for(var property in a)
	{

		/*Return false if b doesn't have the property or if its value doesn't match a' value*/
		if(typeof b[property] == "undefined")
			return false;   
		if(b[property] != a[property])
			return false;
	}

	/*Object's properties are equivalent */
	return true;
}


} // if(!__lithp_defined('util'))