// 刷吧发版脚本：构建 + 签名 + 生成 latest.json + 输出上传命令
// 用法：node scripts/release.mjs
// 前提：私钥在 %USERPROFILE%/.tauri/shuaba_updater.key（可用 TAURI_SIGNING_PRIVATE_KEY_PATH 覆盖）
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const REPO = 'dr7fter/shauba'
const root = resolve(import.meta.dirname, '..')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const conf = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'))
const cargoVersion = readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8')
  .match(/^version\s*=\s*"([^"]+)"/m)?.[1]

if (!(pkg.version === conf.version && pkg.version === cargoVersion)) {
  console.error(`✗ 三处版本号不一致：package.json=${pkg.version} tauri.conf.json=${conf.version} Cargo.toml=${cargoVersion}`)
  process.exit(1)
}
const version = pkg.version

const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || join(homedir(), '.tauri', 'shuaba_updater.key')
if (!existsSync(keyPath)) {
  console.error(`✗ 未找到签名私钥：${keyPath}`)
  console.error('  生成：npx tauri signer generate -w "%USERPROFILE%/.tauri/shuaba_updater.key" --password ""')
  console.error('  注意：换私钥后旧版本将无法校验新更新包，私钥丢失同理，请务必备份。')
  process.exit(1)
}

console.log(`>> 构建 刷吧 v${version}（自动签名）…`)
execSync('npm run app:build', {
  stdio: 'inherit',
  cwd: root,
  env: {
    ...process.env,
    // tauri-cli 实际读取的是密钥内容变量，直接注入避免子进程丢环境变量
    TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyPath, 'utf8'),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? '',
  },
})

const nsisDir = join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
const setupName = `刷吧_${version}_x64-setup.exe`
const setupPath = join(nsisDir, setupName)
const sigPath = `${setupPath}.sig`
if (!existsSync(setupPath) || !existsSync(sigPath)) {
  console.error(`✗ 未找到更新产物：${setupPath}(或 .sig)。确认 tauri.conf.json 已开启 createUpdaterArtifacts。`)
  process.exit(1)
}

const signature = readFileSync(sigPath, 'utf8').trim()
const notesPath = join(root, 'RELEASE_NOTES.md')
const notes = existsSync(notesPath)
  ? readFileSync(notesPath, 'utf8').trim()
  : `刷吧 v${version} 更新。`

const latest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: `https://github.com/${REPO}/releases/download/v${version}/${encodeURIComponent(setupName)}`,
    },
  },
}
const latestPath = join(nsisDir, 'latest.json')
writeFileSync(latestPath, JSON.stringify(latest, null, 2))

const sha256 = createHash('sha256').update(readFileSync(setupPath)).digest('hex')
writeFileSync(join(nsisDir, 'SHA256SUMS.txt'), `${sha256} *${setupName}\n`)

console.log('\n✔ 构建完成，更新三件套：')
console.log(`  1. ${setupPath}`)
console.log(`  2. ${sigPath}`)
console.log(`  3. ${latestPath}`)
console.log('\n>> 上传到 GitHub Releases（latest.json 文件名不能改，updater 端点按这个名字找）：\n')
console.log(`gh release create v${version} --title "刷吧 v${version}" --latest --notes-file RELEASE_NOTES.md "${setupPath}" "${latestPath}"`)
console.log('\n上传后应用内「检查更新」即可收到该版本（仅对已带 updater 的版本生效）。')
