"use strict";
const purecheck_1 = require("./purecheck");
function checkSideCause(node, locals) {
    if (skipSideCause(node, 0))
        return null;
    if (!locals.has(node.name))
        return fpError(node);
    else
        return null;
}
exports.checkSideCause = checkSideCause;
function fpError(node) {
    let fnode = purecheck_1.findParentFunction(node);
    if (!fnode)
        return null;
    let ident, type;
    if (node.type == 'ThisExpression') {
        ident = 'this';
        type = purecheck_1.ErrorType.ReadThis;
    }
    else {
        ident = node.name;
        type = purecheck_1.ErrorType.ReadNonLocal;
    }
    return { type, ident, node, fnode };
}
function skipSideCause(node, level) {
    if (!node.parent)
        return true;
    switch (node.parent.type) {
        // Skip function declaration/expression identifiers
        case 'FunctionDeclaration':
        case 'FunctionExpression':
            return true;
        // Skip function invocations (to be checked elsewhere)
        case 'CallExpression':
            return level == 0;
        // Skip if update expression (handled by side effect)
        case 'UpdateExpression':
            return true;
        // Skip if left side of direct assignment
        case 'AssignmentExpression':
            return node.parent.left == node;
        // Skip object property identifiers e.g. "obj.prop",
        // But catch computed properties, e.g. "obj[prop]"
        case 'MemberExpression':
            if (node.parent.property == node)
                return !node.parent.computed;
            return skipSideCause(node.parent, level + 1);
        default:
            return false;
    }
}
//# sourceMappingURL=side-causes.js.map