const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const bankDir = 'E:\\考研资料\\题库-大观园'
const baselinePath = path.resolve('question-bank-hashes-before.csv')
const evidenceDir = path.resolve('docs/evidence/vnext-20260819/source')
const afterPath = path.join(evidenceDir, 'question-bank-hashes-after.csv')
const diffPath = path.join(evidenceDir, 'hash-diff.txt')
const allowedExtensions = new Set(['.json', '.png', '.jpg', '.jpeg', '.webp'])

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase()
}

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(fullPath, output)
    else if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) output.push(fullPath)
  }
  return output
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

const baselineLines = fs.readFileSync(baselinePath, 'utf8').split(/\r?\n/).filter(Boolean)
const baseline = new Map()
const duplicateBaselineNames = new Set()
for (const line of baselineLines.slice(1)) {
  const match = line.match(/^"([^"]*)","([^"]*)","([^"]*)"$/)
  if (!match) throw new Error(`无法解析验收前哈希行: ${line.slice(0, 120)}`)
  const name = path.basename(match[3])
  if (baseline.has(name)) duplicateBaselineNames.add(name)
  baseline.set(name, match[2].toUpperCase())
}

const files = walk(bankDir).sort((a, b) => a.localeCompare(b, 'zh-CN'))
const current = new Map()
const duplicateCurrentNames = new Set()
const afterRows = ['"RelativePath","SHA256"']
for (const filePath of files) {
  const name = path.basename(filePath)
  if (current.has(name)) duplicateCurrentNames.add(name)
  const hash = hashFile(filePath)
  current.set(name, hash)
  afterRows.push(`${csvCell(path.relative(bankDir, filePath))},${csvCell(hash)}`)
}

const differences = []
for (const name of duplicateBaselineNames) differences.push(`DUPLICATE_BASELINE_NAME ${name}`)
for (const name of duplicateCurrentNames) differences.push(`DUPLICATE_CURRENT_NAME ${name}`)
for (const [name, expected] of baseline) {
  if (!current.has(name)) differences.push(`MISSING ${name}`)
  else if (current.get(name) !== expected) differences.push(`MODIFIED ${name} expected=${expected} actual=${current.get(name)}`)
}
for (const name of current.keys()) {
  if (!baseline.has(name)) differences.push(`ADDED ${name}`)
}

fs.mkdirSync(evidenceDir, { recursive: true })
fs.writeFileSync(afterPath, `${afterRows.join('\n')}\n`, 'utf8')
const summary = [
  `baseline_count=${baseline.size}`,
  `current_count=${current.size}`,
  `difference_count=${differences.length}`,
  differences.length === 0 ? 'PASS: question bank JSON and image files are bit-identical to the acceptance baseline.' : 'FAIL: question bank changed.',
  ...differences,
]
fs.writeFileSync(diffPath, `${summary.join('\n')}\n`, 'utf8')
process.stdout.write(`${summary.join('\n')}\n`)
if (differences.length !== 0) process.exitCode = 1
