// Legacy API types
export interface PickFolderResult {
  success: boolean
  path?: string
  message?: string
}

export interface SpawnTerminalResult {
  success: boolean
  message: string
}

// Claude Code types
export interface ClaudeSpawnOptions {
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

export interface ClaudeResponse {
  session_id: string
  processId: string
  // Claude CLI returns result as a string directly
  result: string | {
    content: Array<{
      type: string
      text?: string
    }>
  }
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  total_cost_usd?: number
  duration_ms?: number
  num_turns?: number
  messages?: unknown[]
  structured_output?: unknown
}

export interface ClaudeStreamResult {
  processId: string
  sessionId: string | null
}

export interface MCPServerConfig {
  name: string
  transport: 'http' | 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  scope?: 'local' | 'project' | 'user'
  env?: Record<string, string>
}

export interface ClaudeAPI {
  // Core operations
  spawn: (options: ClaudeSpawnOptions) => Promise<ClaudeResponse>
  stream: (options: ClaudeSpawnOptions) => Promise<ClaudeStreamResult>
  cancel: (processId: string) => Promise<{ success: boolean; error?: string }>
  continue: (options: Omit<ClaudeSpawnOptions, 'sessionId'>) => Promise<ClaudeResponse>
  listProcesses: () => Promise<string[]>

  // Utilities
  version: () => Promise<string>
  checkInstalled: () => Promise<boolean>

  // MCP management
  mcpList: () => Promise<string>
  mcpAdd: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string }>
  mcpRemove: (name: string) => Promise<{ success: boolean }>

  // Event listeners (return cleanup function)
  onProgress: (callback: (data: { processId: string; chunk: string }) => void) => () => void
  onStreamText: (callback: (data: { processId: string; text: string }) => void) => () => void
  onStreamEvent: (callback: (data: { processId: string; event: unknown }) => void) => () => void
  onStreamStart: (callback: (data: { processId: string }) => void) => () => void
  onStreamEnd: (
    callback: (data: { processId: string; code: number; sessionId: string | null }) => void
  ) => () => void
  onStderr: (callback: (data: { processId: string; data: string }) => void) => () => void

  // Cleanup
  removeAllListeners: () => void
}

export interface ElectronAPI {
  // Legacy APIs
  pickFolder: () => Promise<PickFolderResult>
  spawnTerminal: (cwd?: string) => Promise<SpawnTerminalResult>

  // Claude Code API
  claude: ClaudeAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
