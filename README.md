<div align="center">

# Vision Auto v2

**Android Device Automation with Image Matching**

A powerful desktop application for automating Android devices through image recognition and ADB integration.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Architecture](#architecture) • [Troubleshooting](#troubleshooting)

---

</div>

## Overview

Vision Auto v2는 Electron과 ADB를 활용한 Android 디바이스 자동화 도구입니다. 실시간 화면 미러링, 이미지 매칭, 조건부 로직을 통해 복잡한 자동화 시나리오를 구현할 수 있습니다.

### Key Highlights

- **Real-time Screen Mirroring**: USB/Wireless ADB 연결로 디바이스 화면 실시간 표시
- **Image-based Automation**: 드래그로 영역 선택하여 이미지 매칭 기반 자동화
- **Conditional Logic**: IF/ELSEIF/ELSE 조건문으로 복잡한 시나리오 구현
- **ADB Integration**: 디바이스 스크린샷 캡처 및 Logcat 수집
- **Macro Management**: JSON 기반 매크로 저장/로드/내보내기
- **Visual Feedback**: 실행 중 액션 추적 및 로그 표시

---

## Features

### Core Functionality

#### 1. Device Control
- USB 및 무선 ADB 연결 지원
- 디바이스 자동 감지 및 연결
- 실시간 화면 스트리밍
- 탭, 스와이프, 텍스트 입력, 하드웨어 키 지원

#### 2. Image Matching
- 드래그로 화면 영역 선택 및 템플릿 저장
- Pure JavaScript 이미지 매칭 알고리즘
- 조정 가능한 매칭 임계값 (0.0 ~ 1.0)
- 매칭 결과 시각적 표시

#### 3. Macro System
- **상호작용 액션**: 탭, 스와이프, 텍스트 입력
- **제어 액션**: 딜레이, 하드웨어 키
- **스마트 액션**: 이미지 매칭, 조건문 (IF/ELSEIF/ELSE/ENDIF)
- **ADB 액션**: 디바이스 스크린샷, Logcat 저장
- 액션 추가/삭제/수정/재정렬
- 실행 중 액션 추적 표시

#### 4. Advanced Features
- **Conditional Execution**: IF/ELSEIF/ELSE로 분기 처리
- **Last Match Tap**: 마지막 매칭 위치에 자동 탭
- **Tracking Overlay**: 실행 중 현재 액션 시각적 표시
- **Macro Export/Import**: JSON 파일로 매크로 공유

---

## Installation

### Prerequisites

#### 1. ADB (Android Debug Bridge)

**macOS**
```bash
brew install android-platform-tools
```

**Windows**
1. [Android SDK Platform Tools](https://developer.android.com/studio/releases/platform-tools) 다운로드
2. 압축 해제 후 환경변수 PATH에 추가

**Linux**
```bash
sudo apt-get install android-tools-adb
```

#### 2. Node.js
- Node.js 16 이상 필요
- [공식 다운로드](https://nodejs.org/)

#### 3. Android Device Setup
1. **개발자 옵션** 활성화
   - 설정 → 휴대전화 정보 → 빌드 번호 7번 탭
2. **USB 디버깅** 활성화
   - 설정 → 개발자 옵션 → USB 디버깅 ON
3. USB로 PC와 연결

### Install & Run

```bash
# Clone repository
git clone <repository-url>
cd vision-auto

# Install dependencies
npm install

# Run application
npm start

# Development mode (with DevTools)
npm run dev
```

---

## Usage

### Quick Start

#### 1. Connect Device
1. USB로 Android 디바이스 연결
2. 앱 좌측 상단에서 디바이스 자동 감지
3. 드롭다운에서 디바이스 선택

#### 2. Create Macro

**A. 상호작용 액션**
- 탭, 스와이프, 입력 버튼 클릭
- 좌표 및 파라미터 설정
- 액션 목록에 추가

**B. 이미지 매칭 액션**
1. "스마트" 탭 → "이미지 매칭" 클릭
2. 화면에서 영역 드래그
3. 매칭 임계값 설정 (권장: 0.8 ~ 0.95)
4. 액션 추가

**C. 조건문 사용**
```
IF (이미지 매칭)
  → 찾으면 이 액션들 실행
ELSEIF (다른 이미지 매칭)
  → 첫 번째 못 찾고 두 번째 찾으면 실행
ELSE
  → 둘 다 못 찾으면 실행
ENDIF
```

**D. ADB 액션**
- "ADB" 탭에서 "스크린샷 저장" 또는 "Logcat 저장"
- 실행 시 자동으로 디바이스에서 캡처하여 Documents 폴더에 저장

#### 3. Run Macro
1. 액션 목록 확인
2. **[실행]** 버튼 클릭
3. 실시간 로그 및 추적 표시 확인

#### 4. Save/Load Macro
- **저장**: [저장] → JSON 파일로 저장
- **불러오기**: [불러오기] → 저장된 매크로 선택
- **내보내기**: [내보내기] → 외부 공유용 JSON 생성

---

## Architecture

### Project Structure

```
vision-auto/
├── src/
│   ├── main/
│   │   ├── main.js                    # Electron entry point
│   │   ├── preload.js                 # IPC bridge
│   │   └── services/                  # Business logic
│   │       ├── device.service.js      # Device management
│   │       ├── screen.service.js      # Screen capture/streaming
│   │       ├── action.service.js      # Action execution
│   │       ├── macro.service.js       # Macro save/load
│   │       ├── settings.service.js    # Settings management
│   │       └── logger.service.js      # Logging system
│   ├── renderer/
│   │   ├── index.html                 # Main UI
│   │   ├── unified-app.js             # Application logic
│   │   ├── preload.js                 # Preload script
│   │   ├── js/
│   │   │   ├── image-matcher.js       # Image matching engine
│   │   │   └── tracking-overlay.js    # Visual tracking overlay
│   │   └── styles/
│   │       ├── base.css               # Design tokens, reset
│   │       ├── components.css         # UI components
│   │       └── unified-layout.css     # Layout system
│   └── shared/
│       └── constants.js               # IPC channels, constants
├── package.json
└── README.md
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop Framework | Electron 28+ |
| Runtime | Node.js 16+ |
| Device Control | ADB (Android Debug Bridge) |
| Image Processing | Jimp, Canvas API |
| IPC | Electron IPC (Main ↔ Renderer) |
| UI | Vanilla JavaScript, CSS3 |

### Design Principles

1. **Clean Architecture**: Services와 UI 계층 분리
2. **IPC Communication**: Main process에서 ADB 명령 실행, Renderer는 UI만 담당
3. **Event-Driven**: 실행 중 상태 변화를 이벤트로 전달
4. **Pure JavaScript**: 외부 의존성 최소화 (OpenCV 불필요)

---

## Image Matching Algorithm

Vision Auto는 순수 JavaScript로 구현된 템플릿 매칭 알고리즘을 사용합니다.

### How It Works

1. **템플릿 생성**: 사용자가 드래그한 영역을 PNG로 저장
2. **화면 캡처**: ADB로 현재 디바이스 화면 캡처
3. **매칭 수행**:
   - 화면 전체를 순회하며 템플릿과 비교
   - 픽셀 단위 RGB 차이 계산
   - 유사도 점수 산출 (0.0 ~ 1.0)
4. **임계값 비교**: 설정한 임계값 이상이면 매칭 성공
5. **좌표 반환**: 매칭된 위치 좌표 반환

### Performance Optimization

- **Stride Sampling**: 전체 픽셀 검사 대신 일정 간격으로 샘플링
- **Early Termination**: 임계값 미달 시 조기 종료
- **Region of Interest**: 필요 시 검색 영역 제한 가능

### Tips for Better Matching

- **임계값 조정**: 단순한 이미지는 높게 (0.95), 복잡한 이미지는 낮게 (0.8)
- **충분한 컨텍스트**: 너무 작은 영역보다는 주변 정보 포함
- **고유한 패턴**: 화면에서 유일하게 식별 가능한 영역 선택

---

## File Locations

### Macros
```
~/Documents/VisionAuto/macros/
└── {macroName}_{timestamp}.json
```

### Templates (Image Captures)
```
~/Documents/VisionAuto/templates/
└── template_{timestamp}.png
```

### ADB Captures
```
~/Documents/VisionAuto/adb-screenshots/
└── screenshot_{timestamp}.png

~/Documents/VisionAuto/adb-logcat/
└── logcat_{timestamp}.txt
```

### Logs
```
~/Documents/VisionAuto/logs/
└── vision-auto_{date}.log
```

---

## Troubleshooting

### ADB Issues

#### Device Not Detected
```bash
# Check ADB installation
adb version

# List connected devices
adb devices

# Restart ADB server
adb kill-server
adb start-server
```

#### Device Shows "Unauthorized"
1. Android 디바이스에서 "USB 디버깅 허용" 팝업 확인
2. "항상 허용" 체크 후 확인
3. 안 되면 다음 명령어 실행:
```bash
adb kill-server
rm ~/.android/adbkey*
adb start-server
```

### Screen Capture Issues

#### Black Screen or No Image
1. USB 케이블 재연결
2. 디바이스에서 USB 디버깅 OFF → ON
3. ADB 재시작
4. 디바이스 재부팅

#### Slow Streaming
- USB 2.0 대신 USB 3.0 포트 사용
- 무선 ADB 연결 시 WiFi 대역폭 확인
- 화면 해상도가 높으면 캡처 속도 저하 (정상)

### Image Matching Issues

#### Matching Fails Constantly
- **임계값 낮추기**: 0.95 → 0.85 → 0.8
- **크롭 영역 재조정**: 더 큰 영역 또는 더 유니크한 패턴 선택
- **화면 해상도 확인**: 템플릿 생성 시와 실행 시 동일한 해상도인지
- **화면 변화 확인**: 애니메이션/동적 요소가 있는지

#### Too Many False Positives
- **임계값 높이기**: 0.8 → 0.9 → 0.95
- **더 유니크한 패턴**: 반복되는 요소 대신 고유한 이미지 선택

### Application Issues

#### IPC Handler Errors
- 앱 재시작: `Ctrl+R` 또는 `Cmd+R`
- 완전 재시작: 앱 종료 후 `npm start`

#### Performance Issues
- DevTools 열기 (F12) → Console 탭에서 에러 확인
- 매크로에 불필요한 딜레이 제거
- 이미지 매칭 액션 수 줄이기

---

## Development

### Code Style
- **No Emoji**: 코드, 주석, 커밋 메시지에 이모지 사용 금지
- **Clean Code**: 명확한 변수명, 작은 함수, 단일 책임
- **Comments**: 영어로 작성, Why 설명 (What 아닌)

### Adding New Actions

1. **index.html**에 버튼 추가
2. **unified-app.js**의 `addAction()` 메서드에 케이스 추가
3. **unified-app.js**의 `displayActions()`에 표시 로직 추가
4. **unified-app.js**의 `executeAction()`에 실행 로직 추가
5. 필요시 **main.js**에 IPC 핸들러 추가

### Adding New IPC Handlers

**main.js**의 `setupIpcHandlers()` 함수에 추가:
```javascript
ipcMain.handle('your-channel', async (event, params) => {
  try {
    const result = await yourService.doSomething(params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**preload.js**에 API 노출:
```javascript
contextBridge.exposeInMainWorld('api', {
  yourNamespace: {
    doSomething: (params) => ipcRenderer.invoke('your-channel', params)
  }
});
```

---

## Roadmap

### Planned Features
- [ ] 다중 디바이스 동시 제어
- [ ] 매크로 스케줄링 (특정 시간에 자동 실행)
- [ ] OCR 텍스트 인식 통합
- [ ] 매크로 녹화 기능 (실제 액션을 녹화)
- [ ] 클라우드 동기화 (매크로 공유)
- [ ] 플러그인 시스템

### Performance Improvements
- [ ] OpenCV.js 통합 (선택적)
- [ ] WebAssembly 이미지 매칭
- [ ] 병렬 처리 지원

---

## Backup & Restore

프로젝트는 정기적으로 백업됩니다:

```
_backup/
└── 2025-10-28_cleanup/
    ├── README.md           # Backup details
    ├── main/               # Unused main process files
    ├── renderer/           # Unused renderer components
    └── shared/             # Unused shared types
```

백업 복원 방법은 `_backup/*/README.md` 참조

---

## Contributing

이슈 및 풀 리퀘스트 환영합니다!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see LICENSE file for details

---

## Resources

- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [ADB Command Reference](https://developer.android.com/studio/command-line/adb)
- [Jimp Documentation](https://github.com/jimp-dev/jimp)
- [Project Documentation](./CLAUDE.md)

---

<div align="center">

**Built with Electron + ADB**

[⬆ Back to Top](#vision-auto-v2)

</div>
