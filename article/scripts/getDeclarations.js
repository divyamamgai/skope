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
