import { Expression, AssignmentExpression } from 'estree';

import { ErrorType, FPError } from './purecheck';


export function checkSideEffect(expr: Expression, locals: Set<string>): FPError | null {
	let ident: string | null = null;
	if (expr.type == 'AssignmentExpression')
		ident = getAssignmentTarget(expr);
	else if (expr.type == 'UpdateExpression')
		ident = expr.argument['name'];
	if (ident && !locals.has(ident))
		return fpError(ErrorType.WriteNonLocal, ident, expr.loc);
	else
		return null;
}

function getAssignmentTarget(expr: AssignmentExpression): string | null {
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

function fpError(type: ErrorType, ident: string, loc: any): FPError {
	return { type, ident, loc };
}
