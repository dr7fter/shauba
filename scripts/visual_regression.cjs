// 刷吧视觉回归截图管线：vite preview + 系统 Edge（puppeteer-core）。
// 用法：npm run build && node scripts/visual_regression.cjs
// 产出：docs/evidence/ui-<date>/*.png（四档窗口 x 五视图 + 主题 + 字号 + 命令菜单/公式抽屉）
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const puppeteer = require('puppeteer-core')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'docs', 'evidence', 'ui-20260820')
fs.mkdirSync(outDir, { recursive: true })
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const res = await fetch(BASE); if (res.ok) return } catch { }
    await sleep(500)
  }
  throw new Error('vite preview 未启动')
}

const sizes = [[1440, 900], [1280, 720], [1024, 768], [840, 620]]
const views = [
  ['today', '今日'],
  ['library', '题库'],
  ['review', '复盘'],
  ['insights', '进展'],
]

async function setPrefs(page, theme, scale) {
  await page.evaluate((t, s) => {
    localStorage.setItem('shuaba_theme', t)
    localStorage.setItem('shuaba_font_scale', s)
  }, theme, scale)
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('.app-shell', { timeout: 15000 })
  await sleep(900)
}

async function gotoView(page, label) {
  await page.evaluate((text) => {
    const btns = [...document.querySelectorAll('.sidebar button, .sidebar .nav-item')]
    const target = btns.find((b) => (b.textContent || '').includes(text))
    if (target) target.click()
  }, label)
  await sleep(700)
}

async function main() {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore', detached: true })
  let exitCode = 1
  try {
    await waitServer()
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--force-device-scale-factor=1', '--font-render-hinting=none'] })
    const page = await browser.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.app-shell', { timeout: 15000 })

    // 1) 四档窗口 x 五视图（light/standard）
    for (const [w, h] of sizes) {
      await page.setViewport({ width: w, height: h })
      await setPrefs(page, 'light', 'standard')
      for (const [id, label] of views) {
        await gotoView(page, label)
        await page.screenshot({ path: path.join(outDir, `${id}_${w}x${h}.png`) })
      }
      await gotoView(page, '设置') // sidebar footer button text
      await page.screenshot({ path: path.join(outDir, `settings_${w}x${h}.png`) })
    }

    // 2) 三主题（today @1440x900）
    await page.setViewport({ width: 1440, height: 900 })
    for (const theme of ['light', 'warm', 'dark']) {
      await setPrefs(page, theme, 'standard')
      await gotoView(page, '今日')
      await page.screenshot({ path: path.join(outDir, `today_theme_${theme}.png`) })
    }

    // 3) 三档字号（today @1440x900, light）
    for (const scale of ['standard', 'medium', 'large']) {
      await setPrefs(page, 'light', scale)
      await gotoView(page, '今日')
      await page.screenshot({ path: path.join(outDir, `today_font_${scale}.png`) })
    }

    // 4) 命令菜单与公式抽屉（Sprint C 证据）
    await setPrefs(page, 'light', 'standard')
    await gotoView(page, '今日')
    await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control')
    await sleep(400)
    await page.screenshot({ path: path.join(outDir, 'bonus_command-menu.png') })
    await page.keyboard.press('Escape')
    await sleep(300)
    await page.keyboard.down('Alt'); await page.keyboard.press('KeyF'); await page.keyboard.up('Alt')
    await sleep(500)
    await page.screenshot({ path: path.join(outDir, 'bonus_formula-drawer.png') })

    await browser.close()
    exitCode = 0
  } finally {
    try { require('node:child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }) } catch { try { preview.kill() } catch { } }
  }
  const shots = fs.readdirSync(outDir).filter((f) => f.endsWith('.png'))
  console.log('screenshots:', shots.length)
  shots.sort().forEach((s) => console.log('  ' + s))
  process.exit(exitCode)
}

main().catch((e) => { console.error(e); process.exit(1) })
