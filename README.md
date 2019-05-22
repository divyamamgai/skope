# skope

Used to get **global** declarations and dependencies of a given javascript resource.

## Usage

### Declarations

```js
const fs = require('fs')
const skope = require('./skope')

const FILE_PATH = 'PATH_TO_YOUR_SAMPLE_JAVASCRIPT_FILE'

const data = fs.readFileSync(FILE_PATH).toString()

const declarations = skope.getDeclarations(data)

// console.log(declarations)
```

### Dependencies

```js
const fs = require('fs')
const skope = require('./skope')

const FILE_PATH = 'PATH_TO_YOUR_SAMPLE_JAVASCRIPT_FILE'

const data = fs.readFileSync(FILE_PATH).toString()

const dependencies = skope.getDependencies(data)

// console.log(dependencies)
```

## Test

To run tests on the sample javascript files in the `test/samples/*.js` folder, run the following command -

```bash
node test
```
