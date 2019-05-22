const path = require('path')

const runner = require('./runner')

const SAMPLE_COUNT = 2

for (let i = 1; i <= SAMPLE_COUNT; i++) {
  runner(path.join(__dirname, `/samples/${i}.js`))
}
