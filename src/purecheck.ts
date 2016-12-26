const esprima = require('esprima');

import { Program, SourceLocation } from 'estree';
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

function purecheck(code: string): FPError[] {
	let tree = esprima.parse(code, {
		loc: true,
		comment: true,
		sourceType: 'module',
	});
	let errors = [];
	walkTree(tree, errors);
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
				return checkAssignment(node, errors);
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

function checkAssignment(node, errors: FPError[]) {
	let error = checkSideEffect(node, mergeLocals(node));
	if (error)
		errors.push(error);
}

// --------------- Walk tree helpers ---------------

// TODO curry this function
function findParent(predicate, node) {
	if (!node.parent) return null;
	if (predicate(node.parent)) return node.parent;
	return findParent(predicate, node.parent);
}

// TODO const findParentFunction = findParent(n => n.fp_data)
function findParentFunction(node) {
	return findParent(
		n => n.type == 'FunctionDeclaration',
		node);
}

// TODO const findParentBlock = findParent(n => n.type == 'BlockStatement')
function findParentBlock(node) {
	return findParent(n => n.type == 'BlockStatement', node);
}

function mergeLocals(node, locals = new Set<string>()): Set<string> {
	let parent = findParent(n => n.fp_locals, node);
	if (!parent)
		return locals;
	parent.fp_locals.forEach(l => locals.add(l));
	return mergeLocals(parent, locals);
}

