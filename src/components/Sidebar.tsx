import type { UsageStats } from '../hooks/useClaude'

interface SidebarProps {
  folderPath: string
  onBrowse: () => void
  onFolderChange: (path: string) => void
  sessionId: string | null
  usage: UsageStats
  onNewSession: () => void
  onSpawnTerminal: () => void
  isClaudeInstalled: boolean | null
  claudeVersion: string | null
  model: string
  onModelChange: (model: string) => void
  permissionMode: string
  onPermissionModeChange: (mode: string) => void
  useStreaming: boolean
  onStreamingChange: (streaming: boolean) => void
}

const MODELS = [
  { value: 'sonnet', label: 'Claude Sonnet' },
  { value: 'opus', label: 'Claude Opus' },
  { value: 'haiku', label: 'Claude Haiku' },
]

const PERMISSION_MODES = [
  { value: 'ask', label: 'Ask (Default)' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'acceptAll', label: 'Accept All' },
  { value: 'plan', label: 'Plan Mode' },
]

export function Sidebar({
  folderPath,
  onBrowse,
  onFolderChange,
  sessionId,
  usage,
  onNewSession,
  onSpawnTerminal,
  isClaudeInstalled,
  claudeVersion,
  model,
  onModelChange,
  permissionMode,
  onPermissionModeChange,
  useStreaming,
  onStreamingChange,
}: SidebarProps) {
  return (
    <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-white">Arcadia</h1>
        <p className="text-xs text-zinc-500 mt-1">Claude Code GUI</p>
      </div>

      {/* Status */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-2 h-2 rounded-full ${isClaudeInstalled ? 'bg-green-500' : isClaudeInstalled === false ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`}
          />
          <span className="text-sm text-zinc-400">
            {isClaudeInstalled === null
              ? 'Checking Claude...'
              : isClaudeInstalled
                ? 'Claude Code Connected'
                : 'Claude Code Not Found'}
          </span>
        </div>
        {claudeVersion && (
          <p className="text-xs text-zinc-600 ml-4">{claudeVersion}</p>
        )}
      </div>

      {/* Working Directory */}
      <div className="p-4 border-b border-zinc-800">
        <label className="block text-sm text-zinc-400 mb-2">Working Directory</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => onFolderChange(e.target.value)}
            placeholder="Select folder..."
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={onBrowse}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
          >
            Browse
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-b border-zinc-800 space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Permission Mode</label>
          <select
            value={permissionMode}
            onChange={(e) => onPermissionModeChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {PERMISSION_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Stream Responses</label>
          <button
            onClick={() => onStreamingChange(!useStreaming)}
            className={`relative w-11 h-6 rounded-full transition-colors ${useStreaming ? 'bg-indigo-600' : 'bg-zinc-700'}`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useStreaming ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      {/* Session Info */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-zinc-400">Session</span>
          <button
            onClick={onNewSession}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            New Session
          </button>
        </div>
        <div className="text-xs text-zinc-500 font-mono bg-zinc-800 rounded px-2 py-1 truncate">
          {sessionId ? sessionId.slice(0, 20) + '...' : 'No active session'}
        </div>
      </div>

      {/* Token Usage */}
      <div className="p-4 border-b border-zinc-800">
        <span className="text-sm text-zinc-400 block mb-3">Token Usage</span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-800 rounded-lg p-2">
            <div className="text-lg font-semibold text-white">
              {usage.inputTokens.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500">Input</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-2">
            <div className="text-lg font-semibold text-white">
              {usage.outputTokens.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500">Output</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-2">
            <div className="text-lg font-semibold text-indigo-400">
              {usage.totalTokens.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500">Total</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 mt-auto">
        <button
          onClick={onSpawnTerminal}
          disabled={!folderPath}
          className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Open in Terminal
        </button>
      </div>
    </div>
  )
}
