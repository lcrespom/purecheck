import { Identifier, ThisExpression } from 'estree';
import { ErrorType, FPError, findParentFunction } from './purecheck';


export function checkSideCause(node: Identifier, locals: Set<string>): FPError | null {
	if (skipSideCause(node)) return null;
	if (!locals.has(node.name))
		return fpError(node);
	else
		return null;
}

function fpError(node: Identifier | ThisExpression): FPError | null {
	let fnode = findParentFunction(node);
	if (!fnode) return null;
	let ident, type;
	if (node.type == 'ThisExpression') {
		ident = 'this';
		type = ErrorType.ReadThis;
	}
	else {
		ident = node.name;
		type = ErrorType.ReadNonLocal;
	}
	return { type, ident, node, fnode };
}

function skipSideCause(node): boolean {
	if (!node.parent) return true;
	switch (node.parent.type) {
		// Skip function declaration/expression identifiers
		case 'FunctionDeclaration':
		case 'FunctionExpression':
			return true;
		// Skip function invocations (to be checked elsewhere)
		case 'CallExpression':
			return true;
		// Skip if update expression (handled by side effect)
		case 'UpdateExpression':
			return true;
		// Skip if left side of direct assignment
		case 'AssignmentExpression':
			return node.parent.left == node;
		// Skip object property identifiers e.g. "obj.prop",
		// But catch computed properties, e.g. "obj[prop]"
		case 'MemberExpression':
			if (node.parent.property == node) return !node.parent.computed;
			return skipSideCause(node.parent);
		default:
			return false;
	}
}
