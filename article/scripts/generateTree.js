const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const FILE_PATH = path.join(__dirname, 'sample.js')

const data = fs.readFileSync(FILE_PATH).toString()
const tree = acorn.Parser.parse(data)

console.log(tree)
