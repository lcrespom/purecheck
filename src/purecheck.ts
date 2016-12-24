import * as esprima from 'esprima';
import { SourceLocation,
	Statement,
	ExpressionStatement, AssignmentExpression,
	FunctionDeclaration } from 'estree';

import * as jsonQuery from 'json-query';
let JQ = (q, data) => jsonQuery(q, { data }).value;


export default purecheck;

export const enum ErrorType {
	// Side causes
	ReadNonLocal,
	ReadThis,
	// Invoking a function with side causes (according to previous scan)
	// Invoking a function from a blacklist / not in whitelist
	// Side effects:
	WriteNonLocal,
	WriteThis,
	WriteParam
	// Invoking a function with side effects (according to previous scan)
	// Invoking a function from a blacklist / not in whitelist
}

export interface FPError {
	type: ErrorType;
	ident: string;
	loc: SourceLocation | undefined;
}

export interface FunctionReport {
	loc: SourceLocation | undefined;
	name: string | null;
	locals: Set<string>;
	sideCauses: FPError[];
	sideEffects: FPError[];
}


function purecheck(code: string): FunctionReport[] {
	let tree = esprima.parse(code, {
		loc: true,
		comment: true,
		sourceType: 'module',
	});
	return tree.body
		.filter(node => node.type == 'FunctionDeclaration')
		.map((func: FunctionDeclaration) => checkFunc(func));
}

function checkFunc(fdec: FunctionDeclaration): FunctionReport {
	let locals = getLocalVars(fdec.body.body);
	return {
		loc: fdec.loc,
		name: fdec.id ? fdec.id.name : null,
		locals,
		sideCauses: checkSideCauses(fdec.body.body, locals),
		sideEffects: checkSideEffects(fdec.body.body, locals)
	};
}

function getLocalVars(statements: Statement[]): Set<string> {
	let query = '[*type=VariableDeclaration].declarations[*type=VariableDeclarator].id.name';
	let locals: string[] = JQ(query, statements);
	return new Set(locals);
}

function checkSideCauses(statements: Statement[], locals: Set<string>) {
	let result = [];
	statements.forEach(stmt => {
		//TODO recursively scan all expressions (phew!)
		//TODO check function calls with side causes
		//TODO check function calls from blacklist
	});
	return result;
}

function checkSideEffects(statements: Statement[], locals: Set<string>) {
	let result: FPError[] = [];
	statements.forEach(stmt => {
		if (isAssignment(stmt)) {
			let ident = getAssignmentTarget(stmt as ExpressionStatement);
			if (ident && !locals.has(ident)) {
				result.push({
					type: ErrorType.WriteNonLocal,
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
