const acorn = require('acorn');
const acornWalk = require('acorn-walk');
const acornGlobals = require('acorn-globals');

const getName = (node) => {
  let name = '';
  switch (node.type) {
    case 'Identifier':
      name = node.name;
      break;
    case 'MemberExpression':
      name = `${getName(node.object)}.${getName(node.property)}`;
      break;
  }
  return name;
}

const getScope = (ancestors) => {
  let ancestorIndex = ancestors.length - 1;
  while (ancestorIndex >= 0) {
    const ancestor = ancestors[ancestorIndex];
    switch (ancestor.type) {
      case 'FunctionExpression':
      case 'FunctionDeclaration':
        return ancestor;
      case 'Program':
        return 'Global';
    }
    ancestorIndex--;
  }
  return null;
}

const skope = {
  getDependencies(data) {
    const globals = acornGlobals(data).map(global => global.name);
    return globals;
  },
  // Cannot get globals such as window.XYZ = ...
  getDeclarations(data) {
    let declarations = [];
    let globalDeclarations = [];
    let assignmentsHash = {};

    acornWalk.ancestor(acorn.Parser.parse(data), {
      VariableDeclarator(node, ancestors) {
        const name = node.id.name;

        declarations.push(name);

        if (getScope(ancestors.slice(0, -2)) === 'Global') {
          globalDeclarations.push(name);
        }
      },
      FunctionDeclaration(node, ancestors) {
        const name = node.id.name;

        declarations.push(name);

        if (getScope(ancestors.slice(0, -1)) === 'Global') {
          globalDeclarations.push(name);
        }
      },
      AssignmentExpression(node, ancestors) {
        const name = getName(node.left);
        const scope = getScope(ancestors);
        let nameSplit;

        switch (node.left.type) {
          case 'Identifier':
            if (scope !== 'Global') {
              if (scope.params.findIndex(p => p.name === name) === -1) {
                assignmentsHash[name] = 1;
              }
            } else {
              assignmentsHash[name] = 1;
            }
            break;
          case 'MemberExpression':
            nameSplit = name.split('.');
            if (nameSplit[0] === 'window' && nameSplit.length === 2) {
              assignmentsHash[nameSplit[1]] = 1;
            }
            break;
        }
      }
    });

    const assignments = Object.keys(assignmentsHash);
    const globalAssignments = assignments.filter(assignment => !declarations.includes(assignment));

    return globalDeclarations.concat(globalAssignments);
  }
};

module.exports = skope;