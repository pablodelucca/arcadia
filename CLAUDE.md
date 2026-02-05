# Arcadia

## Current Functionality

> **Keep this section updated as features are added or changed.**

The app has a single button that spawns a new CMD terminal window running `claude` (Claude Code CLI).

- Frontend: Button labeled "Spawn Claude Terminal" that calls `POST /terminals/spawn`
- Backend: `TerminalsModule` with endpoint that uses `child_process.spawn` to open a detached CMD window

## Architecture

Monorepo structure using npm workspaces:

```
packages/
├── client/   # React + Vite + TypeScript (@arcadia/client)
└── server/   # NestJS (@arcadia/server)
```

**Ports:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

**Run both:** `npm run dev` from root

## Styling

Using **Tailwind CSS v4** with the Vite plugin (`@tailwindcss/vite`).

For any questions about Tailwind v4 syntax or features, use Context7 to fetch up-to-date documentation.

## Port Conflicts

If a port is already in use, do NOT run on a different port. Instead:
1. Check what process is using the port
2. Report the PID and process name to the user
3. Ask if it can be killed
