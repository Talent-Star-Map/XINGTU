const { app, BrowserWindow, ipcMain, screen, protocol, net, Tray, Menu, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { createBrowserBridge } = require('./browser-bridge.cjs')

const dataRoot = path.join(__dirname, '.local-data')
fs.mkdirSync(dataRoot, { recursive: true })
app.setPath('userData', dataRoot)
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
protocol.registerSchemesAsPrivileged([{ scheme: 'xiaoxing', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }])
let win, tray, saveTimer, dragOrigin, motionPosition, browserBridge
let prefs = { size: 'medium', position: null }
try { prefs = { ...prefs, ...JSON.parse(fs.readFileSync(path.join(dataRoot, 'preferences.json'), 'utf8')) } } catch {}
const widths = { small: 300, medium: 400, large: 500 }
if (!Object.hasOwn(widths, prefs.size)) prefs.size = 'medium'
const review = app.commandLine.hasSwitch('review-pack')
const diagnostics = review || app.commandLine.hasSwitch('diagnostics')
const reviewPlaybackRate = review && app.commandLine.hasSwitch('review-slow') ? 0.25 : 1
const framedReview = review && app.commandLine.hasSwitch('review-framed')
const packRoot = review ? path.resolve(app.commandLine.getSwitchValue('review-pack')) : path.resolve(__dirname, '../frontend/public/mascot/xiaoxing')

function clamp(bounds, round = true) {
  const area = screen.getDisplayMatching(bounds).workArea
  const width = Math.min(bounds.width, area.width), height = Math.min(bounds.height, area.height)
  const x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))
  const y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))
  return { ...bounds, width, height, x: round ? Math.round(x) : x, y: round ? Math.round(y) : y }
}
function corner() {
  const area = screen.getPrimaryDisplay().workArea
  const bounds = win.getBounds()
  win.setBounds(clamp({ ...bounds, x: area.x + area.width - bounds.width - 16, y: area.y + area.height - bounds.height - 12 }))
}
function restoreWindow() {
  if (!win || win.isDestroyed()) return
  win.setIgnoreMouseEvents(false)
  win.show()
  win.focus()
}
function save() {
  if (!win || win.isDestroyed()) return
  prefs.position = win.getPosition()
  fs.writeFileSync(path.join(dataRoot, 'preferences.json'), JSON.stringify(prefs))
}
function trusted(event) { return win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame?.url.startsWith('xiaoxing://app/') }
function moveBy(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 200 || Math.abs(dy) > 200) return
  const bounds = win.getBounds()
  if (!motionPosition || bounds.x !== motionPosition.nativeX || bounds.y !== motionPosition.nativeY) motionPosition = { x: bounds.x, y: bounds.y }
  const logical = clamp({ ...bounds, x: motionPosition.x + dx, y: motionPosition.y + dy }, false)
  const x = Math.round(logical.x), y = Math.round(logical.y)
  motionPosition = { x: logical.x, y: logical.y, nativeX: x, nativeY: y }
  if (x !== bounds.x || y !== bounds.y) win.setBounds({ ...logical, x, y })
}
async function serve(request) {
  const url = new URL(request.url)
  const root = url.hostname === 'app' ? path.join(__dirname, 'dist') : url.hostname === 'media' ? packRoot : null
  if (!root || request.method !== 'GET') return new Response('Not found', { status: 404 })
  try {
    const base = await fs.promises.realpath(root)
    const file = await fs.promises.realpath(path.resolve(base, '.' + decodeURIComponent(url.pathname)))
    const relative = path.relative(base, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 })
    const response = await net.fetch(pathToFileURL(file).href)
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', 'xiaoxing://app')
    return new Response(response.body, { status: response.status, headers })
  } catch { return new Response('Not found', { status: 404 }) }
}

