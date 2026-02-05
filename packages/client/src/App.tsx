import { useState } from 'react'

const API_URL = 'http://localhost:3000'

function App() {
  const [status, setStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const spawnTerminal = async () => {
    setIsLoading(true)
    setStatus(null)

    try {
      const response = await fetch(`${API_URL}/terminals/spawn`, {
        method: 'POST',
      })
      const data = await response.json()
      setStatus(data.message)
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Failed to connect to server'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
      <h1 className="text-5xl font-bold mb-2">Arcadia</h1>
      <p className="text-zinc-400 mb-8">Multi-Agent System GUI</p>

      <div className="flex flex-col items-center p-8">
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
