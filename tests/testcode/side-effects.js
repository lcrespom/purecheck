//--------------- Side effects ---------------

function assignmentSideEffects() {
	// Should issue 5 side effects
	x = 1;
	y.u = 2;
	z[5] = 3;
	t++;
	u += 4;
}

function invokeSideEffects(x) {
	// Should issue 1 side effect
	assignmentSideEffects();
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