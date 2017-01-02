//--------------- Cascade of side causes ---------------

function sideCause() {
	return a;
}

function sideCauseThis() {
	return this;
}

function callSideCauses() {
	// Side cause: call function with side cause (1)
	sideCause();
	// Side cause: call function with side cause (2)
	sideCauseThis();
}

function callCallSideCauses() {
	// Third-pass side cause
	callSideCauses();
}

//--------------- Cascade of side effects ---------------

function sideEffect() {
	a++;
}

function sideEffectThis() {
	this.x = 1;
}

function callSideEffects() {
	// Should issue 1 side effect
	sideEffect();
	// Should issue 1 side effect
	sideEffectThis();
}

function callCallSideEffects() {
	// Third-pass side effect
	callSideEffects();
}

//--------------- Nested functions ---------------

/*
function outer() {
	function innerSE() { a++; }
	innerSE();
}
*/
