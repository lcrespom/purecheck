//--------------- Globals should be harmless ---------------

let x = 0;
var y = 1;
const z = 2;

x = y + z;

function sideCause() {
	let a = x;
}

function sideEffect() {
	x = 3;
}
