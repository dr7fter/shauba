import test from 'node:test'
import assert from 'node:assert/strict'
import { MATH_PART_REGEX, normalizeLatex, preprocessMathText } from '../src/components/mathTextCore.ts'

/* 按 MathText 组件的切分方式，把文本切成 [类别, 内容] 序列 */
function parts(text) {
  return preprocessMathText(text)
    .split(MATH_PART_REGEX)
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('$$') || p.startsWith('\\[')) return ['display', p]
      if (p.startsWith('$') || p.startsWith('\\(')) return ['inline', p]
      return ['text', p]
    })
}

test('行间公式 $$...$$ 必须保持 display，不能被降级成行内', () => {
  // 这是 MathText 出过的真实事故：占位符用「替换串」还原时 $$ 被折叠成 $，
  // 导致题库 51.2% 的正解（含 $$ 块）全部渲染成行内公式。
  const got = parts('$$x^2+1=0$$')
  assert.deepEqual(got, [['display', '$$x^2+1=0$$']])
})

test('行间公式带换行时仍是 display，且内容里的换行保留', () => {
  const src = '$$\n(E+A)\\left(E+\\frac{1}{3}A\\right)=E,\n$$'
  const got = parts(src)
  assert.equal(got.length, 1)
  assert.equal(got[0][0], 'display')
  // pre-wrap 靠这些换行还原手写答案的书写顺序，吃掉就没了
  assert.ok(got[0][1].includes('\n'))
})

test('题干正文里的行内公式不受影响', () => {
  const got = parts('令 $u=(1,-1,-1,1)^T$，则 $A=-uu^T$。')
  const inlines = got.filter((p) => p[0] === 'inline')
  assert.equal(inlines.length, 2)
})

test('行间与行内混合时各归其位', () => {
  const src = '令 $u=(1,-1,-1,1)^T$。又 \n$$\nA^2=4A\n$$\n故 $(E+A)^{-1}$ 得证。'
  const got = parts(src)
  assert.deepEqual(
    got.map((p) => p[0]),
    ['text', 'inline', 'text', 'display', 'text', 'inline', 'text'],
  )
})

test('正解正文的换行在预处理后仍然存活（pre-wrap 的前提）', () => {
  const src = '第一段。\n第二段。\n$$\nx=1\n$$\n第三段。'
  const out = preprocessMathText(src)
  // 至少保留一处换行，否则报告里 white-space: pre-wrap 无内容可保
  assert.ok(/\n/.test(out), '换行被吃光了，pre-wrap 会失效')
})

test('裸 LaTeX 宏会被补上 $ 包裹', () => {
  const out = preprocessMathText('由 \\frac{1}{2} 得')
  assert.ok(out.includes('$\\frac{1}{2}$'))
})

test('占位符还原不把 $& / $1 当作替换模式', () => {
  // 替换串里 $& 会被替换成「匹配到的子串」，$1 会被当成捕获组引用；
  // 用函数形式还原才不会被吃掉。
  const out = preprocessMathText('$$a$&$1b$$')
  assert.ok(out.includes('$&$1'), `特殊串被吞掉了：${out}`)
})

test('图片 asset 引用被剥掉', () => {
  const out = preprocessMathText('前 ![](asset://123) 后')
  assert.ok(!out.includes('asset://'))
  assert.ok(out.includes('前'))
})

test('空输入不炸', () => {
  assert.equal(preprocessMathText(''), '')
  assert.equal(preprocessMathText(null), '')
})

test('normalizeLatex 把双反斜杠命令归一为单反斜杠', () => {
  assert.equal(normalizeLatex('\\\\frac{1}{2}'), '\\frac{1}{2}')
})
