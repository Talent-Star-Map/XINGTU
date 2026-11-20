import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/companion.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { readPetPreferences, clampPetPosition, PET_DEFAULTS, petAsset } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

// Malformed or older browser preferences cannot break startup.
for (const value of [null, '', '{broken', 'null', '12', '"hello"']) {
  assert.deepEqual(readPetPreferences(value), PET_DEFAULTS)
}
assert.deepEqual(readPetPreferences(JSON.stringify({ size: 'toString', position: { x: '12', y: 20 }, collapsed: 'false', wander: 'yes' })), PET_DEFAULTS)
assert.deepEqual(readPetPreferences(JSON.stringify({ size: 'large', position: { x: -100, y: 9999 }, collapsed: true, wander: true })), {
  size: 'large', position: { x: -100, y: 9999 }, collapsed: true, wander: true,
})

// Persisted coordinates from a large display remain reachable on mobile.
assert.deepEqual(clampPetPosition({ x: 1800, y: 1200 }, 375, 667, 208), { x: 155, y: 447 })
assert.deepEqual(clampPetPosition({ x: -30, y: -1 }, 375, 667, 156), { x: 12, y: 12 })
assert.deepEqual(clampPetPosition({ x: 50, y: 50 }, 100, 100, 208), { x: 12, y: 12 })

// Every state and both eating key poses reference a shipped transparent asset.
for (const action of ['idle', 'wave', 'walk', 'sleep', 'eat']) {
  for (const chewing of [false, true]) {
    const path = petAsset(action, chewing)
    const data = await readFile(new URL(`../public${path}`, import.meta.url))
    assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a')
    assert.equal(data.readUInt32BE(16), 512)
    assert.equal(data.readUInt32BE(20), 512)
    assert.equal(data[25], 6, 'RGBA transparency must survive sprite extraction')
  }
}
assert.notEqual(petAsset('eat'), petAsset('eat', true))
console.log('Companion checks passed: preferences, viewport bounds, six RGBA assets, eating key poses.')
