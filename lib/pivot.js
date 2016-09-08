var problem = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
var desired = 2016;
var allowable = "+-/*";

function do_arith (A,B, op) {
	switch(op) {
		case "+": return A+B;
		case "-": return A-B;
		case "/": return A/B;
		case "*": return A*B;
		default: throw new Error("Unkown operation: " + A + " " + op + " " + B);
	}
}

function pivot_solve_brute (problem, allowable, desired) {
	// map all possibilities
	var possibilities = problem.map((P) => {
	});
}

pivot_solve(problem, allowable, desired);
