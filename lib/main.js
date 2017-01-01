"use strict";
const fs = require('fs');
const yargs_1 = require("yargs");
const purecheck_1 = require("./purecheck");
// -------------------- I/O and CLI --------------------
function readFile(cb) {
    if (yargs_1.argv._.length > 0) {
        fs.readFile(yargs_1.argv._[0], 'utf8', (error, data) => {
            if (error)
                throw Error('Could not read file: ' + error);
            cb(data);
        });
    }
    else {
        readFromStdIn(cb);
    }
}
function readFromStdIn(cb) {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => buf += chunk);
    process.stdin.on('end', _ => cb(buf));
    process.stdin.resume();
}
function replaceTabs(tabs, buf) {
    let spaces = new Array(tabs + 1).join(' ');
    return buf.replace(/\t/g, spaces);
}
function processJS(buf) {
    let tabSize = yargs_1.argv.tabsize || yargs_1.argv.t || '4';
    buf = replaceTabs(parseInt(tabSize, 10), buf);
    return purecheck_1.default(buf);
}
// -------------------- Result reporting --------------------
function printReport(report) {
    let checkPlural = num => num == 1 ? '' : 's';
    for (let e of report.errors)
        printErrorReport(e);
    console.log('--------------------');
    let nerrs = report.errors.length;
    console.log(`${nerrs} error${checkPlural(nerrs)}`);
}
function printErrorReport(e) {
    if (!e.node.loc)
        throw Error('Location should be available');
    let line = e.node.loc.start.line;
    let col = e.node.loc.start.column + 1;
    let type = typeMsg(e.type, e.ident);
    console.log(`Impure function error at (${line}, ${col}): ${type}`);
}
function typeMsg(type, name) {
    switch (type) {
        case purecheck_1.ErrorType.ReadThis:
            return '"this" should not be accessed';
        case purecheck_1.ErrorType.ReadNonLocal:
            return 'Only local variables or parameters should be accessed';
        case purecheck_1.ErrorType.WriteThis:
            return '"this" should not be updated';
        case purecheck_1.ErrorType.WriteNonLocal:
            return 'Only local variables can be updated';
        default:
            throw Error(`Unrecognized error type: ${type}/${purecheck_1.ErrorType[type]}`);
    }
}
// -------------------- Main --------------------
readFile(buf => printReport(processJS(buf)));
//# sourceMappingURL=main.js.map