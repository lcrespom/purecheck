const fs = require('fs');
const path = require('path');
const test = require('tape');
const pcheck = require('../../lib/purecheck');
const purecheck = pcheck.default;
const ErrorType = pcheck.ErrorType;


//--------------- File checking for purity ---------------

function readTestFile(name) {
	let fullName = path.join(__dirname, '../testcode', name + '.js');
	return fs.readFileSync(fullName, 'utf8');
}

function a2o(a, prop) {
	let o = {};
	for (let e of a)
		o[e[prop]] = e;
	return o;
}

function doReport(fname) {
	let file = readTestFile(fname);
	return a2o(purecheck(file), 'name');
}


//--------------- Test helpers ---------------

function noErrors(t, func) {
	t.equal(func.errors.length, 0, `Function "${func.name}" has no errors`);
}

function hasErrors(t, func, expected, ofType) {
	t.equal(func.errors.length, expected,
		`Function "${func.name}" has ${expected} error(s)`);
	if (ofType === undefined) return;
	let tname = ErrorType[ofType];
	for (let i = 0; i < func.errors.length; i++)
		t.equal(func.errors[i].type, ofType,
			`Error ${i} in function "${func.name}" is of type ${tname}`);
}


//--------------- Test cases ---------------

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
	hasErrors(t, report.assignmentSideEffects, 5, ErrorType.WriteNonLocal);
	hasErrors(t, report.paramAssignments, 3, ErrorType.WriteNonLocal);
	hasErrors(t, report.assignToThis, 2, ErrorType.WriteThis);
	hasErrors(t, report.invokeSideEffects, 1, ErrorType.InvokeSideEffects);
	t.end();
});

test('Side causes', t => {
	let report = doReport('side-causes');
	hasErrors(t, report.sideCause, 2, ErrorType.ReadNonLocal);
	hasErrors(t, report.sideCauseThis, 2, ErrorType.ReadThis);
	hasErrors(t, report.callsSideCause, 2, ErrorType.InvokeSideCauses);
	t.end();
});
