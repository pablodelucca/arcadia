import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

// Track active Claude processes
const claudeProcesses = new Map<string, ChildProcess>()

// Escape argument for shell (Windows cmd.exe)
// Wraps in double quotes and escapes internal quotes
function shellEscape(arg: string): string {
  // Double any existing double quotes, then wrap in quotes
  return `"${arg.replace(/"/g, '""')}"`
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#18181b', // zinc-900
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
    // Clean up all Claude processes
    claudeProcesses.forEach((proc) => proc.kill())
    claudeProcesses.clear()
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

// ============================================================================
// IPC Handlers
// ============================================================================

// Pick folder dialog
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select working directory',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, message: 'No folder selected' }
  }

  return { success: true, path: result.filePaths[0] }
})

// Spawn external terminal with Claude (legacy)
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

// ============================================================================
// Claude Code Integration - JSON Mode
// ============================================================================

interface ClaudeSpawnOptions {
  prompt: string
  cwd: string
  sessionId?: string
  allowedTools?: string[]
  disallowedTools?: string[]
  permissionMode?: 'plan' | 'acceptEdits' | 'acceptAll' | 'ask'
  model?: string
  maxTurns?: number
  systemPrompt?: string
  appendSystemPrompt?: string
}

ipcMain.handle('claude:spawn', async (event, options: ClaudeSpawnOptions) => {
  const {
    prompt,
    cwd,
    sessionId,
    allowedTools,
    disallowedTools,
    permissionMode,
    model,
    maxTurns,
    systemPrompt,
    appendSystemPrompt,
  } = options

  const args = ['-p', shellEscape(prompt), '--output-format', 'json']

  // Session management
  if (sessionId) args.push('--resume', sessionId)

  // Tools
  if (allowedTools?.length) args.push('--allowedTools', allowedTools.join(','))
  if (disallowedTools?.length) args.push('--disallowedTools', disallowedTools.join(','))

  // Permissions
  if (permissionMode) args.push('--permission-mode', permissionMode)

  // Model
  if (model) args.push('--model', model)

  // Limits
  if (maxTurns) args.push('--max-turns', String(maxTurns))

  // Prompts
  if (systemPrompt) args.push('--system-prompt', shellEscape(systemPrompt))
  if (appendSystemPrompt) args.push('--append-system-prompt', shellEscape(appendSystemPrompt))

  return new Promise((resolve, reject) => {
    const processId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    const claude = spawn('claude', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    claudeProcesses.set(processId, claude)

    let stdout = ''
    let stderr = ''

    claude.stdout?.on('data', (data) => {
      const chunk = data.toString()
      stdout += chunk
      // Send progress updates to renderer
      event.sender.send('claude:progress', { processId, chunk })
    })

    claude.stderr?.on('data', (data) => {
      stderr += data.toString()
      event.sender.send('claude:stderr', { processId, data: data.toString() })
    })

    claude.on('error', (error) => {
      claudeProcesses.delete(processId)
      reject({ error: error.message, processId })
    })

    claude.on('close', (code) => {
      claudeProcesses.delete(processId)

      if (code === 0) {
        try {
          const response = JSON.parse(stdout)
          resolve({ ...response, processId })
        } catch (e) {
          // Sometimes Claude outputs non-JSON first, try to extract JSON
          const jsonMatch = stdout.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try {
              const response = JSON.parse(jsonMatch[0])
              resolve({ ...response, processId })
              return
            } catch {
              // Fall through to error
            }
          }
          reject({ error: `Failed to parse response: ${stdout.slice(0, 500)}`, processId })
        }
      } else {
        reject({ error: `Claude exited with code ${code}: ${stderr || stdout}`, processId })
      }
    })
  })
})

// ============================================================================
// Claude Code Integration - Streaming Mode
// ============================================================================

