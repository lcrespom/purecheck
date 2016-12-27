//--------------- Recursive expressions ---------------

function recursiveExpressions() {
	// Should detect "z" as side cause (1)
	// Should detect "t" as side effect (2)
	let x = 0;
	x = 4 * (2 + z) / (5 * (2 + t++));
}

function expressionsEverywhere() {
	// Expression in var decl assignment with side effect (1)
	let x = a++;
	// Expression in for loop with side cause (2, 3) and side effect (4)
	for (i = 0; i < 4; i++) x--;
	// Expresion in while condition with side effect (5)
	while (y++) x++;
	// Recursive Expression in return with side cause and effect (6 and 7)
	return 2 * (a - b--);
}

function deepSideCause() {
	let x = 4;
	let y;
	let t = {};
	// Should generate 3 side causes: "a", "j" and "k"
	y = a[2].b[3].c[x].d[j].e[t[k]];
}

function deepSideEffect() {
	// Should generate one side effect ("a") and 2 side causes ("j" and "k")
	a[2].b[3].c[x].d[j].e[t[k]] = 1;
}
