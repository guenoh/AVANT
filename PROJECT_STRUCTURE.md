# Vision Auto v2 - Project Structure

## Overview
Clean architecture with unified UI layout for Android device automation.

## Directory Structure

```
vision-auto/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── main.js             # Application entry point
│   │   ├── index.js            # Service initialization
│   │   ├── services/           # Business logic (pure)
│   │   │   ├── device.service.js
│   │   │   ├── screen.service.js
│   │   │   ├── action.service.js
│   │   │   ├── macro.service.js
│   │   │   ├── settings.service.js
│   │   │   └── logger.service.js
│   │   └── ipc-handlers/       # IPC communication layer
│   │       ├── index.js
│   │       ├── device.handlers.js
│   │       ├── screen.handlers.js
│   │       ├── action.handlers.js
│   │       ├── macro.handlers.js
│   │       └── system.handlers.js
│   │
│   ├── renderer/               # UI Layer
│   │   ├── index.html         # Unified layout HTML
│   │   ├── unified-app.js     # Main application logic
│   │   ├── preload.js         # IPC bridge (secure)
│   │   └── styles/
│   │       ├── base.css       # Design system & reset
│   │       ├── components.css # Reusable UI components
│   │       └── unified-layout.css # Unified grid layout
│   │
│   └── shared/                # Shared code
│       ├── constants.js       # IPC channels, action types
│       └── types.js          # JSDoc type definitions
│
├── package.json
├── CLAUDE.md                 # Development guidelines
└── PROJECT_STRUCTURE.md      # This file
```

## Key Files

### Main Process
- `main.js`: Electron app initialization, window creation, CSP setup
- `index.js`: Service initialization and lifecycle management
- `services/*.service.js`: Pure business logic, no IPC
- `ipc-handlers/*.handlers.js`: IPC request handlers

### Renderer Process
- `index.html`: Single-page unified layout with grid system
- `unified-app.js`: Application state and UI logic
- `preload.js`: Secure IPC bridge using contextBridge
- `styles/`: Modular CSS (base, components, layout)

### Shared
- `constants.js`: IPC channel names, action types, states
- `types.js`: JSDoc type definitions for better IDE support

## Architecture Principles

### Layer Separation
- **Main Process**: Services (business logic) + IPC handlers (communication)
- **Renderer Process**: UI components + state management
- **Shared**: Types and constants only

### Communication Flow
```
Renderer (UI) 
  ↓ preload.js (contextBridge)
  ↓ IPC (invoke/on)
  ↓ IPC Handlers
  ↓ Services (business logic)
  ↓ ADB/System APIs
```

### State Management
- Single source of truth per domain
- Reactive updates via event listeners
- Immutable state patterns

## Unified Layout

### Grid System
```
┌─────────────────────────────────────────────────────┐
│                    Header (48px)                     │
├──────────┬─────────────────────┬────────────────────┤
│ Device   │                     │ Settings           │
│ (300px)  │                     │ (350px)            │
├──────────┤  Screen Mirroring   ├────────────────────┤
│          │     (Center)        │ Macro & Actions    │
│          │                     │                    │
│          │                     │                    │
├──────────┴─────────────────────┴────────────────────┤
│              Logs (200px)                           │
└─────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
- 1400px: Slightly reduced panel widths
- 1200px: Compact layout, 2-column action buttons

## Development

### Running the App
```bash
npm run dev    # Development mode with DevTools
npm start      # Production mode
```

### Code Style
- No emojis in code/comments
- Clean code principles
- English comments (explain WHY, not WHAT)
- Consistent with existing patterns

### File Naming
- Services: `*.service.js`
- Handlers: `*.handlers.js`
- Stores: `*.store.js` (deprecated, removed)
- Styles: kebab-case (e.g., `unified-layout.css`)

## Removed Files

The following files were removed during cleanup:
- `src/renderer/renderer.js` - Replaced by `unified-app.js`
- `src/renderer/index-old.html` - Old multi-page layout
- `src/renderer/index-unified.html` - Merged into `index.html`
- `src/renderer/stores/` - State management simplified
- `src/renderer/styles/layout.css` - Merged into `unified-layout.css`
- `src/main/preload.js` - Duplicate of `renderer/preload.js`

## Next Steps

See `CLAUDE.md` for:
- Current development phase
- Coding guidelines
- Architecture details
- Task list
