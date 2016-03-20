import esprima from 'esprima';

export default purecheck;


function purecheck(code) {
	var tree = esprima.parse(code, {
		loc: true,
		sourceType: 'module'
	});
	var funcs = filterTree(tree.body, node => node.type == 'FunctionDeclaration');
	var checks = funcs.map(func => checkFunc(func));
	return checks;
}

function filterTree(statements, check) {
	var nodes = [];
	statements.forEach(statement => {
		//TODO: scan recursively
		if (check(statement)) nodes.push(statement);
	});
	return nodes;
}

function checkFunc(fdec) {
	var localVars = getLocalVars(fdec.body.body);
	return {
		loc: fdec.loc,
		id: fdec.id ? fdec.id.name : null,
		locals: localVars,
		sideCauses: [],
		sideEffects: []
	};
}

function getLocalVars(statements) {
	var decs = statements.filter(stmt => stmt.type == 'VariableDeclaration');
	var locals = [];
	decs.forEach(dec =>
		dec.declarations.filter(d => d.type == 'VariableDeclarator')
			.forEach(vd => locals.push(vd.id.name))
	);
	return locals;
}


/*
	Side causes:
		- Reading a non-local variable
		- Reading from this (optional, default to false)
		- Invoking a function with side causes
		- Invoking a function from a blacklist
	Side effects:
		- Writing to a non-local variable
		- Writing to a parameter member (including this)
		- Invoking a function with side effects
		- Invoking a function from a blacklist
*/