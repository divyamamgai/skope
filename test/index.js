const fs = require('fs')
const path = require('path')

const runner = require('./runner')

const SAMPLE_DIRECTORY_PATH = path.join(__dirname, '/samples')

const samples = fs.readdirSync(SAMPLE_DIRECTORY_PATH)

for (const sample of samples) {
  runner(path.join(SAMPLE_DIRECTORY_PATH, sample))
}
