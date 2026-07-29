const { generateMockResult } = require('./mock')
const { generateRealResult } = require('./real')

function getAdapter(provider = 'mock') {
  if (provider === 'real') {
    return {
      name: 'real',
      generate: generateRealResult
    }
  }

  return {
    name: 'mock',
    generate: generateMockResult
  }
}

module.exports = {
  getAdapter
}
