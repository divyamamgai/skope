const acorn = require('acorn')
const acornWalk = require('acorn-walk')
const acornGlobals = require('acorn-globals')

const getName = require('./utils/getName')
const getScope = require('./utils/getScope')

const skope = {
  getDependencies (data) {
    const globals = acornGlobals(data).map(global => global.name)
    return globals
  },

  /*
  TODO: Cannot evaluate functions which might bind
        variables to window or parent scope which
        ultimately binds to the global scope. An
        example code is given below -

        (function (w) {
          w.A = 'GLOBAL DECLARATION';
        })(window);

        NOTE: There might be multiple such cases
        which are not implemented as of yet.
  */
  getDeclarations (data) {
    let declarations = []
    let globalDeclarations = []
    let assignmentsHash = {}

    acornWalk.ancestor(acorn.Parser.parse(data), {
      VariableDeclarator (node, ancestors) {
        const name = node.id.name

        declarations.push(name)

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

        declarations.push(name)

        if (getScope(ancestors.slice(0, -1)).type === 'Program') {
          globalDeclarations.push(name)
        }
      },
      AssignmentExpression (node, ancestors) {
        const name = getName(node.left)
        const scope = getScope(ancestors)
        let nameSplit

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
            nameSplit = name.split('.')
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

    return globalDeclarations.concat(globalAssignments)
  }
}

module.exports = skope
