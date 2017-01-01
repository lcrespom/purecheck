"use strict";
const purecheck_1 = require("./purecheck");
function checkSideEffect(expr, locals) {
    let ident = null;
    if (expr.type == 'AssignmentExpression')
        ident = getTarget(expr.left);
    else if (expr.type == 'UpdateExpression')
        ident = getTarget(expr.argument);
    if (ident && !locals.has(ident))
        return fpError(ident, expr);
    else
        return null;
}
exports.checkSideEffect = checkSideEffect;
function fpError(ident, node) {
    let fnode = purecheck_1.findParentFunction(node);
    if (!fnode)
        return null;
    return {
        type: ident == 'this' ? purecheck_1.ErrorType.WriteThis : purecheck_1.ErrorType.WriteNonLocal,
        ident,
        node,
        fnode
    };
}
function getTarget(patt) {
    if (patt.type == 'Identifier')
        return patt.name;
    while (patt.type == 'MemberExpression') {
        if (patt.object.type == 'Identifier')
            return patt.object.name;
        else if (patt.object.type == 'ThisExpression')
            return 'this';
        else
            patt = patt.object;
    }
    return null;
}
//# sourceMappingURL=side-effects.js.map