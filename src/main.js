process.stdin.setEncoding('utf8');
var buf = '';

process.stdin.on('data', function(chunk) {
	buf += chunk;
});
process.stdin.on('end', function() {
	console.log(processJS(buf));
});
process.stdin.resume();

function processJS(buf) {
	return buf.toUpperCase();
}