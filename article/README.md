# Developing with Sight Skope

(scope is written as skope purposefully :P)

## Motivation

I was working on a frontend project which had lots of contributors and coding style was misplaced somewhere along the way. This meant different developers writing different patterns. As the project grew and different javascript files exposed different classes and modules (not using module exports :( just to be clear) it became difficult to identify which file was dependent on the other. This meant that debugging and fixing code smell was difficult. Not to mention the circular dependency hell. Just like with a gun I needed a scope to better aim at bugs.

## Developing a Scope Calculator

We will be using Abstract Syntax Tree (or AST for short) to get information about our code which we can analyze easily. I won't be getting into much detail regarding AST here since [this](https://medium.com/basecs/leveling-up-ones-parsing-game-with-asts-d7a6fc2400ff) article covers it pretty well so do give it a read. To sum it up quite nicely and move forward without much deeper dive -

> An AST only contains the information related to analyzing the source text and skips any other extra content that is used while parsing the text.

To build such an AST for our JavaScript files we will be using [acorn](https://github.com/acornjs/acorn) (it is a JavaScript parser) and [acorn-walk](https://github.com/acornjs/acorn/tree/master/acorn-walk) (a syntax tree, generated via acorn, walker). Let's take a sample of (very poorly written) JavaScript (ES5) code.

```js
var a = 1;

(function () {
  var b = 2;

  console.log(b);

  // FIXME: Unused function declarations are also counted.
  function c() {
    d = 3;
  }

  window.e = function () {
    b++;
  };
})();

function f() {
  console.log("I'm too lazy to write a good example.");
}
```

Before we get to develop a logic to detect declarations let's list down what we would expect the resulting declarations to be.

1. Variable `a` and function `f()` are declared in the global scope.
2. Variable `d` is a global variable by definition since we have omitted the `var` keyword.
3. Function property `e()` of the `window` object is inherently a global identifier in browsers.

So for our snippet, we expect the declarations to be `a`, `f`, `d`, and `e` (let's stay simple for this example and not separate functions and variables) which are exposed to other snippets it might get used or included with.

To generate AST using acorn first we need to read the JavaScript code from the file. The parser returns an AST object as specified by the [ESTree spec](https://github.com/estree/estree), which is a node of type `Program` the body of which contains successive nodes of defined types as per your code snippet.

```js
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

console.log(tree)
```

To visualize the generated tree I have written a [script](https://github.com/divyamamgai/skope/blob/master/test/createGraph.js) that creates an [SVG](https://raw.githubusercontent.com/divyamamgai/skope/master/article/images/fileGraph.svg?sanitize=true) file of the tree (excluding some nodes), attached below. I recommend console logging or debugging the nodes to get more insights, currently, it's just a nutshell and only shows the `type` of the nodes.

![AST Visualization](https://raw.githubusercontent.com/divyamamgai/skope/master/article/images/fileGraph.svg?sanitize=true)

Now we can traverse the resulting tree in several ways using Acorn AST walker as outlined [here](https://github.com/acornjs/acorn/tree/master/acorn-walk#interface), take time to read these methods before moving forward. We will be using the `ancestor` walker, which does a `simple` walk over a tree, building up an array of ancestor nodes (including the current node) and passing the resulting array to the callbacks as a second parameter.

You can associate callback to each node type. As soon as the walker reaches a particular node, it fires the callback for that node with `node` and its `ancestors` as parameters.

```js
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const acornWalk = require('acorn-walk')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

acornWalk.ancestor(tree, {
  VariableDeclarator(node, ancestors) {
    const name = node.id.name

    console.log(`Declared Variable ${name}`,
      ancestors.map(ancestor => ancestor.type))
  }
})
```

### Getting Scope of an Identifier in JavaScript

In the JavaScript scope of an identifier is functional (considering ES5 syntax and keeping complexity to a minimum). Hence, if we want to get the scope of any identifier node we only need to bubble up to its ancestor nodes till we reach a function node ([`FunctionExpression`](https://github.com/estree/estree/blob/master/es5.md#functionexpression) or [`FunctionDeclaration`](https://github.com/estree/estree/blob/master/es5.md#functiondeclaration)), if we do, which will make it local or functional scoped. Else if we reach [`Program`](https://github.com/estree/estree/blob/master/es5.md#programs) node then it is globally scoped. Let's create a simple stub that accepts an array of ancestor nodes of an identifier and returns the scope of that identifier as - `Program|FunctionExpression|FunctionDeclaration` node.

```js
const getScope = (ancestors) => {
  let ancestorIndex = ancestors.length - 1
  while (ancestorIndex >= 0) {
    const ancestor = ancestors[ancestorIndex]
    switch (ancestor.type) {
      case 'FunctionExpression':
      case 'FunctionDeclaration':
      case 'Program':
        return ancestor
    }
    ancestorIndex--
  }
  return null
}
```

### Direct Declarations in Global Scope

To know if a Variable or Function declaration is done directly on the global scope, using our graph as a basis, it is clear that we need to detect if the direct parent of the declaration node is a `Program` node. To do this we will use [`VariableDeclarator`](https://github.com/estree/estree/blob/master/es5.md#variabledeclarator) and `FunctionDeclaration` callbacks (since it will give us the identifier name as `node.id.name`) with ancestor walker. We will use `getScope` stub to get the scope of the node and compare the scope node type to `Program`, if yes we push it to `globalDeclarations` list.

```js
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const acornWalk = require('acorn-walk')

const getScope = require('../../src/utils/getScope')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

let globalDeclarations = []

acornWalk.ancestor(tree, {
  VariableDeclarator (node, ancestors) {
    const name = node.id.name

    /*
    `ancestors` contains the `VariableDeclarator` node itself,
    hence we can remove it.  Also `VariableDeclarator` nodes
    are preceeded by `VariableDeclaration` node and hence we
    can omit them too.
    */
    if (getScope(ancestors.slice(0, -2)).type === 'Program') {
      globalDeclarations.push(name)
    }
  },
  FunctionDeclaration (node, ancestors) {
    const name = node.id.name

    if (getScope(ancestors.slice(0, -1)).type === 'Program') {
      globalDeclarations.push(name)
    }
  }
})

console.log(globalDeclarations)
```

When we execute the above code (with our [`sample.js`](https://github.com/divyamamgai/skope/blob/master/article/scripts/sample.js)), we expect the output to be `a` and `f`.

### Indirect Declarations in Global Scope

An identifier can be declared in the global scope indirectly, even from a functional block. We will be focusing on two methods this can be achieved -

1. Creating a property of an identifier in the `window` object.
2. Omitting `var` keyword while declaring (or assigning) an identifier.

To detect the above two cases, we will be using the [`AssignmentExpression`](https://github.com/estree/estree/blob/master/es5.md#assignmentexpression) node since in both an assignment is being performed. `AssignmentExpression` node has two child nodes - `left` and `right`.

#### Case #1

For case #1 we have to check if the `left` node of the `AssignmentExpression` is a [`MemberExpression`](https://github.com/estree/estree/blob/master/es5.md#memberexpression) of the `window` object. A `MemberExpression` accesses an object's member or property (for example `window.location`). So in the context of `AssignmentExpression` we are accessing a specified key of the `window` object and assigning a value to it.

Before we move ahead let's write a simple utility `getName()` to get us a readable name from the `MemberExpression` node. In a `MemberExpression` node, we have two properties - `object` and `property`. `object` will be an [`Identifier`](https://github.com/estree/estree/blob/master/es5.md#identifier) whereas `property` will be `Identifier|MemberExpression` and hence we will need to recursively call the utility till we reach an `Identifier` node whose name can be retrieved using `name` property.

```js
const getName = (node) => {
  let name = ''

  switch (node.type) {
    case 'Identifier':
      name = node.name
      break
    case 'MemberExpression':
      name = `${getName(node.object)}.${getName(node.property)}`
      break
  }

  return name
}
```

We have to use `AssignmentExpression` callback of the ancestor walker. Call our utility `getName(node.left)` to get name, check if the left node is of type `MemberExpression` and name is of the format - `window.identifier`. If it does then the `identifier` is a global variable.

```js
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const acornWalk = require('acorn-walk')

const getName = require('../../src/utils/getName')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

let assignmentsHash = {}

acornWalk.ancestor(tree, {
  AssignmentExpression (node) {
    const name = getName(node.left)

    switch (node.left.type) {
      case 'MemberExpression':
        let nameSplit = name.split('.')
        /*
        Check if the name of the format - `window.identifier`
        and extract the `identifier` name.
        */
        if (nameSplit[0] === 'window' && nameSplit.length === 2) {
          assignmentsHash[nameSplit[1]] = assignmentsHash[nameSplit[1]] || 0
          assignmentsHash[nameSplit[1]]++
        }
        break
    }
  }
})

const globalDeclarations = Object.keys(assignmentsHash)

console.log(globalDeclarations)
```

When we execute the above code (with our [`sample.js`](https://github.com/divyamamgai/skope/blob/master/article/scripts/sample.js)), we expect the output to be `e`.

#### Case #2

For case #2 it will be a bit complicated. To detect if the `var` keyword was omitted one easy way is as follows.

1. Capture all of the declarations made in the given snippet.
2. Capture all of the assignments made to non-function parameter identifiers in the given snippet.
3. Filter out all of the captured identifier assignments which have corresponding declarations.

We have already seen how we can capture declarations in the previous sections. Let's see how we can capture the assignment of identifiers, specially non-function parameter ones. What do we mean by the "non-function parameter"? Essentially we can re-assign value to the function parameters without using `var` keyword. For these parameters, there won't be a declaration counterpart, and hence we will have to exclude them beforehand.

To detect if the assignment is being done to a function parameter we can utilize our `getScope(node)` utility to get function in the scope of which assignment is being done. To keep complexity to a minimum let us consider that assignment is not being done in a nested function to the parameters of parent function (in order to detect this we can convert our `getScope(node)` utility to return an array of scopes and then we can iterate over all of the nested scopes to identify such function parameters). We only have to check if the identifier in question belongs to the `params` array of the [function](https://github.com/estree/estree/blob/master/es5.md#functions) in scope. If the assignment is being done in the global (or `Program`) scope we can directly include it in our list of assignments.

```js
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const acornWalk = require('acorn-walk')

const getName = require('../../src/utils/getName')
const getScope = require('../../src/utils/getScope')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

let declarations = []
let assignmentsHash = {}

acornWalk.ancestor(tree, {
  VariableDeclarator (node) {
    const name = node.id.name

    declarations.push(name)
  },
  FunctionDeclaration (node) {
    const name = node.id.name

    declarations.push(name)
  },
  AssignmentExpression (node, ancestors) {
    const name = getName(node.left)
    const scope = getScope(ancestors)

    switch (node.left.type) {
      case 'Identifier':
        if (scope.type !== 'Program') {
          /*
          If it is a function scope, we need to check if the
          identifier being assigned is not a parameter of
          that function.
          */
          if (scope.params.findIndex(p => p.name === name) === -1) {
            assignmentsHash[name] = assignmentsHash[name] || 0
            assignmentsHash[name]++
          }
        } else {
          assignmentsHash[name] = assignmentsHash[name] || 0
          assignmentsHash[name]++
        }
        break
    }
  }
})

const assignments = Object.keys(assignmentsHash)
const globalDeclarations = assignments.filter(assignment => !declarations.includes(assignment))

console.log(globalDeclarations)
```

When we execute the above code (with our [`sample.js`](https://github.com/divyamamgai/skope/blob/master/article/scripts/sample.js)), we expect the output to be `d`.

### Piecing it Together

Putting together everything mentioned in the previous sections we can get all of the global declarations made in a given snippet of JavaScript code (with some assumptions made).

```js
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const acornWalk = require('acorn-walk')

const getName = require('../../src/utils/getName')
const getScope = require('../../src/utils/getScope')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

let declarations = []
let globalDeclarations = []
let assignmentsHash = {}

acornWalk.ancestor(tree, {
  VariableDeclarator (node, ancestors) {
    const name = node.id.name

    declarations.push(name)

    if (getScope(ancestors.slice(0, -2)).type === 'Program') {
      globalDeclarations.push(name)
    }
  },
  FunctionDeclaration (node, ancestors) {
    const name = node.id.name

    declarations.push(name)

    if (getScope(ancestors.slice(0, -1)).type === 'Program') {
      globalDeclarations.push(name)
    }
  },
  AssignmentExpression (node, ancestors) {
    const name = getName(node.left)
    const scope = getScope(ancestors)

    switch (node.left.type) {
      case 'Identifier':
        if (scope.type !== 'Program') {
          if (scope.params.findIndex(p => p.name === name) === -1) {
            assignmentsHash[name] = assignmentsHash[name] || 0
            assignmentsHash[name]++
          }
        } else {
          assignmentsHash[name] = assignmentsHash[name] || 0
          assignmentsHash[name]++
        }
        break
      case 'MemberExpression':
        let nameSplit = name.split('.')
        if (nameSplit[0] === 'window' && nameSplit.length === 2) {
          assignmentsHash[nameSplit[1]] = assignmentsHash[nameSplit[1]] || 0
          assignmentsHash[nameSplit[1]]++
        }
        break
    }
  }
})

const assignments = Object.keys(assignmentsHash)
const globalAssignments = assignments.filter(assignment => !declarations.includes(assignment))

globalDeclarations = globalDeclarations.concat(globalAssignments)

console.log(globalDeclarations)
```

When we execute the above code (with our [`sample.js`](https://github.com/divyamamgai/skope/blob/master/article/scripts/sample.js)), we expect the output to be `a`, `d`, `e`, and `f`.

### Limitations of our solution

If you are a keen observer and have been experimenting on your own along the way, you might have noticed there are some obvious limitations with our current solution. Here are some of those limitations.

1. Declarations in an unused function are also considered.
2. References to `window` objects are not considered.
3. The functional parameters of the parent functions are not excluded from the assignment.

These limitations can be resolved, but the solutions will become much more complicated for an intro to AST and what all can be done with it.

## Using the scope information

We can generate a lot of useful insights and information about our code using the handy little plugin we just created.

### Detecting and removing the cyclic dependency

Circular dependency is not good for your codebase. Its a condition wherein two modules are dependent on each other and hence you cannot say with certainty which module should be loaded first. Using the Tarjan's strongly connected component algorithm you can detect cycles in your dependency graph and then work on removing them.

### Order of inclusion of modules

Using topological sorting on our module dependency graph generated by our utility we can get the order in which modules should ideally be included. The only caveat is that topological sort only works on a directed acyclic graph and you will need to remove all of the cyclic dependencies from your codebase to get this information.

## Power of AST

A lot can be achieved using ASTs. They can help you in performing critical code analysis like figuring out the [cyclomatic complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity) of your codebase, keeping it [under control](https://dev.to/designpuddle/coding-concepts---cyclomatic-complexity-3blk). Another interesting use of ASTs is [code modding](https://www.toptal.com/javascript/write-code-to-rewrite-your-code), with this you can essentially re-write your code to adhere to the newer [framework](https://github.com/reactjs/react-codemod) or language-specific standards without any developer efforts. You have already seen a usage outlined in this article, which helps in figuring out dependencies between legacy JavaScript, the pre-import and export era. There is always a scope for this tech in your development to ease the process a bit, you just have to figure it out.
