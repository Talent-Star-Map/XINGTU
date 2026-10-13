import { ref, computed } from 'vue'

const STORAGE_KEY = 'xingtu_theme'

function loadTheme() {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY)
    return saved === 'dark' || saved === 'light' ? saved : 'light'
  } catch {
    return 'light'
  }
}

const theme = ref(loadTheme())
const themeClass = computed(() => `theme-${theme.value}`)

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    uni.setStorageSync(STORAGE_KEY, theme.value)
  }

  return {
    theme,
    themeClass,
    toggleTheme
  }
}
