# Vision Auto v2 Development Guide

## Project Overview
Vision Auto는 Android 디바이스 자동화를 위한 데스크톱 애플리케이션입니다.
이미지 매칭 기반의 매크로 시스템을 제공하며, 클린 아키텍처와 모듈화를 통해 유지보수성과 확장성을 확보했습니다.

## Development Rules

### 1. Code Style
- **No Emoji**: 코드, 주석, 커밋 메시지에 이모지 사용 금지
- **Clean Code**: 명확한 변수명, 작은 함수, 단일 책임 원칙
- **Comments**: 영어로 작성, Why를 설명 (What이 아닌)
- **Consistency**: 기존 패턴과 스타일 일관성 유지

### 2. Architecture Principles
```
src/
├── main/           # Electron Main Process
│   ├── services/   # Business Logic (Pure)
│   └── ipc/        # IPC Communication Layer
├── renderer/       # UI Layer
│   ├── components/ # UI Components (Isolated)
│   └── stores/     # State Management
└── shared/         # Shared Types & Constants
```

- **Layer Separation**: 각 계층은 명확한 책임과 인터페이스를 가짐
- **Dependency Injection**: 서비스 간 느슨한 결합
- **No Direct DOM**: 컴포넌트는 DOM 직접 조작 금지
- **Event-Driven**: 컴포넌트 간 이벤트 기반 통신

### 3. State Management
```javascript
// Store Pattern
class Store {
  constructor(initialState) {
    this._state = initialState
    this._listeners = new Set()
  }

  setState(updates) {
    this._state = { ...this._state, ...updates }
    this._notify()
  }

  subscribe(listener) {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }
}
```

- **Immutable State**: 상태 직접 수정 금지
- **Single Source of Truth**: 각 도메인별 하나의 스토어
- **Reactive Updates**: 상태 변경 시 자동 UI 업데이트

### 4. Error Handling
```javascript
// Error Handling Pattern
try {
  const result = await operation()
  return { success: true, data: result }
} catch (error) {
  logger.error('Operation failed', { error, context })
  return { success: false, error: error.message }
}
```

- **No Silent Failures**: 모든 에러는 로깅
- **User-Friendly Messages**: 사용자에게는 이해하기 쉬운 메시지
- **Recovery Strategy**: 가능한 경우 복구 시도

### 5. Testing Strategy
- **Unit Tests**: 비즈니스 로직 (services/)
- **Integration Tests**: IPC 통신
- **E2E Tests**: 주요 사용자 시나리오
- **Test Coverage**: 최소 80% 목표

## Development Workflow

### Phase 0: Foundation ✅
- [x] Project structure
- [x] Design system
- [x] State management (ActionStore, MacroStore, DeviceStore, ScreenStore)
- [x] IPC layer (preload.js, main services)

### Phase 1: Core Features ✅
- [x] Device connection (ADB protocol, device.service.js)
- [x] Screen capture/streaming (screen.service.js)
- [x] Basic actions (tap, swipe, input - action.service.js)
- [x] Macro save/load (macro.service.js, ScenarioManager)

### Phase 2: Enhanced Features (In Progress)
- [x] Smart Wait system (wait action with conditions)
- [x] Conditional branching (if/else, loop actions)
- [ ] Error recovery
- [x] Debug mode (LoggerService)

### Phase 3: Advanced Features
- [ ] Plugin system
- [ ] Cloud sync
- [ ] Multi-device support
- [ ] AI assistance

## Current Focus
**Phase 2 - Code Quality & Testing**
- Removing inline event handlers (XSS prevention)
- Improving test coverage for core modules
- Cleaning up legacy code patterns

## Key Files Structure

### Constants & Types
- `/src/shared/constants.js` - IPC channels, action types, states
- `/src/shared/types.js` - JSDoc type definitions

### Main Process
- `/src/main/index.js` - Electron main entry
- `/src/main/preload.js` - IPC bridge
- `/src/main/services/` - Business logic services
- `/src/main/ipc-handlers/` - IPC request handlers

### Renderer Process
- `/src/renderer/index.html` - Main HTML
- `/src/renderer/app.js` - Application entry
- `/src/renderer/stores/` - State management
- `/src/renderer/components/` - UI components

