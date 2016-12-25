//--------------- Recursive statements ---------------

function recursiveStatements() {
	let x = 3;
	// Should detect "m" as side cause (1)
	for (let i = 0; i < m; i++) {
		// Should detect "a" as side cause (2)
		if (a) {
			x++;
			// Should detect "g--" as side effect (3)
			g--;
		}
		else
			// Should detect "g" as side cause (4)
			while (g)
				// should detect "e = 3" as side effect (5)
				e = 3;
	}
}
