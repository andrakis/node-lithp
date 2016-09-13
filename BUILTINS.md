Setting a variable
------------------

	set/2	Set VariableName to Value. If it is defined in the parent
	        scope, it will be updated there. Otherwise, it is created
	        in the current scope.

	(set VariableName Value)

	Caveats: May set VariableName if it is already defined up the parent
	         scope (ie, used by another function.)
	Workaround: Use var/2 instead.


	var/2	Set VariableName to Value in the current scope. This will
	        define a new variable in the current scope, or update a
	        variable of that name in the current scope.
	
	(var VariableName Value)

	Caveats: Since it is set in the current scope, you may end up unintentionally
	         creating a new variable because your current scope has changed.
	Workaround: Use var/2 to create a variable initially, and then use set/2 to
	            update it. It will walk up the chain to the most recently defined
	            VariableName, and update that one.
