import { useEffect, useState } from 'react'
import { COLORS } from './VisualPrimitives'

type Word = { name: string; count: number }
type PlacedWord = Word & { x: number; y: number; size: number; rotate: number; color: string }
const WIDTH = 900, HEIGHT = 420, CELL = 3
const COLS = WIDTH / CELL, ROWS = HEIGHT / CELL

function prefix(grid: Uint8Array) {
  const result = new Int32Array((COLS + 1) * (ROWS + 1))
  for (let y = 0; y < ROWS; y++) {
    let sum = 0
    for (let x = 0; x < COLS; x++) {
      sum += grid[y * COLS + x]
      result[(y + 1) * (COLS + 1) + x + 1] = result[y * (COLS + 1) + x + 1] + sum
    }
  }
  return result
}

function area(grid: Int32Array, x: number, y: number, w: number, h: number) {
  const stride = COLS + 1
  return grid[(y + h) * stride + x + w] - grid[y * stride + x + w] - grid[(y + h) * stride + x] + grid[y * stride + x]
}

/** Fit actual labels once each into a Git glyph mask; no repeated filler words. */
export function packGitWords(words: Word[]): PlacedWord[] {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH; canvas.height = HEIGHT
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.font = '900 460px Arial, sans-serif'
  const initial = ctx.measureText('Git')
  const size = 460 * Math.min(840 / initial.width, 360 / (initial.actualBoundingBoxAscent + initial.actualBoundingBoxDescent))
  ctx.font = `900 ${size}px Arial, sans-serif`
  const metrics = ctx.measureText('Git')
  ctx.fillText('Git', (WIDTH - metrics.width) / 2, (HEIGHT - metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2 + metrics.actualBoundingBoxAscent)
  const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data
  const mask = new Uint8Array(COLS * ROWS), occupied = new Uint8Array(COLS * ROWS)
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) mask[y * COLS + x] = pixels[((y * CELL + 1) * WIDTH + x * CELL + 1) * 4 + 3] > 128 ? 1 : 0
  const shape = prefix(mask)
  const candidates: { x: number; y: number; distance: number }[] = []
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (mask[y * COLS + x]) candidates.push({ x, y, distance: ((x - COLS / 2) / 1.8) ** 2 + (y - ROWS / 2) ** 2 })
  candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x)
  const max = Math.max(1, ...words.map(w => w.count)), placed: PlacedWord[] = []
  for (const [index, word] of words.entries()) {
    const collision = prefix(occupied)
    let found = false
    // Frequency determines desired font size; fit may reduce it at letter boundaries.
    const desired = Math.min(14 + 32 * Math.sqrt(word.count / max), word.name.length > 14 ? 27 : 50)
    for (const rotate of [0, ...(word.name.length <= 22 ? [90] : [])]) {
      for (let fontSize = desired; fontSize >= 8 && !found; fontSize -= 1) {
        ctx.font = `600 ${fontSize}px Arial, sans-serif`
        const textWidth = ctx.measureText(word.name).width
        const w = Math.ceil(((rotate ? fontSize * .92 : textWidth) + 3) / CELL)
        const h = Math.ceil(((rotate ? textWidth : fontSize * .92) + 3) / CELL)
        for (const point of candidates) {
          const x = point.x - Math.floor(w / 2), y = point.y - Math.floor(h / 2)
          if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) continue
          if (area(shape, x, y, w, h) < w * h * .97 || area(collision, x, y, w, h)) continue
          placed.push({ ...word, x: (x + w / 2) * CELL, y: (y + h / 2) * CELL, size: fontSize, rotate, color: COLORS[index % COLORS.length] })
          for (let dy = y; dy < y + h; dy++) occupied.fill(1, dy * COLS + x, dy * COLS + x + w)
          found = true; break
        }
      }
      if (found) break
    }
  }
  return placed
}

export default function GitWordCloud({ words, selected, onPick }: { words: Word[]; selected: string; onPick: (name: string) => void }) {
  const [placed, setPlaced] = useState<PlacedWord[]>([])
  const signature = words.map(w => `${w.name}:${w.count}`).join('|')
  useEffect(() => { setPlaced(packGitWords(words)) }, [signature])
  return <div>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="GitHub每日技术标签词云" className="w-full h-auto" role="img">
      {placed.map(word => <text key={word.name} x={word.x} y={word.y} transform={`rotate(${word.rotate},${word.x},${word.y})`} textAnchor="middle" dominantBaseline="central" fontFamily="Arial, sans-serif" fontWeight="600" fontSize={word.size} fill={word.color} opacity={!selected || selected === word.name ? 1 : .3} role="button" tabIndex={0} aria-label={`${word.name}：${word.count}个仓库`} onClick={() => onPick(word.name)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(word.name) } }} className="cursor-pointer hover:underline"><title>{word.name} · {word.count} 个仓库</title>{word.name}</text>)}
    </svg>
    <details className="text-xs mt-3"><summary className="cursor-pointer opacity-60">查看全部 {words.length} 个标签与数量（字形内排入 {placed.length} 项）</summary><div className="flex flex-wrap gap-2 mt-3">{words.map(w => <button key={w.name} onClick={() => onPick(w.name)} className="border rounded-lg px-2 py-1">{w.name} · {w.count}</button>)}</div></details>
  </div>
}
