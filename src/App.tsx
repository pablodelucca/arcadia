import { useState, useEffect, useCallback } from 'react'
import { Sidebar, ChatInterface } from './components'
import { useClaude } from './hooks/useClaude'
import type { ClaudeSpawnOptions } from './electron.d'

function App() {
  // Folder and Claude status
  const [folderPath, setFolderPath] = useState('')
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null)
  const [claudeVersion, setClaudeVersion] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Settings
  const [model, setModel] = useState('sonnet')
  const [permissionMode, setPermissionMode] = useState<ClaudeSpawnOptions['permissionMode']>('acceptEdits')
  const [useStreaming, setUseStreaming] = useState(true)

  // Claude hook
  const claude = useClaude({
    cwd: folderPath,
    model,
    permissionMode,
    allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep', 'Write'],
  })

  // Check Claude installation on mount
  useEffect(() => {
    const checkClaude = async () => {
      // Guard for non-Electron environments
      if (!window.electron?.claude) {
        console.warn('Running outside Electron - Claude API not available')
        return
      }

      try {
        const installed = await window.electron.claude.checkInstalled()
        setIsClaudeInstalled(installed)

        if (installed) {
          const version = await window.electron.claude.version()
          setClaudeVersion(version)
        }
      } catch (error) {
        setIsClaudeInstalled(false)
        console.error('Failed to check Claude installation:', error)
      }
    }

    checkClaude()
  }, [])

  // Browse for folder
  const browseFolder = useCallback(async () => {
    const result = await window.electron.pickFolder()
    if (result.success && result.path) {
      setFolderPath(result.path)
    }
  }, [])

  // Spawn external terminal
  const spawnTerminal = useCallback(async () => {
    if (!folderPath) return

    try {
      const result = await window.electron.spawnTerminal(folderPath)
      setStatusMessage(result.message)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (error) {
      setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [folderPath])

  // Send message handler
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (useStreaming) {
        await claude.sendMessageStreaming(message)
      } else {
        await claude.sendMessage(message)
      }
    },
    [useStreaming, claude]
  )

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        folderPath={folderPath}
        onBrowse={browseFolder}
        onFolderChange={setFolderPath}
        sessionId={claude.sessionId}
        usage={claude.usage}
        onNewSession={claude.clearSession}
        onSpawnTerminal={spawnTerminal}
        isClaudeInstalled={isClaudeInstalled}
        claudeVersion={claudeVersion}
        model={model}
        onModelChange={setModel}
        permissionMode={permissionMode || 'acceptEdits'}
        onPermissionModeChange={(mode) => setPermissionMode(mode as ClaudeSpawnOptions['permissionMode'])}
        useStreaming={useStreaming}
        onStreamingChange={setUseStreaming}
      />

      {/* Main Chat Area */}
      <ChatInterface
        messages={claude.messages}
        isLoading={claude.isLoading}
        isStreaming={claude.isStreaming}
        error={claude.error}
        streamingText={claude.streamingText}
        onSend={handleSendMessage}
        onCancel={claude.cancel}
        onClearError={claude.clearError}
        disabled={!folderPath || !isClaudeInstalled}
        folderPath={folderPath}
      />

      {/* Status toast */}
      {statusMessage && (
        <div className="fixed bottom-4 right-4 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200">
          <p className="text-sm text-zinc-300">{statusMessage}</p>
        </div>
      )}

      {/* Claude not installed warning */}
      {isClaudeInstalled === false && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Claude Code Not Found</h2>
            </div>
            <p className="text-zinc-400 mb-4">
              Claude Code CLI is not installed or not available in your system PATH. Please install
              it to use Arcadia.
            </p>
            <div className="bg-zinc-800 rounded-lg p-3 mb-4">
              <code className="text-sm text-indigo-400">npm install -g @anthropic-ai/claude-code</code>
            </div>
            <button
              onClick={() => setIsClaudeInstalled(null)}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
