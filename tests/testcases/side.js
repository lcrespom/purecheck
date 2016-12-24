const fs = require('fs');
const path = require('path');
const test = require('tape');

const purecheck = require('../../lib/purecheck').default;
const ERR_WriteNonLocal = 4;
const ERR_WriteThis = 5;


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
	t.equal(func.errors.length, 0, `Function "${func.name}" has no errors`);
}

function hasSideEffects(t, func, expected, ofType) {
	t.equal(func.errors.length, expected,
		`Function "${func.name}" has ${expected} error(s)`);
	if (ofType === undefined) return;
	for (let i = 0; i < func.errors.length; i++)
		t.equal(func.errors[i].type, ofType,
			`Error ${i} in function "${func.name}" is of type ${ofType}`)
}


test('Simple pure functions', t => {
	let report = doReport('simple-pure');
	t.ok(report, 'Report provided');
	noErrors(t, report.empty);
	noErrors(t, report.withParams);
	noErrors(t, report.withLocals);
	noErrors(t, report.withLocalAssignment);
	t.end();
});

test('Side effects', t => {
	let report = doReport('side-effects');
	hasSideEffects(t, report.assignmentSideEffects, 5, ERR_WriteNonLocal);
	hasSideEffects(t, report.invokeSideEffects, 1);
	hasSideEffects(t, report.paramAssignments, 3, ERR_WriteNonLocal);
	hasSideEffects(t, report.assignToThis, 2, ERR_WriteThis);
	t.end();
});