app.whenReady().then(async () => {
  protocol.handle('xiaoxing', serve)
  const width = widths[prefs.size]
  const bounds = { width, height: width + 360, x: 0, y: 0 }
  if (Array.isArray(prefs.position) && prefs.position.length === 2 && prefs.position.every(Number.isFinite)) [bounds.x, bounds.y] = prefs.position
  win = new BrowserWindow({ ...clamp(bounds), show: false, title: review ? '小星 · 素材验证' : '小星', transparent: !framedReview, frame: framedReview, hasShadow: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: framedReview ? '#ebe7f5' : '#00000000', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('xiaoxing://app/')) event.preventDefault() })
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  win.once('ready-to-show', () => { if (!prefs.position) corner(); win.show() })
  win.on('move', () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300) })
  win.on('close', save)
  win.on('closed', () => { app.quit() })
  screen.on('display-removed', () => win.setBounds(clamp(win.getBounds())))
  screen.on('display-metrics-changed', () => win.setBounds(clamp(win.getBounds())))
  ipcMain.handle('pet:config', event => {
    if (!trusted(event)) throw new Error('Invalid sender')
    return { assetBase: 'xiaoxing://media/', manifest: 'xiaoxing://media/motion.json', review, diagnostics, reviewPlaybackRate, size: prefs.size, bounds: win.getBounds(), workArea: screen.getDisplayMatching(win.getBounds()).workArea }
  })
  ipcMain.handle('pet:open-site', event => trusted(event) && browserBridge?.openSite() === true)
  ipcMain.on('pet:move', (event, value) => { if (trusted(event) && value && !dragOrigin) moveBy(value.dx, value.dy) })
  ipcMain.on('pet:drag', (event, value) => {
    if (!trusted(event) || !value) return
    const { phase, cursor } = value
    if (phase === 'end') { dragOrigin = null; return }
    if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return
    if (phase === 'start') dragOrigin = { cursor, bounds: win.getBounds() }
    else if (phase === 'move' && dragOrigin) {
      win.setBounds(clamp({ ...dragOrigin.bounds, x: dragOrigin.bounds.x + cursor.x - dragOrigin.cursor.x, y: dragOrigin.bounds.y + cursor.y - dragOrigin.cursor.y }))
    }
  })
  ipcMain.on('pet:passthrough', (event, ignore) => { if (!framedReview && trusted(event) && typeof ignore === 'boolean' && !dragOrigin) win.setIgnoreMouseEvents(ignore, { forward: true }) })
  ipcMain.on('pet:corner', event => { if (trusted(event)) corner() })
  ipcMain.on('pet:size', (event, size) => {
    if (!trusted(event) || !Object.hasOwn(widths, size)) return
    const before = win.getBounds(), width = widths[size], height = width + 360
    prefs.size = size
    win.setBounds(clamp({ x: before.x + (before.width - width) / 2, y: before.y + before.height - height, width, height }))
    save()
  })
  ipcMain.on('pet:quit', event => { if (trusted(event)) app.quit() })
  ipcMain.on('pet:hide', event => { if (trusted(event)) win.hide() })
  const icon = nativeImage.createFromPath(path.join(__dirname, 'dist/idle.png')).resize({ width: 24, height: 24 })
  tray = new Tray(icon)
  tray.setToolTip('小星 · 星图桌面伙伴')
  tray.setContextMenu(Menu.buildFromTemplate([{ label: '打开星图', click: () => browserBridge?.openSite() }, { label: '回到角落', click: () => { corner(); restoreWindow() } }, { type: 'separator' }, { label: '退出小星', click: () => app.quit() }]))
  tray.on('click', restoreWindow)
  browserBridge = createBrowserBridge({ dataRoot, onLastDisconnect: () => app.quit(), onAttach: restoreWindow })
  await browserBridge.ready
  await win.loadURL('xiaoxing://app/index.html')
})
app.on('before-quit', () => { browserBridge?.close(); clearTimeout(saveTimer); save() })
app.on('second-instance', restoreWindow)
app.on('window-all-closed', () => app.quit())
