//--------------- No side effects nor side causes ---------------

function empty() { return 1; }

function withParams(x, y) { return 2; }

function withLocals(x, y) { let z, t; return 3; }

function withLocalAssignment() {
	let x;
	x = {};
	x.a = 3;
	let y = x.b;
	return x;
}

function closure(pOut) {
	let l;
	function inner(pIn) {
		l = 5;
	}
}

function objLiteral(a) {
	return {
		a,
		b: 1,
		c: true,
		d: 'yeah'
	}
}

function globalObjects(x) {
	if (x instanceof Array) {
		return JSON.stringify(Object.toString());
	}
}
