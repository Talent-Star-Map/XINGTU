const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('xiaoxingDesktop', {
  config: () => ipcRenderer.invoke('pet:config'),
  moveBy: (dx, dy) => ipcRenderer.send('pet:move', { dx, dy }),
  drag: (phase, cursor) => ipcRenderer.send('pet:drag', { phase, cursor }),
  passthrough: ignore => ipcRenderer.send('pet:passthrough', ignore),
  corner: () => ipcRenderer.send('pet:corner'),
  size: value => ipcRenderer.send('pet:size', value),
  hide: () => ipcRenderer.send('pet:hide'),
  quit: () => ipcRenderer.send('pet:quit'),
  openStarMap: () => ipcRenderer.invoke('pet:open-site'),
})
