import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const desktop = path.dirname(fileURLToPath(import.meta.url))
const repo = path.dirname(desktop)
const [runtimeArg, outputArg] = process.argv.slice(2)
if (!runtimeArg || !outputArg || process.platform !== 'win32') throw new Error('Usage on Windows: node build-package.mjs <Electron dist directory> <new output directory>')
const runtime = path.resolve(runtimeArg), output = path.resolve(outputArg)
await fs.access(path.join(runtime, 'electron.exe'))
try { await fs.access(output); throw new Error('Output already exists; keep previous packages') } catch (error) { if (error.code !== 'ENOENT') throw error }
const packRoot = path.join(repo, 'frontend/public/mascot/xiaoxing')
const pack = JSON.parse(await fs.readFile(path.join(packRoot, 'motion.json'), 'utf8'))
if (pack.id !== 'xiaoxing' || !pack.approved || !pack.full_release_approved) throw new Error('Only the accepted Xiaoxing pack can be shipped')
await fs.mkdir(output, { recursive: true })
await fs.cp(runtime, path.join(output, 'runtime'), { recursive: true })
const copy = async (source, destination) => { await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.copyFile(source, destination) }
const appDesktop = path.join(output, 'app/desktop-companion')
for (const file of ['main.cjs', 'preload.cjs', 'native-host.cjs', 'native-protocol.cjs', 'browser-bridge.cjs', 'site-policy.cjs', 'package.json', 'install-native-host.ps1', 'README.md']) await copy(path.join(desktop, file), path.join(appDesktop, file))
await fs.cp(path.join(desktop, 'dist'), path.join(appDesktop, 'dist'), { recursive: true })
for (const file of ['manifest.json', 'sites.json', 'extension-id.json', 'background.js', 'content.js', 'README.md']) await copy(path.join(repo, 'browser-companion', file), path.join(output, 'app/browser-companion', file))
const mediaDestination = path.join(output, 'app/frontend/public/mascot/xiaoxing')
await copy(path.join(packRoot, 'motion.json'), path.join(mediaDestination, 'motion.json'))
for (const clip of Object.values(pack.motion.clips)) {
  if (typeof clip.src !== 'string' || !/^media\/[\w.-]+\.webm$/.test(clip.src)) throw new Error('Unexpected media path')
  await copy(path.join(packRoot, clip.src), path.join(mediaDestination, clip.src))
}
const compiler = path.join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe')
const nativeExe = path.join(appDesktop, 'native/xingtu-native-host.exe')
await fs.mkdir(path.dirname(nativeExe), { recursive: true })
const compiled = spawnSync(compiler, ['/nologo', '/target:exe', '/out:' + nativeExe, path.join(desktop, 'native/NativeHostLauncher.cs')], { encoding: 'utf8' })
if (compiled.status !== 0) throw new Error(compiled.stderr || compiled.stdout)
await fs.writeFile(path.join(output, '注册浏览器联动.cmd'), '@echo off\r\npowershell.exe -NoProfile -File "%~dp0app\\desktop-companion\\install-native-host.ps1"\r\npause\r\n')
await fs.writeFile(path.join(output, '卸载浏览器联动.cmd'), '@echo off\r\npowershell.exe -NoProfile -File "%~dp0app\\desktop-companion\\install-native-host.ps1" -Uninstall\r\npause\r\n')
await copy(path.join(repo, 'browser-companion/README.md'), path.join(output, '使用说明.md'))
console.log(JSON.stringify({ output, extension: path.join(output, 'app/browser-companion'), clips: Object.keys(pack.motion.clips).length }))
