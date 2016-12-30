const fs = require('fs');
import { argv } from 'yargs';
import purecheck, { FPError, FPErrorReport, ErrorType } from './purecheck';


function readFromStdIn(cb) {
	let buf = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', chunk => buf += chunk);
	process.stdin.on('end', _ => cb(buf));
	process.stdin.resume();
}

function processJS(buf: string): FPErrorReport {
	let tabSize = argv.tabsize || argv.t || '4';
	buf = replaceTabs(parseInt(tabSize, 10), buf);
	return purecheck(buf);
}

function printReport(report: FPErrorReport) {
	let checkPlural = num => num == 1 ? '' : 's';
	for (let e of report.errors)
		printErrorReport(e);
	console.log('--------------------');
	let nerrs = report.errors.length;
	console.log(`${nerrs} error${checkPlural(nerrs)}`);
}

function printErrorReport(e: FPError) {
	if (!e.node.loc)
		throw Error('Location should be available');
	let line = e.node.loc.start.line;
	let col = e.node.loc.start.column;
	let type = typeMsg(e.type, e.ident);
	console.log(`Impure function error at (${line}, ${col}): ${type}`);
}

function typeMsg(type: ErrorType, name: string) {
	switch (type) {
		case ErrorType.ReadThis:
			return '"this" should not be accessed';
		case ErrorType.ReadNonLocal:
			return 'Only local variables or parameters should be accessed';
		case ErrorType.WriteThis:
			return '"this" should not be updated';
		case ErrorType.WriteNonLocal:
			return 'Only local variables can be updated';
		default:
			throw Error(`Unrecognized error type: ${type}/${ErrorType[type]}`);
	}
}

function readFile(cb: (buf: string) => void) {
	if (argv._.length > 0) {
		cb(fs.readFileSync(argv._[0], 'utf8'));
	}
	else {
		readFromStdIn(cb);
	}
}

readFile(buf => printReport(processJS(buf)));


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
