# Arcadia

## Current Functionality

> **Keep this section updated as features are added or changed.**

Electron desktop app for spawning and managing Claude Code terminal instances.

- Folder picker: Native OS file dialog to select working directory
- Terminal spawning: Opens CMD window running `claude` in the selected directory

## Architecture

Standard Electron app with React frontend:

```
arcadia/
├── electron/          # Electron main process + preload
│   ├── main.ts        # Main process - spawns terminals, native dialogs
│   └── preload.ts     # IPC bridge to renderer
├── src/               # React + Vite + TypeScript
│   ├── App.tsx        # Main React component
│   ├── main.tsx       # React entry point
│   ├── globals.css    # Global styles (Tailwind)
│   └── electron.d.ts  # TypeScript types for Electron IPC
├── dist-electron/     # Compiled Electron files (generated)
└── dist/              # Built React app (generated)
```

**Run:** `pnpm dev` from root

## Styling

Using **Tailwind CSS v4** with the Vite plugin (`@tailwindcss/vite`).

For any questions about Tailwind v4 syntax or features, use Context7 to fetch up-to-date documentation.

## Electron IPC

Communication between renderer (React) and main process uses IPC:

```typescript
// In React (renderer):
window.electron.pickFolder()
window.electron.spawnTerminal(cwd)

// Handlers defined in electron/main.ts
```

## Testing Electron

Playwright has experimental Electron support. For MCP-based automation, use:
- `@robertn702/playwright-mcp-electron` - enhanced MCP server for Electron

## Node.js Version

Requires Node.js 22.x or later (using v24.13.0).

## Package Manager

Using **pnpm**. Do not use npm or yarn.

```bash
pnpm install    # Install dependencies
pnpm dev        # Run in development
pnpm build      # Build for production
```

## Before Starting Dev

Before running `pnpm dev`, check if the app is already running to avoid conflicts.
