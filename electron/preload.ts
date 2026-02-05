const { contextBridge, ipcRenderer } = require('electron')

// Types for the Claude API
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

interface MCPServerConfig {
  name: string
  transport: 'http' | 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  scope?: 'local' | 'project' | 'user'
  env?: Record<string, string>
}

// Event data types
interface ProgressData {
  processId: string
  chunk: string
}

interface StreamTextData {
  processId: string
  text: string
}

interface StreamEventData {
  processId: string
  event: unknown
}

interface StreamStartData {
  processId: string
}

interface StreamEndData {
  processId: string
  code: number
  sessionId: string | null
}

interface StderrData {
  processId: string
  data: string
}

// Generic callback type
type Callback<T> = (data: T) => void

// Callback registries for cleanup
const callbacks = {
  progress: new Set<Callback<ProgressData>>(),
  streamText: new Set<Callback<StreamTextData>>(),
  streamEvent: new Set<Callback<StreamEventData>>(),
  streamStart: new Set<Callback<StreamStartData>>(),
  streamEnd: new Set<Callback<StreamEndData>>(),
  stderr: new Set<Callback<StderrData>>(),
}

// Set up listeners once
ipcRenderer.on('claude:progress', (_: unknown, data: ProgressData) => {
  callbacks.progress.forEach((cb) => cb(data))
})
ipcRenderer.on('claude:stream-text', (_: unknown, data: StreamTextData) => {
  callbacks.streamText.forEach((cb) => cb(data))
})
ipcRenderer.on('claude:stream-event', (_: unknown, data: StreamEventData) => {
  callbacks.streamEvent.forEach((cb) => cb(data))
})
ipcRenderer.on('claude:stream-start', (_: unknown, data: StreamStartData) => {
  callbacks.streamStart.forEach((cb) => cb(data))
})
ipcRenderer.on('claude:stream-end', (_: unknown, data: StreamEndData) => {
  callbacks.streamEnd.forEach((cb) => cb(data))
})
ipcRenderer.on('claude:stderr', (_: unknown, data: StderrData) => {
  callbacks.stderr.forEach((cb) => cb(data))
})

contextBridge.exposeInMainWorld('electron', {
  // Legacy APIs
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  spawnTerminal: (cwd?: string) => ipcRenderer.invoke('spawn-terminal', cwd),

  // Claude Code APIs
  claude: {
    // Core operations
    spawn: (options: ClaudeSpawnOptions) => ipcRenderer.invoke('claude:spawn', options),
    stream: (options: ClaudeSpawnOptions) => ipcRenderer.invoke('claude:stream', options),
    cancel: (processId: string) => ipcRenderer.invoke('claude:cancel', processId),
    continue: (options: Omit<ClaudeSpawnOptions, 'sessionId'>) =>
      ipcRenderer.invoke('claude:continue', options),
    listProcesses: () => ipcRenderer.invoke('claude:list-processes'),

    // Utilities
    version: () => ipcRenderer.invoke('claude:version'),
    checkInstalled: () => ipcRenderer.invoke('claude:check-installed'),

    // MCP management
    mcpList: () => ipcRenderer.invoke('claude:mcp-list'),
    mcpAdd: (config: MCPServerConfig) => ipcRenderer.invoke('claude:mcp-add', config),
    mcpRemove: (name: string) => ipcRenderer.invoke('claude:mcp-remove', name),

    // Event listeners with cleanup support
    onProgress: (callback: Callback<ProgressData>) => {
      callbacks.progress.add(callback)
      return () => callbacks.progress.delete(callback)
    },
    onStreamText: (callback: Callback<StreamTextData>) => {
      callbacks.streamText.add(callback)
      return () => callbacks.streamText.delete(callback)
    },
    onStreamEvent: (callback: Callback<StreamEventData>) => {
      callbacks.streamEvent.add(callback)
      return () => callbacks.streamEvent.delete(callback)
    },
    onStreamStart: (callback: Callback<StreamStartData>) => {
      callbacks.streamStart.add(callback)
      return () => callbacks.streamStart.delete(callback)
    },
    onStreamEnd: (callback: Callback<StreamEndData>) => {
      callbacks.streamEnd.add(callback)
      return () => callbacks.streamEnd.delete(callback)
    },
    onStderr: (callback: Callback<StderrData>) => {
      callbacks.stderr.add(callback)
      return () => callbacks.stderr.delete(callback)
    },

    // Clear all listeners for a specific category
    removeAllListeners: () => {
      callbacks.progress.clear()
      callbacks.streamText.clear()
      callbacks.streamEvent.clear()
      callbacks.streamStart.clear()
      callbacks.streamEnd.clear()
      callbacks.stderr.clear()
    },
  },
})
