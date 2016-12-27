const fs = require('fs');
const path = require('path');
const test = require('tape');
const pcheck = require('../../lib/purecheck');
const purecheck = pcheck.default;
const ErrorType = pcheck.ErrorType;
const findParentFunction = pcheck.findParentFunction;


//--------------- File checking for purity ---------------

function readTestFile(name) {
	let fullName = path.join(__dirname, '../testcode', name + '.js');
	return fs.readFileSync(fullName, 'utf8');
}

function groupByFunction(errors) {
	let funcs = {};
	for (let e of errors) {
		let fnode = findParentFunction(e.node);
		if (!fnode) continue;
		let name = fnode.id.name;
		if (!funcs[name])
			funcs[name] = { name, errors: [] };
		funcs[name].errors.push(e);
	}
	return funcs;
}

function doReport(fname) {
	let file = readTestFile(fname);
	return groupByFunction(purecheck(file));
}


//--------------- Test helpers ---------------

function hasErrors(t, report, fname, expected, ofType) {
	let func = report[fname];
	if (!func) {
		t.equal(0, expected,
			`Function ${fname} has ${expected} error(s)`);
		return;
	}
	t.equal(func.errors.length, expected,
		`Function "${fname}" has ${expected} error(s)`);
	if (ofType === undefined) return;
	let tname = ErrorType[ofType];
	for (let i = 0; i < func.errors.length; i++)
		t.equal(func.errors[i].type, ofType,
			`Error ${i} in function "${fname}" is of type ${tname}`);
}


//--------------- Test cases ---------------

test('Simple pure functions', t => {
	let report = doReport('simple-pure');
	t.ok(report, 'Report provided');
	t.equal(Object.keys(report).length, 0,
		'File "simple-pure" has no errors');
	t.end();
});

test('Side effects', t => {
	let report = doReport('side-effects');
	hasErrors(t, report, 'assignmentSideEffects', 6, ErrorType.WriteNonLocal);
	hasErrors(t, report, 'paramAssignments', 3, ErrorType.WriteNonLocal);
	hasErrors(t, report, 'assignToThis', 2, ErrorType.WriteThis);
	hasErrors(t, report, 'invokeSideEffects', 1, ErrorType.InvokeSideEffects);
	t.end();
});

test('Side causes', t => {
	let report = doReport('side-causes');
	hasErrors(t, report, 'sideCause', 2, ErrorType.ReadNonLocal);
	hasErrors(t, report, 'sideCauseThis', 2, ErrorType.ReadThis);
	hasErrors(t, report, 'callsSideCause', 2, ErrorType.InvokeSideCauses);
	t.end();
});
