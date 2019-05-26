# Coding with sight skope

(scope is written as skope purposefully :P)

## Need for sight skope

I was working on a frontend project which had lots of contributors and coding style was not in place. This meant different developers writing different patterns. As the project grew and different javascript files exposed different classes and modules (not using module exports :( just to be clear) it became difficult to identify which file was dependent on the other. This meant that debugging and fixing code smell was really difficult.

## Building a sight skope

We will be using Abstract Syntax Tree (or AST for short) to get information about our code which we can analysis easily. I won't be getting into much detail regarding AST here, since [this](https://medium.com/basecs/leveling-up-ones-parsing-game-with-asts-d7a6fc2400ff) article covers it pretty well so do give it a read. To sum it up quite nicely and move forward without much deeper dive -

> An AST only contains the information related to analyzing the source text, and skips any other extra content that is used while parsing the text.

To build such an AST for our JavaScript files we will be using [acorn](https://github.com/acornjs/acorn) (it is a JavaScript parser) and [acorn-walk](https://github.com/acornjs/acorn/tree/master/acorn-walk) (a syntax tree, generated via acorn, walker). Let's take a sample (very poorly written) JavaScript (ES5) code.

```js
var a = 1;

(function () {
  var b = 2;

  console.log(b);

  function c() {
    d = 3;
  }
})();

function e() {
  console.log("I'm too lazy to write a good example.");
}
```

Before we get to developing a logic to detect declarations let's list down what we would expect the resulting declarations be.

1. Variable `a` and function `e()` are declared in the global scope.
2. Variable `d` is a global variable by definition since we have omitted the `var` keyword.

So for our snippet we expect the declarations to be `a`, `e` and `d` (lets stay simple for this example and not separate out functions and variables) which are exposed to other snippets it might get used or included with.

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

To visualize the generated tree I have written a [script](https://github.com/divyamamgai/skope/blob/master/test/createGraph.js) which creates a [SVG](https://raw.githubusercontent.com/divyamamgai/skope/master/test/fileGraph.svg?sanitize=true) file of the tree, attached below. I recommend console logging or debugging the nodes to get more insights, currently its just a nutshell and only shows the `type` of the nodes.

![AST Visualization](https://raw.githubusercontent.com/divyamamgai/skope/master/test/fileGraph.svg?sanitize=true)

Now we can traverse the resulting tree in a number of fashions using Acorn AST walker outlined [here](https://github.com/acornjs/acorn/tree/master/acorn-walk#interface), take time to read these methods before moving forward. We will be using the `ancestor` walker, which does a `simple` walk over a tree, building up an array of ancestor nodes (including the current node) and passing the resulting array to the callbacks as a second parameter.

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
