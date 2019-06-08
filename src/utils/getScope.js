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

module.exports = getScope
