const getScope = (ancestors) => {
  let ancestorIndex = ancestors.length - 1
  while (ancestorIndex >= 0) {
    const ancestor = ancestors[ancestorIndex]
    switch (ancestor.type) {
      case 'FunctionExpression':
      case 'FunctionDeclaration':
        return ancestor
      case 'Program':
        return 'Global'
    }
    ancestorIndex--
  }
  return null
}

module.exports = getScope
