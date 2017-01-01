"use strict";
const esprima = require('esprima');
const side_effects_1 = require("./side-effects");
const side_causes_1 = require("./side-causes");
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = purecheck;
var ErrorType;
(function (ErrorType) {
    // Side causes
    ErrorType[ErrorType["ReadNonLocal"] = 0] = "ReadNonLocal";
    ErrorType[ErrorType["ReadThis"] = 1] = "ReadThis";
    ErrorType[ErrorType["InvokeSideCauses"] = 2] = "InvokeSideCauses";
    // Invoking a function with side causes (according to previous scan)
    // Invoking a function from a blacklist / not in whitelist
    // Side effects:
    ErrorType[ErrorType["WriteNonLocal"] = 3] = "WriteNonLocal";
    ErrorType[ErrorType["WriteThis"] = 4] = "WriteThis";
    ErrorType[ErrorType["InvokeSideEffects"] = 5] = "InvokeSideEffects";
    // Invoking a function with side effects (according to previous scan)
    // Invoking a function from a blacklist / not in whitelist
    // Other:
    ErrorType[ErrorType["Throw"] = 6] = "Throw";
    ErrorType[ErrorType["MissingReturn"] = 7] = "MissingReturn";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
// -------------------- Main --------------------
function purecheck(code) {
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
function errorReport(errors) {
    errors.sort((e1, e2) => {
        if (!e1.node.loc || !e2.node.loc)
            return 0;
        let dline = e1.node.loc.start.line - e2.node.loc.start.line;
        if (dline)
            return dline;
        return e1.node.loc.start.column - e2.node.loc.start.column;
    });
    return {
        errors,
        functions: groupByFunction(errors)
    };
}
function groupByFunction(errors) {
    let funcs = {};
    for (let e of errors) {
        let name = fname(e.fnode);
        if (!funcs[name])
            funcs[name] = { name, errors: [], loc: e.fnode.loc };
        funcs[name].errors.push(e);
    }
    return funcs;
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
function walkTreeVars(tree) {
    walkAddParent(tree, node => {
        switch (node.type) {
            case 'BlockStatement':
                return initBlock(node);
            case 'VariableDeclarator':
                return addLocalVar(node);
        }
    });
}
function walkTreeCheckErrors(tree, errors) {
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
function checkAssignOrUpdate(node, errors) {
    addError(errors, side_effects_1.checkSideEffect(node, mergeLocals(node)));
}
function checkIdentifier(node, errors) {
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
// --------------- Walk tree helpers ---------------
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