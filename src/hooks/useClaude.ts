import { useState, useCallback, useEffect, useRef } from 'react'
import type { ClaudeSpawnOptions, ClaudeResponse } from '../electron.d'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
  toolCalls?: string[]
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

  const optionsRef = useRef(options)
  optionsRef.current = options

  // Track active process ID in a ref to avoid race conditions
  const activeProcessRef = useRef<string | null>(null)

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

    return () => {
      cleanupStreamText()
      cleanupStreamEnd()
      cleanupStderr()
    }
  }, []) // Empty deps - set up once

  // Finalize streaming message when streaming ends
  useEffect(() => {
    if (!isStreaming && streamingText && activeProcessId) {
      setMessages((prev) => {
        // Find and update the streaming message
        const updated = prev.map((msg) => {
          if (msg.isStreaming) {
            return {
              ...msg,
              content: streamingText,
              isStreaming: false,
            }
          }
          return msg
        })
        return updated
      })
      setStreamingText('')
      setActiveProcessId(null)
    }
  }, [isStreaming, streamingText, activeProcessId])

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
    sendMessage,
    sendMessageStreaming,
    cancel,
    clearSession,
    clearError,
  }
}
