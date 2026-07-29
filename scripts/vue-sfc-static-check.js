const fs = require('fs')
const parser = require('@babel/parser')

const files = process.argv.slice(2)

function extract(source, tag) {
  const opening = source.match(new RegExp(`<${tag}[^>]*>`, 'i'))
  if (!opening || opening.index === undefined) return ''
  const start = opening.index + opening[0].length
  const end = source.toLowerCase().lastIndexOf(`</${tag}>`)
  return end > start ? source.slice(start, end) : ''
}

function checkTemplate(template, file) {
  const stack = []
  const voidTags = new Set(['image', 'input'])
  for (let index = 0; index < template.length;) {
    if (template[index] !== '<' || !/[A-Za-z/!]/.test(template[index + 1] || '')) {
      index += 1
      continue
    }
    if (template.startsWith('<!--', index)) {
      const commentEnd = template.indexOf('-->', index + 4)
      index = commentEnd < 0 ? template.length : commentEnd + 3
      continue
    }
    let end = index + 1
    let quote = ''
    for (; end < template.length; end += 1) {
      const character = template[end]
      if (quote) {
        if (character === quote && template[end - 1] !== '\\') quote = ''
      } else if (character === '"' || character === "'") {
        quote = character
      } else if (character === '>') {
        break
      }
    }
    if (end >= template.length) throw new Error(`${file}: template标签未闭合`)
    const token = template.slice(index, end + 1)
    const match = token.match(/^<\s*(\/)?\s*([\w-]+)/)
    if (match) {
      const closing = Boolean(match[1])
      const tag = match[2]
      if (closing && !voidTags.has(tag)) {
        const opened = stack.pop()
        if (opened !== tag) throw new Error(`${file}: </${tag}> 与 <${opened || '无'}> 不匹配`)
      } else if (!closing && !/\/\s*>$/.test(token) && !voidTags.has(tag)) {
        stack.push(tag)
      }
    }
    index = end + 1
  }
  if (stack.length) throw new Error(`${file}: 未闭合 <${stack[stack.length - 1]}>`)
}

if (!files.length) {
  console.error('请提供需要检查的Vue文件。')
  process.exit(1)
}

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const script = extract(source, 'script')
  const template = extract(source, 'template')
  if (!script || !template) throw new Error(`${file}: 缺少script或template`)
  parser.parse(script, {
    sourceType: 'module',
    plugins: ['dynamicImport', 'optionalChaining', 'objectRestSpread', 'classProperties']
  })
  checkTemplate(template, file)
  console.log(`VUE_SFC_OK ${file}`)
}
