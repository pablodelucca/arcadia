import { useState } from 'react'
import type { Message, ContentBlock, ToolActivity } from '../hooks/useClaude'

interface ChatMessageProps {
  message: Message
  streamingText?: string
  streamingToolActivities?: ToolActivity[]
}

// Map tool names to friendly display names and icons
const toolDisplayInfo: Record<string, { label: string; icon: string }> = {
  Read: { label: 'Reading', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  Edit: { label: 'Editing', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  Write: { label: 'Writing', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  Bash: { label: 'Running', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  Glob: { label: 'Searching', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  Grep: { label: 'Searching', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  Task: { label: 'Spawning agent', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  WebFetch: { label: 'Fetching', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  WebSearch: { label: 'Searching web', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
}

function getToolInfo(toolName: string) {
  const baseName = toolName.split('__').pop() || toolName
  return toolDisplayInfo[baseName] || toolDisplayInfo[toolName] || {
    label: toolName,
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  }
}

function formatToolInput(input?: Record<string, unknown>): string {
  if (!input) return ''
  if (input.file_path) return String(input.file_path)
  if (input.path) return String(input.path)
  if (input.command) {
    const cmd = String(input.command)
    return cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd
  }
  if (input.pattern) return String(input.pattern)
  if (input.url) return String(input.url)
  if (input.query) return String(input.query)
  const entries = Object.entries(input)
  if (entries.length > 0) {
    const str = String(entries[0][1])
    return str.length > 50 ? str.slice(0, 50) + '...' : str
  }
  return ''
}

function InlineToolActivity({ activity }: { activity: ToolActivity }) {
  const [expanded, setExpanded] = useState(false)
  const { label, icon } = getToolInfo(activity.toolName)
  const inputStr = formatToolInput(activity.input)
  const isActive = activity.status === 'running' || activity.status === 'pending'

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 w-full text-left ${
          isActive
            ? 'bg-indigo-950/50 border border-indigo-800/50 text-indigo-200'
            : activity.status === 'completed'
              ? 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50'
              : 'bg-red-950/50 border border-red-800/50 text-red-300'
        }`}
      >
        {/* Status indicator */}
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          isActive
            ? 'bg-indigo-400 animate-pulse'
            : activity.status === 'completed'
              ? 'bg-green-500'
              : 'bg-red-500'
        }`} />

        {/* Icon */}
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'animate-spin-slow' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>

        {/* Label and input */}
        <span className="font-medium">{label}</span>
        {inputStr && (
          <span className="text-zinc-500 truncate flex-1" title={inputStr}>
            {inputStr}
          </span>
        )}

        {/* Duration and expand indicator */}
        {activity.status === 'completed' && (
          <>
            {activity.endTime && (
              <span className="text-zinc-600">
                {Math.round((activity.endTime.getTime() - activity.startTime.getTime()) / 1000)}s
              </span>
            )}
            <svg
              className={`w-3 h-3 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Expanded output */}
      {expanded && activity.output && (
        <div className="mt-1 ml-6 p-2 bg-zinc-900 rounded border border-zinc-800 text-xs text-zinc-400 max-h-48 overflow-auto">
          <pre className="whitespace-pre-wrap">{activity.output}</pre>
        </div>
      )}
    </div>
  )
}

function renderContentBlocks(blocks: ContentBlock[]) {
  return blocks.map((block, index) => {
    if (block.type === 'text') {
      return (
        <div key={index} className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {block.text}
        </div>
      )
    } else if (block.type === 'tool') {
      return <InlineToolActivity key={block.activity.id} activity={block.activity} />
    }
    return null
  })
}

export function ChatMessage({ message, streamingText, streamingToolActivities }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.isStreaming

  // For streaming, build content blocks dynamically
  const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0

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
        {isStreaming ? (
          // During streaming, interleave text with tool activities at their insertion positions
          <div>
            {(() => {
              if (!streamingToolActivities || streamingToolActivities.length === 0) {
                // No tools, just show streaming text
                return (
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {streamingText || ''}
                    {!streamingText && (
                      <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse" />
                    )}
                  </div>
                )
              }

              // Sort tools by their text position
              const sortedTools = [...streamingToolActivities].sort(
                (a, b) => (a.textPosition ?? 0) - (b.textPosition ?? 0)
              )

              const elements: React.ReactNode[] = []
              let lastPos = 0

              sortedTools.forEach((tool, idx) => {
                const toolPos = tool.textPosition ?? 0

                // Text before this tool
                if (toolPos > lastPos && streamingText) {
                  const textBefore = streamingText.slice(lastPos, toolPos)
                  if (textBefore) {
                    elements.push(
                      <div key={`text-${idx}`} className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {textBefore}
                      </div>
                    )
                  }
                }

                // The tool itself
                elements.push(<InlineToolActivity key={tool.id} activity={tool} />)
                lastPos = toolPos
              })

              // Text after the last tool
              if (streamingText && lastPos < streamingText.length) {
                const remainingText = streamingText.slice(lastPos)
                if (remainingText) {
                  elements.push(
                    <div key="text-final" className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {remainingText}
                    </div>
                  )
                }
              }

              // Show cursor if still no text
              if (elements.length === 0) {
                elements.push(
                  <span key="cursor" className="inline-block w-2 h-4 bg-zinc-400 animate-pulse" />
                )
              }

              return elements
            })()}
          </div>
        ) : hasContentBlocks ? (
          // Render interleaved content blocks
          renderContentBlocks(message.contentBlocks!)
        ) : (
          // Simple text content
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
          </div>
        )}

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
