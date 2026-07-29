const { generateRealResult } = require('./real')

function getAdapter() {
  return {
    name: 'real',
    generate: generateRealResult
  }
}

module.exports = {
  getAdapter
}
