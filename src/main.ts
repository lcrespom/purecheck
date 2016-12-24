import { argv } from 'yargs';
import purecheck, { FunctionReport } from './purecheck';


function readFromStdIn(cb) {
	let buf = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', chunk => buf += chunk);
	process.stdin.on('end', _ => cb(buf));
	process.stdin.resume();
}

function processJS(buf) {
	let tabSize = argv.tabsize || argv.t || '4';
	buf = replaceTabs(parseInt(tabSize, 10), buf);
	return report(purecheck(buf));
}

function report(checkData: FunctionReport[]) {
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

function printReport(report) {
	let checkPlural = num => num == 1 ? '' : 's';
	console.log(JSON.stringify(report.funcs, customStringify, 4));
	console.log('--------------------\n');
	console.log(`${report.numFuncs} function${checkPlural(report.numFuncs)}`);
	console.log(`${report.numSC} side cause${checkPlural(report.numSC)}`);
	console.log(`${report.numSE} side effect${checkPlural(report.numSE)}`);
}

readFromStdIn(buf => printReport(processJS(buf)));


// --------------- Misc formatting utils ---------------

function location(loc): string {
	return `(line ${loc.line}, col ${loc.column})`;
}

function customStringify(key, value) {
	if (value instanceof Set)
		return `Set{ ${Array.from(value.values()).join(', ')} }`;
	else if (key == 'loc' && value)
		return location(value.start) + ' - ' + location(value.end);
	else
		return value;
}

function replaceTabs(tabs: number, buf: string): string {
	let spaces = new Array(tabs + 1).join(' ');
	return buf.replace(/\t/g, spaces);
}
