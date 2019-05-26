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
