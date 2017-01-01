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

function doReport(name) {
	return purecheck(readTestFile(name));
}


//--------------- Test helpers ---------------

function hasErrors(t, report, fname, expected, ofType) {
	let func = report.functions[fname];
	if (!func) {
		t.equal(0, expected,
			`Function ${fname} should have ${expected} error(s)`);
		return;
	}
	t.equal(func.errors.length, expected,
		`Function "${fname}" should have ${expected} error(s)`);
	if (ofType === undefined) return;
	let tname = ErrorType[ofType];
	for (let i = 0; i < func.errors.length; i++)
		t.equal(func.errors[i].type, ofType,
			`Error ${i} in function "${fname}" should be of type ${tname}`);
}

function checkError(t, e, name, type) {
	t.equal(e.ident, name, 'Identifier name should be ' + name);
	let tname = ErrorType[type];
	t.equal(e.type, type, `Error type for "${name}" should be ${tname}`);
}


//--------------- Test cases ---------------

test('Simple pure functions: no false positives', t => {
	let report = doReport('simple-pure');
	t.ok(report, 'Report provided');
	t.equal(Object.keys(report.errors).length, 0,
		'File "simple-pure" should have no errors');
	t.end();
});

test('Side cause detection', t => {
	let report = doReport('side-causes');
	hasErrors(t, report, 'sideCause', 3, ErrorType.ReadNonLocal);
	hasErrors(t, report, 'sideCauseThis', 2, ErrorType.ReadThis);
	t.equal(report.errors.length, 5, 'No unexpected errors');
	t.end();
});

test('Side effect detection', t => {
	let report = doReport('side-effects');
	hasErrors(t, report, 'assignmentSideEffects', 6, ErrorType.WriteNonLocal);
	hasErrors(t, report, 'paramAssignments', 3, ErrorType.WriteNonLocal);
	hasErrors(t, report, 'assignToThis', 2, ErrorType.WriteThis);
	hasErrors(t, report, 'changeGlobal', 1, ErrorType.WriteNonLocal);
	hasErrors(t, report, 'nested/child', 1, ErrorType.WriteNonLocal);
	hasErrors(t, report, 'strTemplate', 1, ErrorType.WriteNonLocal);
	t.equal(report.errors.length, 14, 'No unexpected errors');
	t.end();
});

test('Recursive statements', t => {
	let report = doReport('recur-stmt');
	hasErrors(t, report, 'recursiveStatements', 5);
	let errs = report.functions.recursiveStatements.errors;
	checkError(t, errs[0], 'm', ErrorType.ReadNonLocal);
	checkError(t, errs[1], 'a', ErrorType.ReadNonLocal);
	checkError(t, errs[2], 'g', ErrorType.WriteNonLocal);
	checkError(t, errs[3], 'g', ErrorType.ReadNonLocal);
	checkError(t, errs[4], 'e', ErrorType.WriteNonLocal);
	t.equal(report.errors.length, 5, 'No unexpected errors');
	t.end();
});

test('Recursive expressions', t => {
	let report = doReport('recur-expr');
	// recursiveExpressions
	hasErrors(t, report, 'recursiveExpressions', 2);
	let errs = report.functions.recursiveExpressions.errors;
	checkError(t, errs[0], 'z', ErrorType.ReadNonLocal);
	checkError(t, errs[1], 't', ErrorType.WriteNonLocal);
	// expressionsEverywhere
	hasErrors(t, report, 'expressionsEverywhere', 7);
	errs = report.functions.expressionsEverywhere.errors;
	checkError(t, errs[0], 'a', ErrorType.WriteNonLocal);
	checkError(t, errs[1], 'i', ErrorType.WriteNonLocal);
	checkError(t, errs[2], 'i', ErrorType.ReadNonLocal);
	checkError(t, errs[3], 'i', ErrorType.WriteNonLocal);
	checkError(t, errs[4], 'y', ErrorType.WriteNonLocal);
	checkError(t, errs[5], 'a', ErrorType.ReadNonLocal);
	checkError(t, errs[6], 'b', ErrorType.WriteNonLocal);
	// deepSideCause
	hasErrors(t, report, 'deepSideCause', 3, ErrorType.ReadNonLocal);
	// deepSideEffect
	hasErrors(t, report, 'deepSideEffect', 3, ErrorType.WriteNonLocal);
	t.equal(report.errors.length, 15, 'No unexpected errors');
	t.end();
});

test('Code outside functions should be ignored', t => {
	let report = doReport('globals');
	hasErrors(t, report, 'sideCause', 1, ErrorType.ReadNonLocal);
	hasErrors(t, report, 'sideEffect', 1, ErrorType.WriteNonLocal);
	t.equal(report.errors.length, 2, 'No unexpected errors');
	t.end();
});

test('Function expressions', t => {
	let report = doReport('func-expr');
	t.equal(report.errors.length, 4, 'Detect all errors');
	hasErrors(t, report, '<anonymous-1>', 1, ErrorType.WriteNonLocal);
	hasErrors(t, report, '<anonymous-2>', 1, ErrorType.ReadNonLocal);
	hasErrors(t, report, '<anonymous-3>', 1, ErrorType.ReadNonLocal);
	t.end();
});

test('Cascade: detect invocation to own non-pure functions', t => {
	let report = doReport('cascade');
	// Side causes
	hasErrors(t, report, 'sideCause', 1, ErrorType.ReadNonLocal);
	hasErrors(t, report, 'sideCauseThis', 1, ErrorType.ReadThis);
	hasErrors(t, report, 'callSideCauses', 2, ErrorType.InvokeSideCauses);
	hasErrors(t, report, 'callCallSideCauses', 1, ErrorType.InvokeSideCauses);
	// Side effects
	hasErrors(t, report, 'sideEffect', 1, ErrorType.WriteNonLocal);
	hasErrors(t, report, 'sideEffectThis', 1, ErrorType.WriteThis);
	hasErrors(t, report, 'callSideEffects', 2, ErrorType.InvokeSideEffects);
	hasErrors(t, report, 'callCallSideEffects', 1, ErrorType.InvokeSideEffects);
	t.equal(report.errors.length, 10, 'No unexpected errors');
	t.end();
});
