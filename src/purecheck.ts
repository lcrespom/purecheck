import * as esprima from 'esprima';
import { SourceLocation,
	Statement,
	ExpressionStatement, AssignmentExpression,
	FunctionDeclaration, VariableDeclaration } from 'estree';

export default purecheck;


type NameMap = {
	[name: string]: boolean;
};

interface FPError {
	type: string;
	ident: string;
	loc: SourceLocation | undefined;
}

interface FunctionReport {
	loc: SourceLocation | undefined;
	id: string | null;
	locals: NameMap;
	sideCauses: FPError[];
	sideEffects: FPError[];
}


function purecheck(code: string): FunctionReport[] {
	let tree = esprima.parse(code, {
		loc: true,
		sourceType: 'module'
	});
	return tree.body
		.filter(node => node.type == 'FunctionDeclaration')
		.map((func: FunctionDeclaration) => checkFunc(func));
}

function checkFunc(fdec: FunctionDeclaration): FunctionReport {
	let locals = getLocalVars(fdec.body.body);
	return {
		loc: fdec.loc,
		id: fdec.id ? fdec.id.name : null,
		locals,
		sideCauses: checkSideCauses(fdec.body.body, locals),
		sideEffects: checkSideEffects(fdec.body.body, locals)
	};
}

function getLocalVars(statements: Statement[]): NameMap {
	let decs = statements.filter(stmt => stmt.type == 'VariableDeclaration');
	let locals = {};
	decs.forEach((dec: VariableDeclaration) =>
		dec.declarations.filter(d => d.type == 'VariableDeclarator')
			.forEach((vd: any) => locals[vd.id.name] = true)
	);
	return locals;
}

function checkSideCauses(statements: Statement[], locals: NameMap) {
	let result = [];
	statements.forEach(stmt => {
		//TODO recursively scan all expressions (phew!)
		//TODO check function calls with side causes
		//TODO check function calls from blacklist
	});
	return result;
}

function checkSideEffects(statements: Statement[], locals: NameMap) {
	let result: FPError[] = [];
	statements.forEach(stmt => {
		if (isAssignment(stmt)) {
			let ident = getAssignmentTarget(stmt as ExpressionStatement);
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

function isAssignment(stmt: Statement) {
	return stmt.type == 'ExpressionStatement' &&
		stmt.expression.type == 'AssignmentExpression';
}

function getAssignmentTarget(stmt: ExpressionStatement): string | null {
	let expr = stmt.expression as AssignmentExpression;
	if (expr.left.type == 'Identifier')
		return expr.left.name;
	else if (expr.left.type == 'MemberExpression') {
		if (expr.left.object.type == 'Identifier')
			return expr.left.object.name;
		else if (expr.left.object.type == 'ThisExpression')
			return 'this';
	}
	return null;
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