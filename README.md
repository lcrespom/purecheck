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
`npm start < file_to_check.js`

## Notice
Purecheck is still under development. Check ToDo section below for details.

## Rules for pure functions
This list provides more detail about the rules mentioned above:

1. Should not have side causes, i.e., should not:
	1. Read a non-local variable
	2. Read from `this`
	3. Invoke a function with side causes (pending - requires multiple passes)
2. Should not have side effects, i.e., should not:
	1. Write to a non-local variable
	2. Write to a parameter
	3. Write to `this`
	4. Invoke a function with side effects (pending - requires multiple passes)
3. Should not invoke a function from a blacklist of non-pure functions (pending)
4. Alternatively, should only invoke its own pure functions and functions in a whitelist of safe functions (pending)
5. The `throw` statement is not allowed within pure functions
6. Pure functions should explicitly return some value. Otherwise, if they don't have side effects and return nothing, they are useless and their invocation can be replaced by `undefined` (pending)


## ToDo
- Make `main.ts` useful
	- Parameters / configuration
	- Make it available in ./bin, see http://blog.npmjs.org/post/118810260230/building-a-simple-command-line-tool-with-npm
- Check for:
	- Cascading of side cause / side effects: make a second pass to detect invocation of functions with side causes/effects
		- Should actually iterate until no new errors added (configurable)
	- All branches should return some value
- Function blacklist / whitelist
- Support ES6-style params: defaults, rest and destructuring
- Check for source maps, and if present, use them to translate error locations. This would provide support for TypeScript (and potentially other similar languages)
