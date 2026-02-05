import { useState, useCallback, useEffect, useRef } from 'react'
import type { ClaudeSpawnOptions, ClaudeResponse } from '../electron.d'

export interface ToolActivity {
  id: string
  toolName: string
  status: 'pending' | 'running' | 'completed' | 'error'
  input?: Record<string, unknown>
  output?: string
  startTime: Date
  endTime?: Date
  textPosition?: number // Position in streaming text where this tool was inserted
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool'; activity: ToolActivity }

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string // Keep for backward compat and simple messages
  contentBlocks?: ContentBlock[] // For interleaved content
  timestamp: Date
  isStreaming?: boolean
}

export interface UsageStats {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface UseClaudeOptions {
  cwd: string
  allowedTools?: string[]
  disallowedTools?: string[]
  permissionMode?: ClaudeSpawnOptions['permissionMode']
  model?: string
  maxTurns?: number
  systemPrompt?: string
  appendSystemPrompt?: string
}

export interface UseClaudeReturn {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  sessionId: string | null
  usage: UsageStats
  streamingText: string
  activeProcessId: string | null
  toolActivities: ToolActivity[]
  sendMessage: (prompt: string) => Promise<void>
  sendMessageStreaming: (prompt: string) => Promise<void>
  cancel: () => Promise<void>
  clearSession: () => void
  clearError: () => void
}

export function useClaude(options: UseClaudeOptions): UseClaudeReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [usage, setUsage] = useState<UsageStats>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  })
  const [streamingText, setStreamingText] = useState('')
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null)
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([])

  const optionsRef = useRef(options)
  optionsRef.current = options

  // Track active process ID in a ref to avoid race conditions
  const activeProcessRef = useRef<string | null>(null)

  // Track tool activities by their block index for updating
  const toolBlocksRef = useRef<Map<number, string>>(new Map())

  // Track content blocks for interleaved rendering
  const contentBlocksRef = useRef<ContentBlock[]>([])
  const lastTextPositionRef = useRef<number>(0) // Position in streamingText when last tool started

  // Track seen tool IDs to prevent duplicates (ref for immediate access)
  const seenToolIdsRef = useRef<Set<string>>(new Set())

  // Set up event listeners once on mount
  useEffect(() => {
    // Guard for non-Electron environments
    if (!window.electron?.claude) return

    const cleanupStreamText = window.electron.claude.onStreamText(({ processId, text }) => {
      // Use ref for immediate access without waiting for state update
      if (activeProcessRef.current && processId === activeProcessRef.current) {
        setStreamingText((prev) => prev + text)
      }
    })

    const cleanupStreamEnd = window.electron.claude.onStreamEnd(
      ({ processId, sessionId: newSessionId }) => {
        if (activeProcessRef.current && processId === activeProcessRef.current) {
          if (newSessionId) {
            setSessionId(newSessionId)
          }
          setIsStreaming(false)
          setIsLoading(false)
          activeProcessRef.current = null
        }
      }
    )

    const cleanupStderr = window.electron.claude.onStderr(({ processId, data }) => {
      if (activeProcessRef.current && processId === activeProcessRef.current) {
        console.warn('Claude stderr:', data)
      }
    })

    // Parse stream events for tool activity tracking
    const cleanupStreamEvent = window.electron.claude.onStreamEvent(({ processId, event }) => {
      if (activeProcessRef.current && processId !== activeProcessRef.current) return

      const evt = event as Record<string, unknown>

      // Uncomment for debugging stream events:
      // console.log('[Stream Event]', evt.type, evt.subtype || '', evt)

      // Handle different event types from Claude CLI stream-json output
      // The format varies, so we check multiple possible structures

      // Handle assistant/turn events that contain tool info
      // Note: We skip content_block events since assistant events give us complete tool info
      if (evt.type === 'assistant' && evt.message) {
        const message = evt.message as Record<string, unknown>
        const content = message.content as Array<Record<string, unknown>> | undefined
        if (content) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              const toolId = (block.id as string) || `tool-${Date.now()}`
              const toolName = (block.name as string) || 'Unknown Tool'

              // Check if we already have this tool using ref for immediate duplicate detection
              if (seenToolIdsRef.current.has(toolId)) continue

              // Mark as seen immediately (before async state update)
              seenToolIdsRef.current.add(toolId)

              setToolActivities(prev => {
                // Double-check in state as well
                if (prev.some(t => t.id === toolId)) return prev

                // We need to capture the current streaming text length for positioning
                // Use a synchronous approach by reading from a shared ref
                let textPosition = 0

                const newTool: ToolActivity = {
                  id: toolId,
                  toolName,
                  status: 'running',
                  input: block.input as Record<string, unknown> | undefined,
                  startTime: new Date(),
                  textPosition: 0, // Will be updated below
                }

                // Only add to contentBlocks if not already there
                const alreadyInBlocks = contentBlocksRef.current.some(
                  b => b.type === 'tool' && b.activity.id === toolId
                )
                if (!alreadyInBlocks) {
                  // Capture any text that came before this tool
                  setStreamingText(currentText => {
                    textPosition = currentText.length
                    newTool.textPosition = textPosition

                    const textSinceLastTool = currentText.slice(lastTextPositionRef.current)
                    if (textSinceLastTool.trim()) {
                      contentBlocksRef.current.push({ type: 'text', text: textSinceLastTool })
                    }
                    // Add the tool block
                    contentBlocksRef.current.push({ type: 'tool', activity: newTool })
                    lastTextPositionRef.current = currentText.length
                    return currentText
                  })
                }

                return [...prev, newTool]
              })
            }
          }
        }
      }

      // Handle tool results from 'user' events (tool_result in message.content)
      if (evt.type === 'user' && evt.message) {
        const message = evt.message as Record<string, unknown>
        const content = message.content as Array<Record<string, unknown>> | undefined
        if (content) {
          for (const block of content) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              const toolUseId = block.tool_use_id as string
              setToolActivities(prev => prev.map(t =>
                t.id === toolUseId
                  ? { ...t, status: 'completed' as const, endTime: new Date() }
                  : t
              ))
            }
          }
        }
      }

      // Handle final result - mark any remaining tools as complete
      if (evt.type === 'result' && evt.subtype === 'success') {
        setToolActivities(prev => prev.map(t =>
          t.status === 'running' || t.status === 'pending'
            ? { ...t, status: 'completed', endTime: new Date() }
            : t
        ))
      }
    })

    return () => {
      cleanupStreamText()
      cleanupStreamEnd()
      cleanupStderr()
      cleanupStreamEvent()
    }
  }, []) // Empty deps - set up once

  // Finalize streaming message when streaming ends
  useEffect(() => {
    if (!isStreaming && streamingText && activeProcessId) {
      // Capture any remaining text after the last tool
      const remainingText = streamingText.slice(lastTextPositionRef.current)
      if (remainingText.trim()) {
        contentBlocksRef.current.push({ type: 'text', text: remainingText })
      }

      // Deduplicate tool blocks by ID
      const seenToolIds = new Set<string>()
      const deduplicatedBlocks = contentBlocksRef.current.filter(block => {
        if (block.type === 'tool') {
          if (seenToolIds.has(block.activity.id)) {
            return false
          }
          seenToolIds.add(block.activity.id)
        }
        return true
      })

      // Update tool activities in content blocks with their final state
      const finalToolActivities = toolActivities
      const finalContentBlocks = deduplicatedBlocks.map(block => {
        if (block.type === 'tool') {
          const updatedActivity = finalToolActivities.find(t => t.id === block.activity.id)
          if (updatedActivity) {
            return { type: 'tool' as const, activity: updatedActivity }
          }
        }
        return block
      })

      setMessages((prev) => {
        // Find and update the streaming message
        const updated = prev.map((msg) => {
          if (msg.isStreaming) {
            return {
              ...msg,
              content: streamingText,
              contentBlocks: finalContentBlocks.length > 0 ? finalContentBlocks : undefined,
              isStreaming: false,
            }
          }
          return msg
        })
        return updated
      })
      setStreamingText('')
      setActiveProcessId(null)
      contentBlocksRef.current = []
      lastTextPositionRef.current = 0
    }
  }, [isStreaming, streamingText, activeProcessId, toolActivities])

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const sendMessage = useCallback(async (prompt: string) => {
    const opts = optionsRef.current

    if (!opts.cwd) {
      setError('Please select a working directory first')
      return
    }

    setIsLoading(true)
    setError(null)

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const response: ClaudeResponse = await window.electron.claude.spawn({
        prompt,
        cwd: opts.cwd,
        sessionId: sessionId || undefined,
        allowedTools: opts.allowedTools,
        disallowedTools: opts.disallowedTools,
        permissionMode: opts.permissionMode,
        model: opts.model,
        maxTurns: opts.maxTurns,
        systemPrompt: opts.systemPrompt,
        appendSystemPrompt: opts.appendSystemPrompt,
      })

      // Update session ID
      setSessionId(response.session_id)

      // Extract text from response
      // Claude CLI returns result as a string directly, not as content array
      const text = typeof response.result === 'string'
        ? response.result
        : response.result?.content
          ?.filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text)
          .join('\n') || ''

      // Add assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: text || 'No response received',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Update usage
      setUsage((prev) => ({
        inputTokens: prev.inputTokens + response.usage.input_tokens,
        outputTokens: prev.outputTokens + response.usage.output_tokens,
        totalTokens:
          prev.totalTokens + response.usage.input_tokens + response.usage.output_tokens,
      }))
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : (e as { error?: string })?.error || 'Unknown error'
      setError(errorMsg)

      // Add error as system message
      const errorMessage: Message = {
        id: generateId(),
        role: 'system',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const sendMessageStreaming = useCallback(async (prompt: string) => {
    const opts = optionsRef.current

    if (!opts.cwd) {
      setError('Please select a working directory first')
      return
    }

    setIsLoading(true)
    setIsStreaming(true)
    setError(null)
    setStreamingText('')
    setToolActivities([])
    toolBlocksRef.current.clear()
    contentBlocksRef.current = []
    lastTextPositionRef.current = 0
    seenToolIdsRef.current.clear()

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }

    // Add placeholder for streaming assistant message
    const streamingMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMessage, streamingMessage])

    try {
      const { processId } = await window.electron.claude.stream({
        prompt,
        cwd: opts.cwd,
        sessionId: sessionId || undefined,
        allowedTools: opts.allowedTools,
        permissionMode: opts.permissionMode,
        model: opts.model,
      })

      // Set ref immediately so event listeners can filter by processId
      activeProcessRef.current = processId
      setActiveProcessId(processId)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : (e as { error?: string })?.error || 'Unknown error'
      setError(errorMsg)
      setIsLoading(false)
      setIsStreaming(false)

      // Remove the streaming placeholder and add error
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isStreaming)
        return [
          ...filtered,
          {
            id: generateId(),
            role: 'system' as const,
            content: `Error: ${errorMsg}`,
            timestamp: new Date(),
          },
        ]
      })
    }
  }, [sessionId])

  const cancel = useCallback(async () => {
    if (activeProcessId) {
      await window.electron.claude.cancel(activeProcessId)
      setIsLoading(false)
      setIsStreaming(false)

      // Update the streaming message with what we have so far
      if (streamingText) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.isStreaming) {
              return {
                ...msg,
                content: streamingText + '\n\n[Cancelled]',
                isStreaming: false,
              }
            }
            return msg
          })
        )
      }

      setStreamingText('')
      setActiveProcessId(null)
    }
  }, [activeProcessId, streamingText])

  const clearSession = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })
    setError(null)
    setStreamingText('')
    setActiveProcessId(null)
    setToolActivities([])
    toolBlocksRef.current.clear()
    seenToolIdsRef.current.clear()
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    sessionId,
    usage,
    streamingText,
    activeProcessId,
    toolActivities,
    sendMessage,
    sendMessageStreaming,
    cancel,
    clearSession,
    clearError,
  }
}
