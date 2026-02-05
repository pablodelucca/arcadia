import type { Message } from '../hooks/useClaude'

interface ChatMessageProps {
  message: Message
  streamingText?: string
}

export function ChatMessage({ message, streamingText }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.isStreaming

  // For streaming messages, show the streaming text
  const displayContent = isStreaming ? streamingText || '' : message.content

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : isSystem
              ? 'bg-red-900/50 text-red-200 border border-red-800'
              : 'bg-zinc-800 text-zinc-100'
        }`}
      >
        {/* Role indicator */}
        <div
          className={`text-xs mb-1 ${
            isUser ? 'text-indigo-200' : isSystem ? 'text-red-400' : 'text-zinc-400'
          }`}
        >
          {isUser ? 'You' : isSystem ? 'System' : 'Claude'}
          {isStreaming && (
            <span className="ml-2 inline-flex items-center">
              <span className="animate-pulse">typing</span>
              <span className="animate-bounce ml-0.5">...</span>
            </span>
          )}
        </div>

        {/* Message content */}
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {displayContent}
          {isStreaming && !displayContent && (
            <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse" />
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-indigo-300' : isSystem ? 'text-red-500' : 'text-zinc-500'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
