const esprima = require('esprima');

import { Node, Program, SourceLocation, FunctionDeclaration } from 'estree';
import { checkSideEffect } from './side-effects';
import { checkSideCause } from './side-causes';


// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const OPT_GLOBALS = [
	// Value properties
	'Infinity', 'NaN', 'undefined',
	// Fundamental objects
	'Object', 'Function', 'Boolean', 'Symbol', 'Error', 'EvalError',
	'InternalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError',
	'URIError',
	// Numbers and dates
	'Number', 'Math', 'Date',
	// Text processing
	'String', 'RegExp',
	// Indexed collections
	'Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
	'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
	// Keyed collections
	'Map', 'Set', 'WeakMap', 'WeakSet',
	// Structured data
	'ArrayBuffer', 'DataView', 'JSON',
	// Control abstraction objects
	'Promise', 'Generator', 'GeneratorFunction',
	// Reflection
	'Reflect', 'Proxy',
	// Internationalization
	'Intl',
	// Other
	'arguments'
];


export default purecheck;

export enum ErrorType {
	// Side causes
	ReadNonLocal,
	ReadThis,
	// Side effects:
	WriteNonLocal,
	WriteThis,
	// Others:
	InvokeImpure,
	Throw,
	MissingReturn,
	InvokeBlacklisted,
	InvokeNotWhitelisted
}

export interface FPError {
	type: ErrorType;
	ident: string;
	node: Node;
	fnode: FunctionDeclaration;
	fname?: string;
}

export interface FunctionReport {
	name: string;
	loc?: SourceLocation;
	errors: FPError[];
}

type FunctionTable = { [fname: string]: FunctionReport; };

export interface FPErrorReport {
	errors: FPError[];
	functions: FunctionTable;
}


// -------------------- Main --------------------

function purecheck(code: string,
	{ globals = OPT_GLOBALS } = {}): FPErrorReport {
	let tree = esprima.parse(code, {
		loc: true,
		comment: true,
		sourceType: 'module',
	});
	return checkTree(tree, globals);
}

export function checkTree(tree, globals: string[]): FPErrorReport {
	let errors = [];
	walkTreeVars(tree);
	walkTreeCheckErrors(tree, errors, new Set(globals));
	walkTreeCheckImpureFunctions(tree, errors);
	return errorReport(errors);
}

function errorReport(errors: FPError[]): FPErrorReport {
	return {
		errors,
		functions: groupByFunction(errors)
	};
}

function groupByFunction(errors: FPError[]): FunctionTable {
	let funcs: FunctionTable = {};
	for (let e of errors) {
		let name = e.fname;
		if (!name) continue;
		if (!funcs[name])
			funcs[name] = { name, errors: [], loc: e.fnode.loc };
		funcs[name].errors.push(e);
	}
	return funcs;
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


// -------------------- First pass: gather local variables --------------------

function walkTreeVars(tree: Program) {
	walkAddParent(tree, node => {
		if (!node || !node.type) return;
		switch (node.type) {
			case 'BlockStatement':
				return initBlock(node);
			case 'VariableDeclarator':
				return addLocalVar(node);
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


// --------------- Second pass: look for impure functions ---------------

function walkTreeCheckErrors(tree: Program, errors: FPError[], globals: Set<string>) {
	walkAddParent(tree, node => {
		if (!node || !node.type) return;
		switch (node.type) {
			case 'AssignmentExpression':
			case 'UpdateExpression':
				return checkAssignOrUpdate(node, errors);
			case 'Identifier':
			case 'ThisExpression':
				return checkIdentifier(node, errors, globals);
			case 'ThrowStatement':
				return checkThrow(node, errors);
		}
	});
}

function checkAssignOrUpdate(node, errors: FPError[]) {
	addError(errors, checkSideEffect(node, mergeLocals(node)));
}

function checkIdentifier(node, errors: FPError[], globals: Set<string>) {
	if (node.type == 'Identifier'
		&& globals.has(node.name)) return;
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


// ---------- Third pass, iterative: look for calls to impure functions ----------

function walkTreeCheckImpureFunctions(tree: Program, errors: FPError[]) {
	let nerrs;
	do {
		nerrs = errors.length;
		errors.sort(compareErrorLocations);
		setFunctionNames(errors);
		let impures: Set<string> = errors.reduce(
			(impures, e) => e.fname ? impures.add(e.fname) : impures,
			new Set<string>()
		);
		walkAddParent(tree, node => checkCallExpression(node, errors, impures));
	} while (nerrs < errors.length);
}

function checkCallExpression(node, errors: FPError[], impures: Set<string>) {
	if (node.type == 'Identifier'
		&& node.parent
		&& node.parent.type == 'CallExpression'
		&& !node.fp_error
		&& node.name
		// TODO calculate path of invoked function
		&& impures.has(node.name)) {
			let e: FPError = {
				type: ErrorType.InvokeImpure,
				ident: node.name,
				node,
				fnode: findParentFunction(node)
			};
			errors.push(e);
			node.fp_error = e;
		}
}

function compareErrorLocations(e1: FPError, e2: FPError) {
	if (!e1.node.loc || !e2.node.loc) return 0;
	let dline = e1.node.loc.start.line - e2.node.loc.start.line;
	if (dline) return dline;
	return e1.node.loc.start.column - e2.node.loc.start.column;
}

function setFunctionNames(errors: FPError[]) {
	for (let e of errors)
		if (!e.fname)
			e.fname = fname(e.fnode);
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


// --------------- Helpers ---------------

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
