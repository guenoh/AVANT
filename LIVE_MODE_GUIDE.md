# Live 모드 사용 가이드

Vision Auto는 이제 **두 가지 모드**를 지원합니다!

## 📸 스크린샷 모드 vs 🎥 Live 모드

### 스크린샷 모드 (기본)
- **동작 방식**: 버튼 클릭 시 화면 캡처
- **장점**:
  - 가볍고 빠름
  - 리소스 사용 적음
  - 정확한 타이밍 제어
- **단점**:
  - 수동으로 새로고침 필요
  - 실시간 변화 확인 어려움

### Live 모드 (NEW!)
- **동작 방식**: scrcpy를 통한 실시간 미러링
- **장점**:
  - 실시간으로 화면 변화 확인
  - 60fps 부드러운 화면
  - 직접 터치/클릭 가능 (scrcpy 창에서)
- **단점**:
  - 리소스 사용량 높음
  - scrcpy 설치 필요

---

## 🚀 Live 모드 사용 방법

### 1. scrcpy 설치 (필수)

#### macOS
```bash
brew install scrcpy
```

#### Windows
1. [scrcpy GitHub 릴리즈](https://github.com/Genymobile/scrcpy/releases) 다운로드
2. 압축 해제 후 PATH에 추가

#### Linux
```bash
sudo apt install scrcpy
```

### 2. Vision Auto에서 Live 모드 활성화

1. **디바이스 선택**
   - [디바이스 검색] 클릭
   - 드롭다운에서 디바이스 선택

2. **Live 모드 버튼 클릭**
   - 상단 툴바에서 **[🎥 Live]** 버튼 클릭
   - 별도 창에서 scrcpy가 자동 실행됨

3. **실시간 화면 확인**
   - scrcpy 창에서 안드로이드 화면이 실시간으로 표시됨
   - 마우스로 직접 조작 가능!

4. **크롭 모드와 함께 사용**
   - **[✂️ 크롭 모드]** 활성화
   - Vision Auto 앱으로 돌아와서 화면 새로고침
   - 드래그로 영역 선택
   - 액션 추가

5. **Live 모드 중지**
   - **[🎥 Live]** 버튼 다시 클릭
   - 또는 **[📸 스크린샷]** 모드로 전환

---

## 💡 사용 팁

### Tip 1: Live 모드 + 크롭 모드 조합

```
1. [🎥 Live] 모드 시작
   → scrcpy 창에서 실시간으로 화면 확인

2. Vision Auto 앱에서 [🔄 새로고침] 클릭
   → 현재 화면 캡처

3. [✂️ 크롭 모드] 활성화
   → 드래그로 버튼 영역 선택

4. scrcpy 창에서 실시간으로 결과 확인
   → 버튼이 클릭되는지 즉시 확인!
```

### Tip 2: 성능 최적화

scrcpy는 기본적으로 최대 해상도로 실행됩니다.
성능 향상을 원하면 `src/renderer.js`에서 설정 변경:

```javascript
// src/renderer.js, line 569
options: {
  maxSize: 1024,  // 기본값: 1024 (낮춤: 720, 높임: 1920)
  bitRate: '8M'    // 기본값: 8M (낮춤: 4M, 높임: 16M)
}
```

### Tip 3: scrcpy 단축키

Live 모드로 실행 중일 때 scrcpy 창에서 사용 가능한 단축키:

- **Ctrl+F**: 전체화면
- **Ctrl+G**: 화면 크기 조정
- **Ctrl+H**: Home 버튼
- **Ctrl+B**: Back 버튼
- **Ctrl+S**: 스크린샷 촬영
- **Ctrl+O**: 화면 끄기/켜기
- **Ctrl+N**: 알림 패널 열기

더 많은 단축키: [scrcpy 문서](https://github.com/Genymobile/scrcpy#shortcuts)

---

## 🎯 실전 예제: Live 모드로 게임 매크로 만들기

### 시나리오
모바일 게임에서 반복 클릭 매크로 제작

### 단계별 구현

1. **Live 모드 시작**
   ```
   [🎥 Live] 클릭
   → scrcpy 창에서 게임 실행
   → 게임 플레이하면서 확인
   ```

2. **첫 번째 버튼 크롭**
   ```
   Vision Auto에서 [🔄 새로고침]
   → [✂️ 크롭 모드]
   → "전투 시작" 버튼 드래그
   → 프리뷰 확인 → [액션 추가]
   ```

3. **두 번째 버튼 크롭**
   ```
   scrcpy 창에서 "전투 시작" 클릭
   → 다음 화면으로 이동
   → Vision Auto에서 [🔄 새로고침]
   → "보상 수령" 버튼 드래그
   → [액션 추가]
   ```

4. **매크로 실행**
   ```
   [▶️ 실행] 클릭
   → scrcpy 창에서 실시간으로 동작 확인!
   ```

5. **반복 설정 (JSON 편집)**
   ```json
   [
     {
       "type": "image_match",
       "templatePath": "./templates/battle_button.png",
       "action": "tap"
     },
     {
       "type": "wait",
       "duration": 3000
     },
     {
       "type": "image_match",
       "templatePath": "./templates/reward_button.png",
       "action": "tap"
     }
   ]
   ```

---

## ⚙️ 고급 설정

### scrcpy 옵션 커스터마이징

`src/scrcpy.js` 파일에서 scrcpy 실행 옵션 변경 가능:

```javascript
const args = [
  '-s', deviceId,
  '--window-title', 'Vision Auto - Live Mirror',
  '--always-on-top',          // 항상 위
  '--window-borderless',      // 테두리 없음
  '--stay-awake',             // 화면 꺼짐 방지
  '--turn-screen-off',        // 디바이스 화면 끄기
  '--max-size', '1024',       // 최대 해상도
  '--bit-rate', '8M'          // 비트레이트
]
```

**추가 가능한 옵션:**
```javascript
'--fullscreen',              // 전체화면
'--no-control',              // 터치 비활성화 (보기만)
'--show-touches',            // 터치 위치 표시
'--record', 'output.mp4'    // 화면 녹화
```

---

## 🔧 문제 해결

### Q1: scrcpy 창이 안 열립니다
**A:**
```bash
# scrcpy 설치 확인
scrcpy --version

# 수동 실행 테스트
scrcpy -s <device_id>

# ADB 연결 확인
adb devices
```

### Q2: Live 모드가 느립니다
**A:**
```javascript
// renderer.js에서 해상도 낮추기
options: {
  maxSize: 720,  // 1024 → 720
  bitRate: '4M'   // 8M → 4M
}
```

### Q3: scrcpy 창에서 터치가 안 됩니다
**A:**
- USB 디버깅이 활성화되어 있는지 확인
- "USB를 통한 설치 허용" 옵션 확인
- 디바이스 재연결

### Q4: 크롭한 이미지가 Live 화면과 다릅니다
**A:**
- Live 모드에서 크롭하기 전에 **반드시 [🔄 새로고침]** 클릭
- scrcpy 해상도가 실제 디바이스와 다를 수 있음
- 해상도 확인: scrcpy 창 하단 상태바

---

## 📊 모드 비교표

| 기능 | 스크린샷 모드 | Live 모드 |
|------|--------------|-----------|
| **화면 업데이트** | 수동 (버튼 클릭) | 자동 (60fps) |
| **리소스 사용** | 낮음 | 높음 |
| **직접 조작** | ❌ | ✅ (scrcpy 창에서) |
| **크롭 기능** | ✅ | ✅ |
| **매크로 실행** | ✅ | ✅ |
| **설치 요구사항** | ADB만 | ADB + scrcpy |
| **용도** | 일반 자동화 | 게임, 실시간 확인 |

---

## 🎓 다음 단계

- **Live + 루프**: JSON에 조건문 추가로 무한 반복
- **Live 녹화**: scrcpy의 `--record` 옵션으로 플레이 녹화
- **다중 디바이스**: 여러 scrcpy 창 동시 실행

---

**Live 모드로 더 강력한 자동화를 경험하세요!** 🚀
