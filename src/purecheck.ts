const esprima = require('esprima');

import { Node, Program, SourceLocation } from 'estree';
import { checkSideEffect } from './side-effects';
import { checkSideCause } from './side-causes';


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
		- Reading from this
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
			case 'ThisExpression':
				return checkIdentifier(node, errors);
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

function checkIdentifier(node, errors: FPError[]) {
	let localsAndParams = mergeSets(mergeLocals(node), mergeParams(node));
	addError(errors, checkSideCause(node, localsAndParams));
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

function mergeSets<T>(s1: Iterable<T>, s2: Iterable<T>): Set<T> {
	return new Set([...s1, ...s2]);
}

function mergeLocals(node: Node, locals = new Set<string>()): Set<string> {
	let parent = findParent(n => n.fp_locals, node);
	if (!parent)
		return locals;
	locals = mergeSets(parent.fp_locals, locals);
	return mergeLocals(parent, locals);
}

function mergeParams(node: Node, params = new Set<string>()): Set<string> {
	let parent = findParentFunction(node);
	if (!parent)
		return params;
	// TODO add support for func(param = defaultValue)
	// TODO add support for func(...rest)
	// TODO add support for func({ destructuring })
	parent.params.forEach(p => params.add(p.name));
	return mergeParams(parent, params);
}
