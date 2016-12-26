# Purecheck
Purecheck is inspired by [this article](http://blog.jenkster.com/2015/12/what-is-functional-programming.html).
Purecheck scans JavaScript code and looks for function declarations, checking whether they are pure functions or not.
For a function to be pure, it must:
- Have no side effects, i.e.:
  - Only local variables should be modified. A function that modifies parameters, `this` or variables from other scopes has side effects.
  - Only invoke functions that have no side effects.
- Have no side causes, i.e.:
  - Depend exclusively on the input parameters. Accessing variables from other scopes depends on side causes.
  - Only invoke functions that have no side causes.

Purecheck generates a report listing all scanned functions along with their associated side causes and side effects. It uses [Esprima](http://esprima.org/) to do the parsing.

## Setup
- Install: `npm install`
- Build: `npm run build`

## Usage
`npm start < file_to_check.js`

## Notice
Purecheck is in a very early stage. For now, it only detects variable modification side effects from top-level functions.
All these tasks are pending:
- Recursive scan of function declarations at any level inside the code.
- Support ES6 modules to recursively scan dependencies.
- Check for function calls to functions with side effects (multiple passes required).
- Check for function calls to functions known to have side effects, from a user-provided black list.
- Check for side causes from accessing non-local variables.
- Check for function calls to functions with side causes (multiple passes required).
- Check for function cals to functions known to have side causes, from a user-provided black list.


## Environment
- TypeScript
- Functional style, consider Ramda
- Automated testing based on set of testing files + test specs (maybe test itself)

## ToDo
- Improve report structure
- Detect side causes
- Make a second pass to detect invocation of functions with side effects