const esprima = require('esprima');

import { Node, Program, SourceLocation } from 'estree';
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
	node: Node;
}

function purecheck(code: string): FPError[] {
	let tree = esprima.parse(code, {
		loc: true,
		comment: true,
		sourceType: 'module',
	});
	let errors = [];
	walkTree(tree, errors);
	// TODO make a second pass to detect invocation of impure functions
	return errors;
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

// -------------------- Testing esprima-walk --------------------

// Stolen and adapted from esprima-walk
function walkAddParent(ast, fn) {
	let stack = [ast], i, j, key, len, node, child, subchild;
	for (i = 0; i < stack.length; i += 1) {
		node = stack[i];
		fn(node);
		for (key in node) {
			if (key !== 'parent' && key.substr(0, 3) != 'fp_') {
				child = node[key];
				if (child instanceof Array) {
					for (j = 0, len = child.length; j < len; j += 1) {
						subchild = child[j];
						if (subchild instanceof Object) {
							subchild.parent = node;
						}
						stack.push(subchild);
					}
				} else if (child != void 0 && typeof child.type === 'string') {
					child.parent = node;
					stack.push(child);
				}
			}
		}
	}
}

function walkTree(tree: Program, errors: FPError[]) {
	walkAddParent(tree, node => {
		switch (node.type) {
			case 'BlockStatement':
				return initBlock(node);
			case 'VariableDeclarator':
				return addLocalVar(node);
			case 'AssignmentExpression':
			case 'UpdateExpression':
				return checkAssignOrUpdate(node, errors);
			case 'Identifier':
				//return checkSideCause(node, errors);
		}
	});
}

function initBlock(node) {
	node.fp_parent_function = findParentFunction(node);
	node.fp_locals = new Set<string>();
}

function addLocalVar(node) {
	let block = findParentBlock(node);
	if (!block || !block.fp_parent_function) return;
	if (!node.id || !node.id.name) return;
	block.fp_locals.add(node.id.name);
}

function checkAssignOrUpdate(node, errors: FPError[]) {
	addError(errors, checkSideEffect(node, mergeLocals(node)));
}

function checkSideCause(node, errors: FPError[]) {
	if (skipSideCause(node)) return;
	let locals = mergeLocals(node);
	if (!locals.has(node.name))
		addError(errors, {
			type: node.name == 'this' ? ErrorType.ReadThis : ErrorType.ReadNonLocal,
			ident: node.name,
			loc: node.loc,
			node
		});
}

function skipSideCause(node): boolean {
	if (!node.parent) return true;
	// Skip function declaration identifiers
	if (node.parent.type == 'FunctionDeclaration') return true;
	// Skip member expressions e.g. "obj.ident" (except leftmost part)
	if (node.parent.type == 'MemberExpression'
		&& node.parent.property == node) return true;
	// Skip if direct assignment
	if (node.parent.type == 'AssignmentExpression'
		&& node.parent.left == node) return true;
	if (!node.parent.parent) return false;
	// If we are here, only consider skipping composite assignment expressions
	if (node.parent.parent.type != 'AssignmentExpression') return false;
	// Skip if left side of assignment expression
	return node.parent.parent.left == node.parent;
}


// --------------- Walk tree helpers ---------------

function addError(errors, e) {
	if (e) errors.push(e);
}

// TODO curry this function
export function findParent(predicate, node) {
	if (!node.parent) return null;
	if (predicate(node.parent)) return node.parent;
	return findParent(predicate, node.parent);
}

// TODO const findParentFunction = findParent(n => n.fp_data)
export function findParentFunction(node) {
	return findParent(
		n => n.type == 'FunctionDeclaration',
		node);
}

// TODO const findParentBlock = findParent(n => n.type == 'BlockStatement')
export function findParentBlock(node) {
	return findParent(n => n.type == 'BlockStatement', node);
}

function mergeLocals(node, locals = new Set<string>()): Set<string> {
	let parent = findParent(n => n.fp_locals, node);
	if (!parent)
		return locals;
	parent.fp_locals.forEach(l => locals.add(l));
	return mergeLocals(parent, locals);
}
