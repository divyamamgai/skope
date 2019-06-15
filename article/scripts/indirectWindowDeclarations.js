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
