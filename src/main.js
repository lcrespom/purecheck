import purecheck from './purecheck';

process.stdin.setEncoding('utf8');
var buf = '';
var showLoc = false;

process.stdin.on('data', function(chunk) {
	buf += chunk;
});
process.stdin.on('end', function() {
	console.log(processJS(buf));
});
process.stdin.resume();

function processJS(buf) {
	return report(purecheck(buf));
}

function report(checkData) {
	if (!showLoc) {
		checkData = checkData.map(item => {
			item.loc = undefined;
			return item;
		});
	}
	return JSON.stringify(checkData, null, 4);
}