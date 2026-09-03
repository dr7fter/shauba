// 设计系统硬检查：npm run check:ui
// 规则：tokens.css 之外无 hex/rgba；无 !important；无同上下文重复选择器；
// 断点白名单 1240/960/max-height:720；圆角/阴影全部 var() 或白名单字面量。
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const app = read('src/App.css')
const ui = read('src/styles/ui.css')
const combined = app + '\n' + ui
let fails = []
const count = (s, re) => (s.match(re) || []).length

if (count(combined, /#[0-9a-fA-F]{3,8}\b/g) > 0) fails.push('组件层存在硬编码 hex')
if (count(combined, /rgba?\(/g) > 0) fails.push('组件层存在硬编码 rgba')
if (count(combined, /!important/g) > 0) fails.push('存在 !important')

// 断点白名单
// 1180 / 860 为批改报告三栏工单专用：三栏在 1180 以下才需要塌成两栏、
// 860 以下塌成单栏，用 1240 / 960 会让 1180~1240 区间的三栏挤在一起。
const medias = [...combined.matchAll(/@media\s*\(([^)]+)\)/g)].map((m) => m[1].trim())
const allowed = [
  'max-width: 1240px',
  'max-width: 960px',
  'max-height: 720px',
  'max-width: 1180px', // 批改报告：三栏 → 两栏 + 档案落到最下方
  'max-width: 860px', // 批改报告：两栏 → 单栏
]
for (const m of medias) if (!allowed.includes(m)) fails.push('断点越界: ' + m)

// 圆角/阴影必须 var 或 0/inherit/none
for (const m of combined.matchAll(/border-radius:\s*([^;]+);/g)) {
  const v = m[1]
  if (!/^(var\(|0|inherit|none)/.test(v) && !/^(var\(--r-\w+\)( var\(--r-\w+\))? 0 0|0 var\(--r-\w+\) var\(--r-\w+\) 0)$/.test(v)) fails.push('圆角非 token: ' + v)
}
for (const m of combined.matchAll(/box-shadow:\s*([^;]+);/g)) {
  const v = m[1]
  if (!/^(var\(|none|inset 0|0 0 0 1px var\(|0 0 0 3px color-mix)/.test(v)) fails.push('阴影非 token: ' + v)
}

// 同上下文重复选择器
function parse(s) {
  const r = { header: null, items: [] }
  const st = [r]
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (/\s/.test(ch)) { i++; continue }
    if (s.startsWith('/*', i)) { i = s.indexOf('*/', i + 2) + 2; continue }
    if (ch === '@') { const b = s.indexOf('{', i); const c = { header: s.slice(i, b).trim(), items: [] }; st[st.length - 1].items.push(c); st.push(c); i = b + 1; continue }
    if (ch === '}') { st.pop(); i++; continue }
    const b = s.indexOf('{', i)
    st[st.length - 1].items.push({ selector: s.slice(i, b).trim() })
    i = s.indexOf('}', b) + 1
  }
  return r
}
let dups = 0
function check(ctx) {
  const seen = new Set()
  for (const it of ctx.items) {
    if (it.items) { check(it); continue }
    const k = it.selector.replace(/\s+/g, ' ')
    if (seen.has(k)) { dups++; fails.push('重复选择器(' + (ctx.header || 'root') + '): ' + k.slice(0, 80)) }
    seen.add(k)
  }
}
check(parse(app)); check(parse(ui))

const fsz = [...new Set([...combined.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim()))]
console.log('font-size 唯一值:', fsz.length, JSON.stringify(fsz))
console.log('断点:', JSON.stringify([...new Set(medias)]))
console.log('App.css 行数:', app.split('\n').length, ' ui.css 行数:', ui.split('\n').length)
if (fails.length) { console.error('FAIL ' + fails.length); fails.slice(0, 20).forEach((f) => console.error('  ' + f)); process.exit(1) }
console.log('CHECK OK: 颜色/圆角/阴影/断点/重复/!important 全部达标')
