import { cp, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vision = dirname(require.resolve('@mediapipe/tasks-vision'))
await mkdir(resolve(root, 'public/models/interview/wasm'), { recursive: true })
await cp(resolve(vision, 'wasm'), resolve(root, 'public/models/interview/wasm'), { recursive: true })
console.log('MediaPipe WASM copied locally; no CDN required at runtime.')
