const fs = require('fs');
const path = require('path');
const skope = require('../src/skope');

module.exports = (...files) => {
  if (files.length === 0) {
    files = process.argv.slice(2);
  }

  for (const file of files) {
    if (fs.existsSync(file)) {
      const absolutePath = path.resolve(file);
      console.error(`Reading File "${absolutePath}"...`);
      const data = fs.readFileSync(absolutePath).toString();
      const fileSkope = {
        declarations: skope.getDeclarations(data),
        dependencies: skope.getDependencies(data)
      }
      console.log(`\nDECLARATIONS ${fileSkope.declarations.length}\n${fileSkope.declarations}`);
      console.log(`\nDEPENDENCIES ${fileSkope.dependencies.length}\n${fileSkope.dependencies}`);
      console.log('-'.repeat(80));
    } else {
      console.error(`File "${file}" does not exists!`);
    }
  }
}
