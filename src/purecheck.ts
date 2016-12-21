import { parse } from 'esprima';
import { Statement, FunctionDeclaration, SourceLocation } from 'estree';

export default purecheck;

interface FPError {
	type: string;
	ident: string;
	loc: SourceLocation;
}

function purecheck(code) {
	let tree = parse(code, {
		loc: true,
		sourceType: 'module'
	});
	let funcs = filterTree(tree.body, node => node.type == 'FunctionDeclaration');
	let checks = funcs.map(func => checkFunc(func));
	return checks;
}

function filterTree(statements, check) {
	let nodes: FunctionDeclaration[] = [];
	statements.forEach(statement => {
		//TODO: scan recursively
		if (check(statement)) nodes.push(statement);
	});
	return nodes;
}

function checkFunc(fdec: FunctionDeclaration) {
	let locals = getLocalVars(fdec.body.body);
	return {
		loc: fdec.loc,
		id: fdec.id ? fdec.id.name : null,
		locals,
		sideCauses: checkSideCauses(fdec.body.body, locals),
		sideEffects: checkSideEffects(fdec.body.body, locals)
	};
}

function getLocalVars(statements) {
	let decs = statements.filter(stmt => stmt.type == 'VariableDeclaration');
	let locals = {};
	decs.forEach(dec =>
		dec.declarations.filter(d => d.type == 'VariableDeclarator')
			.forEach(vd => locals[vd.id.name] = true)
	);
	return locals;
}

function checkSideCauses(statements, locals) {
	let result = [];
	statements.forEach(stmt => {
		//TODO recursively scan all expressions (phew!)
		//TODO check function calls with side causes
		//TODO check function calls from blacklist
	});
	return result;
}

function checkSideEffects(statements, locals) {
	let result: FPError[] = [];
	statements.forEach(stmt => {
		if (isAssignment(stmt)) {
			let ident = getAssignmentTarget(stmt);
			if (ident && !locals[ident]) {
				result.push({
					type: 'WriteNonLocal',
					ident,
					loc: stmt.loc
				});
			}
		}
		//TODO check function calls with side effects
		//TODO check function calls from blacklist
	});
	return result;
}

function isAssignment(stmt) {
	return stmt.type == 'ExpressionStatement' &&
		stmt.expression.type == 'AssignmentExpression';
}

function getAssignmentTarget(stmt): string | null {
	let ident: string | null = null;
	if (stmt.expression.left.type == 'Identifier')
		ident = stmt.expression.left.name;
	else if (stmt.expression.left.type == 'MemberExpression') {
		if (stmt.expression.left.object.type == 'Identifier')
			ident = stmt.expression.left.object.name;
		else if (stmt.expression.left.object.type == 'ThisExpression')
			ident = 'this';
	}
	return ident;
}

/*
	Side causes:
		- Reading a non-local variable
		- Reading from this (optional, default to false)
		- Invoking a function with side causes (according to previous scan)
		- Invoking a function from a blacklist
	Side effects:
		- Writing to a non-local variable
		- Writing to a parameter member (including this)
		- Invoking a function with side effects (according to previous scan)
		- Invoking a function from a blacklist
*/