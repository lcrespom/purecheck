import purecheck, { FunctionReport } from './purecheck';


let showLoc = false;


function readFromStdIn(cb) {
	let buf = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', chunk => buf += chunk);
	process.stdin.on('end', _ => cb(buf));
	process.stdin.resume();
}

function stringifySet(key, value) {
	if (value instanceof Set)
		return `Set{ ${Array.from(value.values()).join(', ')} }`;
	else
		return value;
}

function printReport(report) {
	let checkPlural = num => num == 1 ? '' : 's';
	console.log(JSON.stringify(report.funcs, stringifySet, 4));
	console.log('--------------------\n');
	console.log(`${report.numFuncs} function${checkPlural(report.numFuncs)}`);
	console.log(`${report.numSC} side cause${checkPlural(report.numSC)}`);
	console.log(`${report.numSE} side effect${checkPlural(report.numSE)}`);
}

function processJS(buf) {
	return report(purecheck(buf));
}

function report(checkData: FunctionReport[]) {
	if (!showLoc) {
		checkData = checkData.map(item => {
			item.loc = undefined;
			return item;
		});
	}
	let addNums = (n1: number, n2: number) => n1 + n2;
	return {
		funcs: checkData,
		numFuncs: checkData.length,
		numSC: checkData
			.map(fr => fr.sideCauses.length)
			.reduce(addNums, 0),
		numSE: checkData
			.map(fr => fr.sideEffects.length)
			.reduce(addNums, 0)
	};
}

readFromStdIn(buf => printReport(processJS(buf)));
