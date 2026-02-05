const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  spawnTerminal: (cwd?: string) => ipcRenderer.invoke('spawn-terminal', cwd),
})
