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
