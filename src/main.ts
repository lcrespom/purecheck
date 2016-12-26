const fs = require('fs');
import { argv } from 'yargs';
import purecheck, { FPError } from './purecheck';


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

function report(errors: FPError[]) {
	// TODO: sort if required, count error types, add descrptive text, etc.
	return errors;
}

function printReport(report) {
	let checkPlural = num => num == 1 ? '' : 's';
	console.log(JSON.stringify(report, customStringify, 4));
	console.log('--------------------\n');
	console.log(`${report.length} error${checkPlural(report.length)}`);
}

function readFile(cb) {
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
