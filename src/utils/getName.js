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

module.exports = getName
