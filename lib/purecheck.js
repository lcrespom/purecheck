"use strict";
const esprima = require('esprima');
const side_effects_1 = require("./side-effects");
const side_causes_1 = require("./side-causes");
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = purecheck;
var ErrorType;
(function (ErrorType) {
    // Side causes
    ErrorType[ErrorType["ReadNonLocal"] = 0] = "ReadNonLocal";
    ErrorType[ErrorType["ReadThis"] = 1] = "ReadThis";
    // Side effects:
    ErrorType[ErrorType["WriteNonLocal"] = 2] = "WriteNonLocal";
    ErrorType[ErrorType["WriteThis"] = 3] = "WriteThis";
    // Others:
    ErrorType[ErrorType["InvokeImpure"] = 4] = "InvokeImpure";
    ErrorType[ErrorType["Throw"] = 5] = "Throw";
    ErrorType[ErrorType["MissingReturn"] = 6] = "MissingReturn";
    ErrorType[ErrorType["InvokeBlacklisted"] = 7] = "InvokeBlacklisted";
    ErrorType[ErrorType["InvokeNotWhitelisted"] = 8] = "InvokeNotWhitelisted";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
// -------------------- Main --------------------
function purecheck(code, { globals = OPT_GLOBALS } = {}) {
    let tree = esprima.parse(code, {
        loc: true,
        comment: true,
        sourceType: 'module',
    });
    let errors = [];
    walkTreeVars(tree);
    walkTreeCheckErrors(tree, errors, new Set(globals));
    walkTreeCheckImpureFunctions(tree, errors);
    return errorReport(errors);
}
function errorReport(errors) {
    return {
        errors,
        functions: groupByFunction(errors)
    };
}
function groupByFunction(errors) {
    let funcs = {};
    for (let e of errors) {
        let name = e.fname;
        if (!name)
            continue;
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
                }
                else if (child != void 0 && typeof child.type === 'string') {
                    child.parent = node;
                    stack.push(child);
                }
            }
        }
    }
}
// -------------------- First pass: gather local variables --------------------
function walkTreeVars(tree) {
    walkAddParent(tree, node => {
        if (!node || !node.type)
            return;
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
    node.fp_locals = new Set();
}
function addLocalVar(node) {
    let block = findParentBlock(node);
    if (!block || !block.fp_parent_function)
        return;
    if (!node.id || !node.id.name)
        return;
    block.fp_locals.add(node.id.name);
}
// --------------- Second pass: look for impure functions ---------------
function walkTreeCheckErrors(tree, errors, globals) {
    walkAddParent(tree, node => {
        if (!node || !node.type)
            return;
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
function checkAssignOrUpdate(node, errors) {
    addError(errors, side_effects_1.checkSideEffect(node, mergeLocals(node)));
}
function checkIdentifier(node, errors, globals) {
    if (node.type == 'Identifier'
        && globals.has(node.name))
        return;
    let localsAndParams = mergeSets(mergeLocals(node), mergeParams(node));
    addError(errors, side_causes_1.checkSideCause(node, localsAndParams));
}
function checkThrow(node, errors) {
    let fnode = findParentFunction(node);
    if (!fnode)
        return;
    addError(errors, {
        type: ErrorType.Throw,
        ident: 'throw',
        node,
        fnode
    });
}
// ---------- Third pass, iterative: look for calls to impure functions ----------
function walkTreeCheckImpureFunctions(tree, errors) {
    let nerrs;
    do {
        nerrs = errors.length;
        errors.sort(compareErrorLocations);
        setFunctionNames(errors);
        let impures = errors.reduce((impures, e) => e.fname ? impures.add(e.fname) : impures, new Set());
        walkAddParent(tree, node => checkCallExpression(node, errors, impures));
    } while (nerrs < errors.length);
}
function checkCallExpression(node, errors, impures) {
    if (node.type == 'Identifier'
        && node.parent
        && node.parent.type == 'CallExpression'
        && !node.fp_error
        && node.name
        && impures.has(node.name)) {
        let e = {
            type: ErrorType.InvokeImpure,
            ident: node.name,
            node,
            fnode: findParentFunction(node)
        };
        errors.push(e);
        node.fp_error = e;
    }
}
function compareErrorLocations(e1, e2) {
    if (!e1.node.loc || !e2.node.loc)
        return 0;
    let dline = e1.node.loc.start.line - e2.node.loc.start.line;
    if (dline)
        return dline;
    return e1.node.loc.start.column - e2.node.loc.start.column;
}
function setFunctionNames(errors) {
    for (let e of errors)
        if (!e.fname)
            e.fname = fname(e.fnode);
}
let act = 1;
function fname(node) {
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
function addError(errors, e) {
    if (e)
        errors.push(e);
}
function findParent(predicate, node) {
    if (!node.parent)
        return null;
    if (predicate(node.parent))
        return node.parent;
    return findParent(predicate, node.parent);
}
exports.findParent = findParent;
function findParentFunction(node) {
    return findParent(n => n.type == 'FunctionDeclaration'
        || n.type == 'FunctionExpression'
        || n.type == 'ArrowFunctionExpression', node);
}
exports.findParentFunction = findParentFunction;
function findParentBlock(node) {
    return findParent(n => n.type == 'BlockStatement', node);
}
exports.findParentBlock = findParentBlock;
function mergeSets(s1, s2) {
    return new Set([...s1, ...s2]);
}
function mergeLocals(node, locals = new Set()) {
    let parent = findParent(n => n.fp_locals, node);
    if (!parent)
        return locals;
    locals = mergeSets(parent.fp_locals, locals);
    return mergeLocals(parent, locals);
}
function mergeParams(node, params = new Set()) {
    let parent = findParentFunction(node);
    if (!parent)
        return params;
    // TODO add support for func(param = defaultValue)
    // TODO add support for func(...rest)
    // TODO add support for func({ destructuring })
    parent.params.forEach(p => params.add(p.name));
    return mergeParams(parent, params);
}
//# sourceMappingURL=purecheck.js.map