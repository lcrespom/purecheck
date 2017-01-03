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
- Never `throw` any error: pure functions do not break the execution flow
- Should always return some value: given that pure functions have no side effects, if they don't return any value, they are totally useless anyway.

Purecheck generates a report listing all scanned functions along with their associated side causes and side effects. It uses [Esprima](http://esprima.org/) to do the parsing.

## Setup
- Install: `npm install`
- Build: `npm run build`

## Usage
- If you have installed it via `npm install purecheck`:
	- `purecheck file_to_check.js`
- If you have cloned the repository:
	- `npm start file_to_check.js`

If no file is specified, purecheck will read from the standard input. This allows piping the output of another command, e.g. a transpile step.

### Command-line parameters
- `--tabsize`, `-t`: purecheck reports errors specifying the line and column of the offending code. When the JS file has tabs, the column position may not be reported correctly, so this parameter can be used to specify the number of spaces used by a tab. The default value is 4 spaces per tab.
	- Example: `purecheck --tabsize 3`

### ESLint plugin
There is an [ESLint plugin](https://github.com/lcrespom/eslint-plugin-purecheck) available, so purecheck can be used from the ESLint tool. This is especially useful when integrated in editors/IDEs such as Visual Studio Code.


## Notice
Purecheck is still under development. Check the ToDo section below for details.

## Rules for pure functions
This list provides more detail about the rules mentioned above:

1. Should not have side causes, i.e., should not:
	1. Read a non-local variable
	2. Read from `this`
2. Should not have side effects, i.e., should not:
	1. Write to a non-local variable
	2. Write to a parameter
	3. Write to `this`
3. Should not invoke impure functions
4. Should not invoke a function from a blacklist of non-pure functions (pending)
5. Alternatively, should only invoke its own pure functions and functions in a whitelist of safe functions (pending)
6. The `throw` statement is not allowed within pure functions
7. Pure functions should explicitly return some value. Otherwise, if they don't have side effects and return nothing, they are useless and their invocation can be replaced by `undefined` (pending)


## ToDo
- Improve CLI
	- Read configuration from purecheck.json
- Check for:
	- All branches should return some value
	- Function blacklist / whitelist
- Test it with big, real-world JS files to ensure it does not crash
- Catch invocation of nested impure functions
- Support ES6-style params: defaults, rest and destructuring
- Check for source maps, and if present, use them to translate error locations. This would provide support for TypeScript (and potentially other similar languages)
- Improve tab expansion implementation so it adds only the spaces remaining to the next tab position.
