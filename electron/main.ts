import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // In development, load from Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// IPC Handlers

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select working directory for Claude terminal',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, message: 'No folder selected' }
  }

  return { success: true, path: result.filePaths[0] }
})

ipcMain.handle('spawn-terminal', async (_, cwd?: string) => {
  try {
    const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', 'claude'], {
      detached: true,
      stdio: 'ignore',
      shell: true,
      cwd: cwd || undefined,
    })

    child.unref()

    return {
      success: true,
      message: `Claude terminal spawned${cwd ? ` in ${cwd}` : ''}`,
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to spawn terminal: ${(error as Error).message}`,
    }
  }
})
