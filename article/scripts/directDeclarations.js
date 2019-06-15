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
