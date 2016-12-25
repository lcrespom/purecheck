import * as esprima from 'esprima';
import { SourceLocation,
	Expression, Statement,
	FunctionDeclaration } from 'estree';
import * as jsonQuery from 'json-query';
let JQ = (q, data) => jsonQuery(q, { data }).value;

import { checkSideEffect } from './side-effects';


export default purecheck;

export enum ErrorType {
	// Side causes
	ReadNonLocal,
	ReadThis,
	InvokeSideCauses,
	// Invoking a function with side causes (according to previous scan)
	// Invoking a function from a blacklist / not in whitelist
	// Side effects:
	WriteNonLocal,
	WriteThis,
	InvokeSideEffects
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
	errors: FPError[];
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
		errors: validateBody(fdec.body.body, locals)
	};
}

function getLocalVars(statements: Statement[]): Set<string> {
	let query = '[*type=VariableDeclaration].declarations[*type=VariableDeclarator].id.name';
	let locals: string[] = JQ(query, statements);
	return new Set(locals);
}

function validateBody(statements: Statement[], locals: Set<string>): FPError[] {
	let errors: FPError[] = [];
	statements.forEach(stmt => {
		if (!recurStatements(stmt, locals)) {
			if (stmt.type == 'ExpressionStatement') {
				let error = validateExpression(stmt.expression, locals);
				if (error) errors.push(error);
			}
		}
	});
	return errors;
}

function recurStatements(stmt: Statement, locals: Set<string>): boolean {
	//TODO recursive dive on statements with blocks
	return false;
}

function validateExpression(expr: Expression, locals: Set<string>): FPError | null {
	//TODO recursive dive on expression tree
	return checkSideCause(expr, locals)
		|| checkSideEffect(expr, locals);
}

function checkSideCause(expr: Expression, locals: Set<string>): FPError | null {
	return null;
}

/*
	Side causes:
		- Reading a non-local variable
		- Reading from this (configurable)
		- Invoking a function with side causes (according to previous scan)
		- Invoking a function from a blacklist
	Side effects:
		- Writing to a non-local variable
		- Writing to a parameter member (including this)
		- Invoking a function with side effects (according to previous scan)
		- Invoking a function from a blacklist
*/
