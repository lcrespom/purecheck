let fs = require('fs');
let path = require('path');
let test = require('tape');

let purecheck = require('../../lib/purecheck').default;


function readTestFile(name) {
	let fullName = path.join(__dirname, '../testcode', name + '.js')
	return fs.readFileSync(fullName, 'utf8');
}

function a2o(a, prop) {
	let o = {};
	for (e of a)
		o[e[prop]] = e;
	return o;
}

function doReport(fname) {
	let file = readTestFile(fname);
	return a2o(purecheck(file), 'name');
}


function noErrors(t, func) {
	t.equal(func.sideCauses.length, 0, `Function "${func.name}" has no side causes`);
	t.equal(func.sideEffects.length, 0, `Function "${func.name}" has no side effects`);
}

function hasSideEffects(t, func, expected) {
	t.equal(func.sideEffects.length, expected,
		`Function "${func.name}" has ${expected} side effect(s)`);
}


test('Simple pure functions', t => {
	let report = doReport('test1');
	t.ok(report, 'Report provided');
	noErrors(t, report.empty);
	noErrors(t, report.withParams);
	noErrors(t, report.withLocals);
	noErrors(t, report.withLocalAssignment);
	t.end();
});

test('Side effects', t => {
	let report = doReport('test1');
	hasSideEffects(t, report.assignmentSideEffects, 5);
	hasSideEffects(t, report.invokeSideEffects, 1);
	hasSideEffects(t, report.paramAssignments, 3);
	t.end();
});
