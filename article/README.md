# Coding with Sight Skope

(scope is written as skope purposefully :P)

## Need for sight skope

I was working on a frontend project which had lots of contributors and coding style was not in place. This meant different developers writing different patterns. As the project grew and different javascript files exposed different classes and modules (not using module exports :( just to be clear) it became difficult to identify which file was dependent on the other. This meant that debugging and fixing code smell was really difficult.

## Building a sight skope

We will be using Abstract Syntax Tree (or AST for short) to get information about our code which we can analyse easily. I won't be getting into much detail regarding AST here, since [this](https://medium.com/basecs/leveling-up-ones-parsing-game-with-asts-d7a6fc2400ff) article covers it pretty well so do give it a read. To sum it up quite nicely and move forward without much deeper dive -

> An AST only contains the information related to analyzing the source text, and skips any other extra content that is used while parsing the text.

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

Before we get to developing a logic to detect declarations let's list down what we would expect the resulting declarations be.

1. Variable `a` and function `f()` are declared in the global scope.
2. Variable `d` is a global variable by definition since we have omitted the `var` keyword.
3. Function property `e()` of the `window` object is inherently a global identifier in browsers.

So for our snippet we expect the declarations to be `a`, `f`, `d` and `e` (lets stay simple for this example and not separate out functions and variables) which are exposed to other snippets it might get used or included with.

To generate AST using acorn first we need to read the JavaScript code from file. The parser returns an AST object as specified by the [ESTree spec](https://github.com/estree/estree), which is a node of type `Program` the body of which contains successive nodes of defined types as per your code snippet.

```js
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

console.log(tree)
```

To visualize the generated tree I have written a [script](https://github.com/divyamamgai/skope/blob/master/test/createGraph.js) which creates a [SVG](https://raw.githubusercontent.com/divyamamgai/skope/master/article/images/fileGraph.svg?sanitize=true) file of the tree (excluding some nodes), attached below. I recommend console logging or debugging the nodes to get more insights, currently its just a nutshell and only shows the `type` of the nodes.

![AST Visualization](https://raw.githubusercontent.com/divyamamgai/skope/master/article/images/fileGraph.svg?sanitize=true)

Now we can traverse the resulting tree in a number of ways using Acorn AST walker as outlined [here](https://github.com/acornjs/acorn/tree/master/acorn-walk#interface), take time to read these methods before moving forward. We will be using the `ancestor` walker, which does a `simple` walk over a tree, building up an array of ancestor nodes (including the current node) and passing the resulting array to the callbacks as a second parameter.

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

In JavaScript scope of any identifier is functional (considering ES5 syntax and keeping complexity to a minimum). Hence, if we want to get scope of any identifier node we only need to bubble up its ancestor nodes till we reach a function node ([`FunctionExpression`](https://github.com/estree/estree/blob/master/es5.md#functionexpression) or [`FunctionDeclaration`](https://github.com/estree/estree/blob/master/es5.md#functiondeclaration)), if we do, which will make it local or functional scoped. Else if we reach [`Program`](https://github.com/estree/estree/blob/master/es5.md#programs) node then it is global scoped. Let's create a simple stub which accepts an array of ancestor nodes of an identifier and return the scope of that identifier as - `Program|FunctionExpression|FunctionDeclaration` node.

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

In order to know if a Variable or Function declaration is done directly on the global scope, using our graph as basis, it is clear that we need to detect if the direct parent of the declaration node is a `Program` node. To do this we will use [`VariableDeclarator`](https://github.com/estree/estree/blob/master/es5.md#variabledeclarator) and `FunctionDeclaration` callbacks (since it will give us the identifier name as `node.id.name`) with ancestor walker. We will use `getScope` stub to get the scope of the node and compare the scope node type to `Program`, if yes we push it to `globalDeclarations` list.

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

1. Creating property of an identifier in the `window` object.
2. Omitting `var` keyword while declaring (or assigning) an identifier.

In order to detect the above two cases we will be using the [`AssignmentExpression`](https://github.com/estree/estree/blob/master/es5.md#assignmentexpression) node since in both an assignment is being performed. `AssignmentExpression` node has two child nodes - `left` and `right`.

#### Case #1

For case #1 we have to check if the `left` node of the `AssignmentExpression` is a [`MemberExpression`](https://github.com/estree/estree/blob/master/es5.md#memberexpression) of the `window` object. A `MemberExpression` accesses an object's member or property (for example `window.location`). So in context of `AssignmentExpression` we are accessing a specified key of the `window` object and assigning a value to it.

Before we move ahead lets write a simple utility `getName()` to get us a readable name from the `MemberExpression` node. In a `MemberExpression` node we have two properties - `object` and `property`. `object` will be an [`Identifier`](https://github.com/estree/estree/blob/master/es5.md#identifier) whereas `property` will be `Identifier|MemberExpression` and hence we will need to recursively call the utility till we reach an `Identifier` node whose name can be get using `name` property.

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

We have to use `AssignmentExpression` callback of ancestor walker. Call our utility `getName(node.left)` to get name, check if the left node is of type `MemberExpression` and name is of the format - `window.indentifier`. If it does then the `indentifier` is a global variable.

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

let assignmentsHash = {}

acornWalk.ancestor(tree, {
  AssignmentExpression (node) {
    const name = getName(node.left)

    switch (node.left.type) {
      case 'MemberExpression':
        let nameSplit = name.split('.')
        /*
        Check if the name of the format - `window.identifier`
        and extract the `indentifier` name.
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

We have already seen how we can capture declarations in the previous sections. Lets see how we can capture the assignment of identifiers, specially non-function parameter ones. What do we mean by "non-function paramter"? We can re-assign value to the function parameters without using `var` keyword. For these parameters there won't be a declaration counterpart, and hence we will have to exclude them beforehand.

To detect if the assignment is being done to a function parameter we can utilize our `getScope(node)` utility to get function in the scope of which assignment is being done. To keep complexity to a minimum let us consider that assignment is not being done in a nested function to the parameters of parent function (inorder to detect this we can convert our `getScope(node)` utility to return an array of scopes and then we can iterate over all of the nested scopes to identify such function parameters). We only have to check if the identifier in question belongs in the `params` array of the [function](https://github.com/estree/estree/blob/master/es5.md#functions) in scope. If the assignment is being done in the global (or `Program`) scope we can directly include it in our list of assignments.

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
