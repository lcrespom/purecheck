const esprima = require('esprima');

import { Node, Program, SourceLocation, FunctionDeclaration } from 'estree';
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
	InvokeSideEffects,
	// Invoking a function with side effects (according to previous scan)
	// Invoking a function from a blacklist / not in whitelist
	// Other:
	Throw,
	MissingReturn
}

export interface FPError {
	type: ErrorType;
	ident: string;
	node: Node;
	fnode: FunctionDeclaration;
}

export interface FunctionReport {
	name: string;
	loc?: SourceLocation;
	errors: FPError[];
}

type FunctionTable = { [fname: string]: FunctionReport; }

export interface FPErrorReport {
	errors: FPError[];
	functions: FunctionTable;
}

// -------------------- Main --------------------

function purecheck(code: string): FPErrorReport {
	let tree = esprima.parse(code, {
		loc: true,
		comment: true,
		sourceType: 'module',
	});
	let errors = [];
	walkTreeVars(tree);
	walkTreeCheckErrors(tree, errors);
	// TODO make a second pass to detect invocation of impure functions
	return errorReport(errors);
}

function errorReport(errors: FPError[]): FPErrorReport {
	errors.sort((e1, e2) => {
		if (!e1.node.loc || !e2.node.loc) return 0;
		let dline = e1.node.loc.start.line - e2.node.loc.start.line;
		if (dline) return dline;
		return e1.node.loc.start.column - e2.node.loc.start.column;
	});
	return {
		errors,
		functions: groupByFunction(errors)
	};
}

function groupByFunction(errors: FPError[]): FunctionTable {
	let funcs: FunctionTable = {};
	for (let e of errors) {
		let name = fname(e.fnode);
		if (!funcs[name])
			funcs[name] = { name, errors: [], loc: e.fnode.loc };
		funcs[name].errors.push(e);
	}
	return funcs;
}

let act = 1;

function fname(node): string {
	let name;
	if (node.id) {
		name = node.id.name;
	}
	else {
		name = `<anonymous-${act}>`;
		act++;
	}
	let pf = findParentFunction(node);
	if (pf)
		name = fname(pf) + '/' + name;
	return name;
}


// -------------------- Tree walk --------------------

// Adapted from esprima-walk to skip properties starting with "fp_"
// Warning: walk is not recursive and may visit nodes that appear later
// 		in the code before visiting other nodes that appear earlier in the code
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

function walkTreeVars(tree: Program) {
	walkAddParent(tree, node => {
		switch (node.type) {
			case 'BlockStatement':
				return initBlock(node);
			case 'VariableDeclarator':
				return addLocalVar(node);
		}
	});
}

function walkTreeCheckErrors(tree: Program, errors: FPError[]) {
	walkAddParent(tree, node => {
		switch (node.type) {
			case 'AssignmentExpression':
			case 'UpdateExpression':
				return checkAssignOrUpdate(node, errors);
			case 'Identifier':
			case 'ThisExpression':
				return checkIdentifier(node, errors);
			case 'ThrowStatement':
				return checkThrow(node, errors);
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

function checkThrow(node, errors: FPError[]) {
	let fnode = findParentFunction(node);
	if (!fnode) return;
	addError(errors, {
		type: ErrorType.Throw,
		ident: 'throw',
		node,
		fnode
	});
}

// --------------- Walk tree helpers ---------------

function addError(errors, e: FPError | null) {
	if (e) errors.push(e);
}

export function findParent(predicate, node) {
	if (!node.parent) return null;
	if (predicate(node.parent)) return node.parent;
	return findParent(predicate, node.parent);
}

export function findParentFunction(node) {
	return findParent(
		n => n.type == 'FunctionDeclaration'
			|| n.type == 'FunctionExpression'
			|| n.type == 'ArrowFunctionExpression',
		node);
}

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
