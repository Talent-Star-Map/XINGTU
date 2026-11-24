const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

// Execute the real IPC handlers against a small native-window boundary double.
// This tests window movement and persistence, not rendering or animation art.
async function boot(position = [500, 300], switches = {}) {
  const ipc = new Map(), appEvents = new Map(), trayEvents = new Map(), saved = []
  let window, trayMenu
  const app = {
    setPath() {}, requestSingleInstanceLock: () => true,
    commandLine: { hasSwitch: name => Object.hasOwn(switches, name), getSwitchValue: name => switches[name] },
    whenReady: () => Promise.resolve(),
    on: (name, callback) => appEvents.set(name, callback), quit() {},
  }
  class Window {
    constructor(options) {
      window = this; this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }; this.events = new Map()
      this.webContents = { setWindowOpenHandler() {}, on() {}, session: { setPermissionRequestHandler() {} } }
    }
    getBounds() { return { ...this.bounds } }
    setBounds(value) { this.bounds = { ...value } }
    getPosition() { return [this.bounds.x, this.bounds.y] }
    isDestroyed() { return false }
    on(name, callback) { this.events.set(name, callback) }
    once(name, callback) { this.events.set(name, callback) }
    async loadURL(url) { this.url = url }
    show() { this.visible = true }
    hide() { this.visible = false }
    focus() { this.focused = true }
    setIgnoreMouseEvents(ignore) { this.ignoreMouse = ignore }
  }
  class Tray { setToolTip() {} setContextMenu(value) { trayMenu = value } on(name, callback) { trayEvents.set(name, callback) } }
  const area = { x: 0, y: 0, width: 2560, height: 1400 }
  const electron = {
    app, BrowserWindow: Window, Tray,
    ipcMain: { on: (name, callback) => ipc.set(name, callback), handle: (name, callback) => ipc.set(name, callback) },
    screen: { getDisplayMatching: () => ({ workArea: area }), getPrimaryDisplay: () => ({ workArea: area }), on() {} },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {},
    nativeImage: { createFromPath: () => ({ resize: () => ({}) }) },
    Menu: { buildFromTemplate: value => value },
  }
  const fakeFs = { mkdirSync() {}, readFileSync: () => JSON.stringify({ size: 'medium', position }), writeFileSync: (_file, text) => saved.push(JSON.parse(text)) }
  const main = path.resolve(__dirname, '../main.cjs')
  vm.runInNewContext(fs.readFileSync(main, 'utf8'), {
    require: name => name === 'electron' ? electron : name === 'node:fs' ? fakeFs : name === './browser-bridge.cjs' ? { createBrowserBridge: () => ({ ready: Promise.resolve(), openSite: () => true, close() {} }) } : require(name),
    __dirname: path.dirname(main), process: { exit() { throw new Error('Unexpected process exit') } },
    setTimeout: () => 1, clearTimeout() {},
    URL, Response, Headers,
  }, { filename: main })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(window.url, 'xiaoxing://app/index.html')
  const event = { sender: window.webContents, senderFrame: { url: window.url } }
  return { window, saved, appEvents, trayEvents, trayMenu, send: (name, value, from = event) => ipc.get(name)(from, value) }
}

test('fractional video-clock movements retain their total displacement', async () => {
  const host = await boot()
  for (let i = 0; i < 120; i++) host.send('pet:move', { dx: .1, dy: -.05 })
  assert.deepEqual(host.window.getPosition(), [512, 294])
  for (let i = 0; i < 120; i++) host.send('pet:move', { dx: -.1, dy: .05 })
  assert.deepEqual(host.window.getPosition(), [500, 300])
})

test('clamped movement never accumulates a hidden offscreen distance', async () => {
  const host = await boot([2159, 300])
  host.send('pet:move', { dx: 200, dy: 0 })
  assert.deepEqual(host.window.getPosition(), [2160, 300])
  host.send('pet:move', { dx: -1, dy: 0 })
  assert.deepEqual(host.window.getPosition(), [2159, 300])
  const edge = await boot([0, 300])
  edge.send('pet:move', { dx: -.4, dy: 0 })
  edge.send('pet:move', { dx: .6, dy: 0 })
  assert.deepEqual(edge.window.getPosition(), [1, 300])
})

test('drag coordinates and later fractional moves use the new position', async () => {
  const host = await boot()
  host.send('pet:move', { dx: .2, dy: .2 })
  host.send('pet:drag', { phase: 'start', cursor: { x: 100, y: 100 } })
  host.send('pet:drag', { phase: 'move', cursor: { x: 60, y: 80 } })
  host.send('pet:drag', { phase: 'end' })
  assert.deepEqual(host.window.getPosition(), [460, 280])
  for (let i = 0; i < 10; i++) host.send('pet:move', { dx: .1, dy: 0 })
  assert.deepEqual(host.window.getPosition(), [461, 280])
  host.appEvents.get('before-quit')()
  assert.deepEqual(host.saved.at(-1).position, [461, 280])
})

test('invalid values and unrelated senders cannot move or poison the window', async () => {
  const host = await boot()
  host.send('pet:move', { dx: NaN, dy: 0 })
  host.send('pet:move', { dx: 201, dy: 0 })
  host.send('pet:move', { dx: 30, dy: 0 }, { sender: {}, senderFrame: { url: 'xiaoxing://app/index.html' } })
  assert.deepEqual(host.window.getPosition(), [500, 300])
  host.send('pet:move', { dx: 20, dy: 0 })
  assert.deepEqual(host.window.getPosition(), [520, 300])
})

test('tray and second launch restore a hidden, click-through pet with keyboard focus', async () => {
  const host = await boot()
  for (const restore of [host.trayEvents.get('click'), host.appEvents.get('second-instance')]) {
    host.send('pet:passthrough', true)
    host.send('pet:hide')
    host.window.focused = false
    assert.equal(host.window.ignoreMouse, true)
    assert.equal(host.window.visible, false)
    restore()
    assert.equal(host.window.ignoreMouse, false)
    assert.equal(host.window.visible, true)
    assert.equal(host.window.focused, true)
  }
})

test('normal-entry diagnostics leave the normal asset gate and playback rate intact', async () => {
  const host = await boot(undefined, { diagnostics: '', 'review-slow': '' })
  const config = host.send('pet:config')
  assert.equal(config.review, false)
  assert.equal(config.diagnostics, true)
  assert.equal(config.reviewPlaybackRate, 1)
  assert.equal(config.manifest, 'xiaoxing://media/motion.json')
  const review = await boot(undefined, { 'review-pack': '/review-candidate', 'review-slow': '' })
  assert.equal(review.send('pet:config').reviewPlaybackRate, .25)
})

test('tray corner command also restores a hidden pet and keyboard focus', async () => {
  const host = await boot()
  host.send('pet:passthrough', true)
  host.send('pet:hide')
  host.window.focused = false
  host.trayMenu.find(item => item.label === '回到角落').click()
  assert.equal(host.window.visible, true)
  assert.equal(host.window.ignoreMouse, false)
  assert.equal(host.window.focused, true)
  assert.deepEqual(host.window.getPosition(), [2144, 628])
})
