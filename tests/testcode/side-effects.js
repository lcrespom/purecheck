//--------------- Side effects ---------------

function assignmentSideEffects() {
	// Should issue 6 side effects
	x = 1;
	y.u = 2;
	z[5] = 3;
	t++;
	u += 4;
	k.x++;
}

function paramAssignments(x, y, z) {
	// Should issue 3 side effects
	x = 4;
	y++;
	z += 2;
}

function assignToThis() {
	// Should issue 2 side effects
	this.x = 3;
	this.y--;
}

let global = 1;

function changeGlobal() {
	// Should issue 1 side effect
	global = 2;
}

function nested() {
	function child() {
		// Should issue 1 side effect
		foo = 3;
	}
}

function strTemplate() {
	// Should issue 1 side effect
	return `Some string ${x++} template`;
}