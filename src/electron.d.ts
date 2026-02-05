export interface ElectronAPI {
  pickFolder: () => Promise<{ success: boolean; path?: string; message?: string }>
  spawnTerminal: (cwd?: string) => Promise<{ success: boolean; message: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