ipcMain.handle('claude:stream', async (event, options: ClaudeSpawnOptions) => {
  const { prompt, cwd, sessionId, allowedTools, permissionMode, model } = options

  const args = [
    '-p',
    shellEscape(prompt),
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
  ]

  if (sessionId) args.push('--resume', sessionId)
  if (allowedTools?.length) args.push('--allowedTools', allowedTools.join(','))
  if (permissionMode) args.push('--permission-mode', permissionMode)
  if (model) args.push('--model', model)

  const processId = `claude-stream-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const claude = spawn('claude', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  })

  claudeProcesses.set(processId, claude)

  let buffer = ''
  let capturedSessionId: string | null = null

  claude.stdout?.on('data', (data) => {
    buffer += data.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const evt = JSON.parse(line)

        // Capture session ID from init event
        if (evt.type === 'system' && evt.subtype === 'init' && evt.session_id) {
          capturedSessionId = evt.session_id
        }

        // Extract text from text_delta events for easy consumption
        if (
          evt.type === 'stream_event' &&
          evt.event?.delta?.type === 'text_delta' &&
          evt.event.delta.text
        ) {
          event.sender.send('claude:stream-text', {
            processId,
            text: evt.event.delta.text,
          })
        }

        // Send all events for advanced UI features
        event.sender.send('claude:stream-event', { processId, event: evt })
      } catch {
        // Non-JSON line, skip
      }
    }
  })

  claude.stderr?.on('data', (data) => {
    event.sender.send('claude:stderr', { processId, data: data.toString() })
  })

  claude.on('close', (code) => {
    claudeProcesses.delete(processId)
    event.sender.send('claude:stream-end', { processId, code, sessionId: capturedSessionId })
  })

  // Send start event and return processId immediately (don't wait for close)
  event.sender.send('claude:stream-start', { processId })
  return { processId, sessionId: null }
})

// ============================================================================
// Process Management
// ============================================================================

ipcMain.handle('claude:cancel', async (_, processId: string) => {
  const process = claudeProcesses.get(processId)
  if (process) {
    process.kill('SIGINT')
    claudeProcesses.delete(processId)
    return { success: true }
  }
  return { success: false, error: 'Process not found' }
})

ipcMain.handle('claude:list-processes', async () => {
  return Array.from(claudeProcesses.keys())
})

// ============================================================================
// Session Management
// ============================================================================

ipcMain.handle('claude:continue', async (event, options: Omit<ClaudeSpawnOptions, 'sessionId'>) => {
  const args = ['-p', shellEscape(options.prompt), '-c', '--output-format', 'json']

  if (options.allowedTools?.length) {
    args.push('--allowedTools', options.allowedTools.join(','))
  }
  if (options.permissionMode) {
    args.push('--permission-mode', options.permissionMode)
  }
  if (options.model) {
    args.push('--model', options.model)
  }

  return new Promise((resolve, reject) => {
    const processId = `claude-continue-${Date.now()}`

    const claude = spawn('claude', args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    claudeProcesses.set(processId, claude)

    let stdout = ''
    let stderr = ''

    claude.stdout?.on('data', (d) => {
      stdout += d
      event.sender.send('claude:progress', { processId, chunk: d.toString() })
    })
    claude.stderr?.on('data', (d) => (stderr += d))

    claude.on('close', (code) => {
      claudeProcesses.delete(processId)
      if (code === 0) {
        try {
          resolve({ ...JSON.parse(stdout), processId })
        } catch {
          reject({ error: `Parse error: ${stdout.slice(0, 200)}`, processId })
        }
      } else {
        reject({ error: `Exit code ${code}: ${stderr}`, processId })
      }
    })
  })
})

// ============================================================================
// Utility Commands
// ============================================================================

ipcMain.handle('claude:version', async () => {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    let stdout = ''
    claude.stdout?.on('data', (d) => (stdout += d))

    claude.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject('Failed to get version')
    })
  })
})

ipcMain.handle('claude:check-installed', async () => {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    claude.on('close', (code) => {
      resolve(code === 0)
    })

    claude.on('error', () => {
      resolve(false)
    })
  })
})

// ============================================================================
// MCP Server Management
// ============================================================================

ipcMain.handle('claude:mcp-list', async () => {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['mcp', 'list'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    let stdout = ''
    let stderr = ''
    claude.stdout?.on('data', (d) => (stdout += d))
    claude.stderr?.on('data', (d) => (stderr += d))

    claude.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(stderr || 'Failed to list MCP servers')
    })
  })
})

ipcMain.handle(
  'claude:mcp-add',
  async (
    _,
    config: {
      name: string
      transport: 'http' | 'sse' | 'stdio'
      url?: string
      command?: string
      args?: string[]
      scope?: 'local' | 'project' | 'user'
      env?: Record<string, string>
    }
  ) => {
    const args = ['mcp', 'add', '--transport', config.transport]

    if (config.scope) args.push('--scope', config.scope)

    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        args.push('--env', `${key}=${value}`)
      }
    }

    args.push(config.name)

    if (config.transport === 'stdio' && config.command) {
      args.push('--', config.command, ...(config.args || []))
    } else if (config.url) {
      args.push(config.url)
    }

    return new Promise((resolve, reject) => {
      const claude = spawn('claude', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      })

      let stderr = ''
      claude.stderr?.on('data', (d) => (stderr += d))

      claude.on('close', (code) => {
        if (code === 0) resolve({ success: true })
        else reject({ success: false, error: stderr })
      })
    })
  }
)

ipcMain.handle('claude:mcp-remove', async (_, name: string) => {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['mcp', 'remove', name], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    claude.on('close', (code) => resolve({ success: code === 0 }))
  })
})
