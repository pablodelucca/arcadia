import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  onCancel?: () => void
  isLoading: boolean
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
  defaultValue?: string
}

export function ChatInput({
  onSend,
  onCancel,
  isLoading,
  isStreaming,
  disabled,
  placeholder = 'Ask Claude...',
  defaultValue = '',
}: ChatInputProps) {
  const [input, setInput] = useState(defaultValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!input.trim() || isLoading || disabled) return
    onSend(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isActive = isLoading || isStreaming

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Select a working directory to start' : placeholder}
            disabled={isActive || disabled}
            rows={1}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />
        </div>

        {isActive ? (
          <button
            onClick={onCancel}
            className="px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Cancel
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Send
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
        <span>Press Enter to send, Shift+Enter for new line</span>
        {isStreaming && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Streaming response...
          </span>
        )}
      </div>
    </div>
  )
}
