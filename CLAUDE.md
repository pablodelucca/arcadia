# Arcadia

## Current Functionality

> **Keep this section updated as features are added or changed.**

Electron desktop app providing a full GUI for Claude Code CLI.

**Core Features:**
- Chat interface with Claude Code (JSON and streaming modes)
- Session management (persist, resume, fork conversations)
- Real-time streaming responses with text deltas
- Token usage tracking (input/output/total)
- Model selection (Sonnet, Opus, Haiku)
- Permission mode selection (Ask, Accept Edits, Accept All, Plan)
- MCP server management via CLI
- Working directory picker with native OS dialog
- Legacy: spawn external terminal with `claude`

## Architecture

```
arcadia/
├── electron/
│   ├── main.ts              # IPC handlers for Claude CLI subprocess
│   └── preload.ts           # Context bridge with typed event listeners
├── src/
│   ├── App.tsx              # Main app layout (Sidebar + ChatInterface)
│   ├── electron.d.ts        # TypeScript types for all IPC APIs
│   ├── hooks/
│   │   └── useClaude.ts     # React hook: messages, streaming, sessions
│   └── components/
│       ├── ChatInterface.tsx  # Chat area with messages and input
│       ├── ChatMessage.tsx    # Message bubble (supports streaming)
│       ├── ChatInput.tsx      # Multi-line input with keyboard shortcuts
│       └── Sidebar.tsx        # Settings, session info, token usage
└── .claude/skills/claude-code-reference/  # CLI documentation for reference
```

## How Claude Integration Works

```
User Input → useClaude hook → IPC invoke → main.ts → spawn('claude', [...args])
                                                            ↓
UI Update ← Hook State ← IPC Events ← stdout parsing ← claude -p --output-format json
```

**Key IPC Channels:**
- `claude:spawn` - Run Claude with JSON output, returns full response
- `claude:stream` - Run Claude with stream-json, emits events via `claude:stream-text`
- `claude:cancel` - Kill running Claude process
- `claude:continue` - Continue most recent conversation (`-c` flag)
- `claude:mcp-list/add/remove` - MCP server management

**Claude CLI Flags Used:**
- `-p "prompt"` - Non-interactive print mode
- `--output-format json|stream-json` - Structured output
- `--resume SESSION_ID` - Continue specific session
- `--allowedTools "Read,Edit,..."` - Auto-approve tools
- `--permission-mode` - Control permission prompts
- `--model sonnet|opus|haiku` - Model selection
- `--verbose --include-partial-messages` - For streaming

## Important Implementation Details

**Shell Escaping (Windows):**
- All spawn calls use `shell: true` to find `claude.cmd` on Windows
- Arguments with spaces (prompt, systemPrompt) MUST be escaped with `shellEscape()`
- `shellEscape()` wraps in double quotes and escapes internal quotes: `"${arg.replace(/"/g, '""')}"`

**Streaming Race Condition Fix:**
- `claude:stream` returns `{ processId, sessionId: null }` IMMEDIATELY (not on close)
- `useClaude.ts` uses `activeProcessRef` (useRef) to track processId for event filtering
- This ensures stream events are captured even though they arrive before state updates

**Response Parsing:**
- Claude CLI returns `result` as a STRING directly, not `{ content: [...] }`
- Always check: `typeof response.result === 'string'` before parsing

**Current Limitations:**
- Token usage only tracked in non-streaming mode (streaming doesn't parse usage stats yet)

## Key Files to Modify

| Task | File(s) |
|------|---------|
| Add new Claude CLI flag | `electron/main.ts` (spawn args), `src/electron.d.ts` (types) |
| Add UI setting | `src/components/Sidebar.tsx`, `src/App.tsx` (state) |
| Change chat behavior | `src/hooks/useClaude.ts` |
| Add new IPC handler | `electron/main.ts`, `electron/preload.ts`, `src/electron.d.ts` |

## Styling

**Tailwind CSS v4** with Vite plugin. Dark theme (zinc-900/950 background, indigo accents).

For Tailwind v4 syntax questions, use Context7 skill.

## Commands

```bash
pnpm dev      # Run development (Electron + Vite HMR)
pnpm build    # Build for production
```

## Requirements

- **Node.js 22+** (using v24.13.0)
- **pnpm** (not npm/yarn)
- **Claude Code CLI** installed globally (`npm i -g @anthropic-ai/claude-code`)

## Reference Documentation

See `.claude/skills/claude-code-reference/SKILL.md` for comprehensive Claude Code CLI documentation including all flags, output formats, hooks, MCP, and session management.
