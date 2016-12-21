import purecheck, { FunctionReport } from './purecheck';


process.stdin.setEncoding('utf8');
let buf = '';
let showLoc = false;

process.stdin.on('data', function(chunk) {
	buf += chunk;
});

process.stdin.on('end', function() {
	printReport(processJS(buf));
});

process.stdin.resume();


function printReport(report) {
	let checkPlural = num => num == 1 ? '' : 's';
	console.log(JSON.stringify(report.funcs, null, 4));
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
