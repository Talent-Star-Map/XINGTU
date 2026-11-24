export type PetAction = 'idle' | 'wave' | 'walk' | 'sleep' | 'eat'
export type PetSize = 'small' | 'medium' | 'large'
export type Point = { x: number; y: number }
export type PetPreferences = { position: Point | null; size: PetSize; collapsed: boolean; wander: boolean }

export const PET_STORAGE_KEY = 'xingtu_xiaogui_v1'
export const PET_SIZES: Record<PetSize, number> = { small: 140, medium: 196, large: 260 }
export const PET_DEFAULTS: PetPreferences = { position: null, size: 'medium', collapsed: false, wander: false }
export const PET_LABELS: Record<PetAction, string> = { idle: '陪着你', wave: '打个招呼', walk: '散散步', sleep: '睡个好觉', eat: '开饭啦' }

// Storage is optional: private browsing and a corrupt preference must not break the app.
export function readPetPreferences(raw: string | null): PetPreferences {
  try {
    const value = JSON.parse(raw || 'null')
    if (!value || typeof value !== 'object') return { ...PET_DEFAULTS }
    const position = value.position
    return {
      position: position && Number.isFinite(position.x) && Number.isFinite(position.y)
        ? { x: position.x, y: position.y } : null,
      size: Object.prototype.hasOwnProperty.call(PET_SIZES, value.size) ? value.size : 'medium',
      collapsed: value.collapsed === true,
      wander: value.wander === true,
    }
  } catch { return { ...PET_DEFAULTS } }
}

export function clampPetPosition(point: Point, width: number, height: number, size: number): Point {
  const margin = 12
  return {
    x: Math.max(margin, Math.min(point.x, Math.max(margin, width - size - margin))),
    y: Math.max(margin, Math.min(point.y, Math.max(margin, height - size - margin))),
  }
}

export function petAsset(action: PetAction, chewing = false): string {
  return `/mascot/xiaogui/${action === 'eat' ? (chewing ? 'eat-chew' : 'eat-spoon') : action}.png`
}
