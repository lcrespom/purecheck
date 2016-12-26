import { Node, Expression, Pattern } from 'estree';

import { ErrorType, FPError } from './purecheck';


export function checkSideEffect(expr: Expression, locals: Set<string>): FPError | null {
	let ident: string | null = null;
	if (expr.type == 'AssignmentExpression')
		ident = getTarget(expr.left);
	else if (expr.type == 'UpdateExpression')
		ident = getTarget(expr.argument);
	if (ident && !locals.has(ident))
		return fpError(
			ident == 'this' ? ErrorType.WriteThis : ErrorType.WriteNonLocal,
			ident, expr.loc, expr);
	else
		return null;
}

function getTarget(patt: Expression | Pattern): string | null {
	if (patt.type == 'Identifier')
		return patt.name;
	else if (patt.type == 'MemberExpression') {
		if (patt.object.type == 'Identifier')
			return patt.object.name;
		else if (patt.object.type == 'ThisExpression')
			return 'this';
	}
	return null;
}

function fpError(type: ErrorType, ident: string, loc: any, node: Node): FPError {
	return { type, ident, loc, node };
}
