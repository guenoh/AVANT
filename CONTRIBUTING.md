# Contributing to Vision Auto

Vision Auto 프로젝트에 기여해 주셔서 감사합니다!

## Development Setup

### Prerequisites

- Node.js 16+
- ADB (Android Debug Bridge)
- Git

### Installation

```bash
git clone https://github.com/your-username/vision-auto.git
cd vision-auto
npm install
npm start
```

## Code Style

### General Rules

- **No Emoji**: 코드, 주석, 커밋 메시지에 이모지 사용 금지
- **Clean Code**: 명확한 변수명, 작은 함수, 단일 책임 원칙
- **Comments**: 영어로 작성, Why를 설명 (What이 아닌)
- **Consistency**: 기존 패턴과 스타일 일관성 유지

### JavaScript

```javascript
// Good
const deviceList = await getConnectedDevices();
if (deviceList.length === 0) {
    throw new Error('No devices connected');
}

// Bad
const dl = await getDevices(); // unclear name
if(!dl.length) throw new Error('err'); // unclear error
```

### File Organization

```
src/
├── main/           # Electron Main Process
│   ├── services/   # Business Logic (Pure)
│   └── ipc/        # IPC Communication Layer
├── renderer/       # UI Layer
│   ├── components/ # UI Components
│   ├── services/   # Frontend Services
│   └── views/      # View Controllers
└── shared/         # Shared Types & Constants
```

## Architecture Principles

### Layer Separation

- **Main Process**: 비즈니스 로직, ADB 통신, 파일 시스템
- **Renderer Process**: UI 렌더링, 사용자 입력 처리
- **IPC Bridge**: Main과 Renderer 간 통신

### State Management

```javascript
// Store Pattern
class Store {
    constructor(initialState) {
        this._state = initialState;
        this._listeners = new Set();
    }

    setState(updates) {
        this._state = { ...this._state, ...updates };
        this._notify();
    }

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }
}
```

### Error Handling

```javascript
// Always handle errors explicitly
try {
    const result = await operation();
    return { success: true, data: result };
} catch (error) {
    console.error('Operation failed', { error, context });
    return { success: false, error: error.message };
}
```

## Git Workflow

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

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Examples

```bash
# Good
git commit -m "feat: Add text input action with ADB Keyboard"
git commit -m "fix: Resolve wait action not respecting duration"

# Bad
git commit -m "update" # too vague
git commit -m "Fixed stuff" # unclear
```

## Pull Request Process

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test your changes locally
5. Commit with clear messages
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] No console.log or debug code left
- [ ] Self-reviewed the code
- [ ] Tested locally with a real device
- [ ] Updated documentation if needed

## Testing

### Manual Testing

1. Connect an Android device via USB
2. Run `npm start`
3. Test your changes with the actual device

### Test Coverage

- Unit tests for services (`npm test`)
- E2E tests for critical paths (`npm run test:e2e`)

## Security

### IPC Security

- Validate all IPC inputs
- Use contextBridge (no nodeIntegration)
- Whitelist allowed channels
- Sanitize user inputs

### File System

- Validate file paths
- Prevent directory traversal
- Use app.getPath() for directories

## Questions?

If you have questions, please open an issue or contact the maintainers.
