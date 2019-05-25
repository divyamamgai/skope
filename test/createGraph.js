const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const graphviz = require('graphviz')

const FILE_PATH = path.join(__dirname, '/samples/1.js')

// For more info visit - https://www.graphviz.org/doc/info/attrs.html
const GRAPH_SETTINGS = {
  // Removes curved lines.
  splines: 'polyline',
  // Keeps our root at top.
  rankdir: 'BT'
}

// TODO: Change this value as per your local setup.
const GRAPHVIZ_BIN_PATH = '/usr/local/Cellar/graphviz/2.40.1/bin'

const FILE_GRAP_PATH = path.join(__dirname, '/fileGraph.svg')

const data = fs.readFileSync(FILE_PATH)

const tree = acorn.Parser.parse(data)

const getNodeID = (node) => `${node.type}_${node.start}_${node.end}`

const addGraphNode = (g, node, parentNode) => {
  const { body } = node
  const nodeID = getNodeID(node)
  g.addNode(nodeID, {
    label: node.type
  })
  if (parentNode) {
    const parentNodeID = getNodeID(parentNode)
    g.addEdge(nodeID, parentNodeID, {
      dir: 'none'
    })
  }
  if (body) {
    if (body instanceof Array) {
      body.forEach(bodyNode => addGraphNode(g, bodyNode, node))
    } else {
      addGraphNode(g, body, node)
    }
  }
}

const g = graphviz.digraph('file_graph')
for (const setting in GRAPH_SETTINGS) {
  g.set(setting, GRAPH_SETTINGS[setting])
}

g.setGraphVizPath(GRAPHVIZ_BIN_PATH)

addGraphNode(g, tree)

g.render(
  'svg',
  (graph) => {
    fs.writeFileSync(FILE_GRAP_PATH, graph.toString())
    console.log('Successfully generated fileGraph.svg!')
  },
  (code, output, error) => {
    console.error('Render Error for file graph!', code, output, error)
  },
  (code, output, error) => {
    console.error('Parser Error for file graph!', code, output, error)
  }
)
