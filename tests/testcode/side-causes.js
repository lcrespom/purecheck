//--------------- Side causes ---------------

function sideCause(x, y) {
	let a = 0;
	a = x;
	// Side cause: read from non-local var / param (1)
	a = z;
	// Side cause: read from non-local member (2)
	a = t.e[4].x;
	// Side cause inside string template (3)
	return `some interpolated ${foo} text`;
}

function sideCauseThis(x, y) {
	let a = 0;
	// Side cause: read from this (1)
	a = this;
	// Side cause: read from this member (2)
	a = this.b[4];
}
