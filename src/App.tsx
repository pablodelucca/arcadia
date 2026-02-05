import { useState } from 'react'

function App() {
  const [status, setStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [folderPath, setFolderPath] = useState('')

  const browseFolder = async () => {
    const result = await window.electron.pickFolder()
    if (result.success && result.path) {
      setFolderPath(result.path)
    }
  }

  const spawnTerminal = async () => {
    setIsLoading(true)
    setStatus(null)

    try {
      const result = await window.electron.spawnTerminal(folderPath || undefined)
      setStatus(result.message)
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
      <h1 className="text-5xl font-bold mb-2">Arcadia</h1>
      <p className="text-zinc-400 mb-8">Multi-Agent System GUI</p>

      <div className="flex flex-col items-center p-8 gap-4">
        <div className="flex flex-col gap-2 w-full max-w-md">
          <label htmlFor="folder-path" className="text-sm text-zinc-400">
            Working Directory (optional)
          </label>
          <div className="flex gap-2">
            <input
              id="folder-path"
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="C:\path\to\project"
              className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={browseFolder}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Browse
            </button>
          </div>
        </div>
        <button
          onClick={spawnTerminal}
          disabled={isLoading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg font-medium transition-colors cursor-pointer"
        >
          {isLoading ? 'Spawning...' : 'Spawn Claude Terminal'}
        </button>
        {status && <p className="mt-4 text-zinc-400 text-center">{status}</p>}
      </div>
    </div>
  )
}

export default App
