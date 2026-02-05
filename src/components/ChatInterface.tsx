import { useRef, useEffect } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { Message } from '../hooks/useClaude'

interface ChatInterfaceProps {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  streamingText: string
  onSend: (message: string) => void
  onCancel: () => void
  onClearError: () => void
  disabled?: boolean
  folderPath: string
}

export function ChatInterface({
  messages,
  isLoading,
  isStreaming,
  error,
  streamingText,
  onSend,
  onCancel,
  onClearError,
  disabled,
  folderPath,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingText])

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      {/* Header bar */}
      <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <span className="truncate max-w-md">
            {folderPath || 'No directory selected'}
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500">
            <svg
              className="w-16 h-16 mb-4 text-zinc-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="text-lg font-medium text-zinc-400 mb-2">Start a conversation</h3>
            <p className="text-sm text-center max-w-md">
              {disabled
                ? 'Select a working directory in the sidebar to start chatting with Claude.'
                : 'Ask Claude to help with your code. Try "What files are in this project?" or "Explain the main module."'}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                streamingText={message.isStreaming ? streamingText : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-300">{error}</span>
          <button
            onClick={onClearError}
            className="text-red-400 hover:text-red-300 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Input area */}
      <ChatInput
        onSend={onSend}
        onCancel={onCancel}
        isLoading={isLoading}
        isStreaming={isStreaming}
        disabled={disabled}
      />
    </div>
  )
}