### Styles
- `/src/renderer/styles/base.css` - Design tokens, reset
- `/src/renderer/styles/components.css` - UI components
- `/src/renderer/styles/layout.css` - Layout system

## Design System

### Colors
- Primary: `#2563eb` (Blue)
- Secondary: `#64748b` (Gray)
- Success: `#16a34a` (Green)
- Warning: `#ca8a04` (Yellow)
- Error: `#dc2626` (Red)

### Typography
- Font: Inter, system-ui
- Sizes: 12px, 14px, 16px, 18px, 20px, 24px
- Weights: 400, 500, 600, 700

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 48px

### Components
- Buttons: Primary, Secondary, Ghost, Danger
- Inputs: Text, Select, Checkbox, Radio
- Feedback: Alert, Modal, Toast, Spinner
- Layout: Card, Panel, Grid, Flex

## IPC Communication

### Naming Convention
```javascript
// Format: domain:action[:sub-action]
DEVICE_LIST = 'device:list'
MACRO_RUN = 'macro:run'
SCREEN_STREAM_START = 'screen:stream:start'
```

### Request/Response Pattern
```javascript
// Renderer
const devices = await visionAuto.device.list()

// Main
ipcMain.handle('device:list', async () => {
  return await deviceService.getDevices()
})
```

### Event Pattern
```javascript
// Main -> Renderer
mainWindow.webContents.send('device:status', status)

// Renderer
visionAuto.device.onStatus((status) => {
  updateUI(status)
})
```

## Service Architecture

### Service Template
```javascript
class Service {
  constructor() {
    this._initialized = false
  }

  async init() {
    // Initialize service
    this._initialized = true
  }

  async cleanup() {
    // Cleanup resources
    this._initialized = false
  }

  _validateState() {
    if (!this._initialized) {
      throw new Error('Service not initialized')
    }
  }
}
```

### Service Dependencies
```
DeviceService (base)
  ├── ScreenService (depends on device)
  ├── ActionService (depends on device)
  └── MacroService (depends on action)
```

## Debug Mode

### Development Features
- Component boundaries visualization
- State change logging
- Performance profiling
- Network request inspection
- Image matching visualization

### Production Build
- Debug code removed
- Console logs disabled
- Source maps excluded
- Code minified

## Performance Guidelines

### Optimization Rules
1. **Virtual scrolling** for long lists
2. **Debounce** user inputs (300ms)
3. **Throttle** scroll/resize events (16ms)
4. **Lazy load** heavy components
5. **Cache** computed values

### Memory Management
- Clear unused references
- Dispose event listeners
- Limit history/undo stack
- Use WeakMap for object metadata

## Security Guidelines

### IPC Security
- Validate all IPC inputs
- Use contextBridge (no nodeIntegration)
- Whitelist allowed channels
- Sanitize user inputs

### File System
- Validate file paths
- Prevent directory traversal
- Use app.getPath() for directories
- Limit file size uploads

## Git Workflow

### Commit Policy
**IMPORTANT: Commit frequently and consistently**
- Commit after every meaningful change or feature completion
- Commit after completing each design phase
- Commit after fixing bugs or refactoring
- Commit before starting a new major feature
- Use clear, descriptive commit messages
- Never accumulate too many changes without committing

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code improvements
- `docs/description` - Documentation

### Commit Messages
```
type: Short description

Longer explanation if needed.
- Bullet points for details
- Reference issue numbers

Fixes #123
```

Types: feat, fix, docs, style, refactor, test, chore

### Commit Frequency Examples
- After adding a new action type → Commit
- After completing UI redesign → Commit
- After fixing a bug → Commit
- After adding documentation → Commit
- After refactoring code → Commit

## Resources

### Documentation
- [Electron Documentation](https://www.electronjs.org/docs)
- [ADB Documentation](https://developer.android.com/studio/command-line/adb)
- [OpenCV.js Guide](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html)

### Tools
- Chrome DevTools for debugging
- Electron Fiddle for testing
- Postman for API testing

## Notes for Claude

When continuing development:
1. Always check TODO list first
2. Follow the established patterns
3. Update this document when adding new patterns
4. Test each component in isolation
5. Commit frequently with clear messages

Current working directory: `/Users/groro/Workspace/vision-auto`
Main entry: `src/main/index.js`
Start command: `npm start`