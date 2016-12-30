import { Node, Expression, Pattern } from 'estree';

import { ErrorType, FPError, findParentFunction } from './purecheck';


export function checkSideEffect(expr: Expression, locals: Set<string>): FPError | null {
	let ident: string | null = null;
	if (expr.type == 'AssignmentExpression')
		ident = getTarget(expr.left);
	else if (expr.type == 'UpdateExpression')
		ident = getTarget(expr.argument);
	if (ident && !locals.has(ident))
		return fpError(ident, expr);
	else
		return null;
}

function fpError(ident: string, node: Node): FPError | null {
	let fnode = findParentFunction(node);
	if (!fnode) return null;
	return {
		type: ident == 'this' ? ErrorType.WriteThis : ErrorType.WriteNonLocal,
		ident,
		node,
		fnode
	};
}

function getTarget(patt: Expression | Pattern): string | null {
	if (patt.type == 'Identifier')
		return patt.name;
	while (patt.type == 'MemberExpression') {
		if (patt.object.type == 'Identifier')
			return patt.object.name;
		else if (patt.object.type == 'ThisExpression')
			return 'this';
		// Drill down tree until patt.object is not 'MemberExpression'
		else patt = patt.object as Expression;
	}
	return null;
}
