//--------------- Side causes ---------------

function sideCause(x, y) {
	let a = 0;
	a = x;
	// Side cause: read from non-local var / param (1)
	a = z;
	// Side cause: read from non-local member (2)
	a = t.e[4].x;
}

function sideCauseThis(x, y) {
	let a = 0;
	// Side cause: read from this (1)
	a = this;
	// Side cause: read from this member (2)
	a = this.b[4];
}

function callsSideCause(x, y) {
	// Side cause: call function with side cause (1)
	sideCause(x, y);
	// Side cause: call function with side cause (2)
	sideCauseThis(x, y);
}