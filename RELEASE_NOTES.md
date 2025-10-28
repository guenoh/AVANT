# Vision Auto v1.1.0 - Live 모드 추가! 🎥

## 🎉 새로운 기능

### Live 모드 (scrcpy 통합)

이제 Vision Auto는 **두 가지 화면 모드**를 지원합니다!

#### 📸 스크린샷 모드 (기존)
- 버튼 클릭으로 화면 캡처
- 가볍고 빠름
- ADB만 필요

#### 🎥 Live 모드 (NEW!)
- **scrcpy를 통한 실시간 미러링**
- **60fps 부드러운 화면**
- **직접 터치/클릭 가능**
- 게임 자동화에 최적!

---

## 🚀 사용 방법

### 1. scrcpy 설치
```bash
# macOS
brew install scrcpy

# Windows - scrcpy GitHub에서 다운로드
# Linux
sudo apt install scrcpy
```

### 2. Live 모드 활성화
```
1. Vision Auto 실행
2. 디바이스 선택
3. 상단에서 [🎥 Live] 버튼 클릭
4. scrcpy 창이 자동으로 열림!
5. 실시간 화면 확인 + 드래그로 크롭
```

---

## 📊 모드 비교

| | 스크린샷 모드 | Live 모드 |
|---|---|---|
| 화면 업데이트 | 수동 | **실시간 (60fps)** |
| 직접 조작 | ❌ | **✅** |
| 리소스 | 낮음 | 중간 |
| 용도 | 일반 자동화 | **게임, 실시간 확인** |

---

## 🎯 핵심 기능

### 1. 실시간 화면 확인
- scrcpy로 안드로이드 화면 60fps 미러링
- 버튼 클릭 즉시 반응 확인
- 게임 플레이하면서 매크로 제작

### 2. 드래그 크롭 (변함없음)
- 마우스로 화면 드래그
- 실시간으로 선택 영역 표시
- 즉시 템플릿 이미지로 저장

### 3. 모드 간 자유로운 전환
- 버튼 클릭으로 즉시 모드 변경
- 작업 흐름 끊김 없음

---

## 📁 추가된 파일

```
src/scrcpy.js              # scrcpy 연동 모듈
LIVE_MODE_GUIDE.md         # Live 모드 상세 가이드
```

## 🔧 수정된 파일

```
src/main.js                # Live 모드 IPC 핸들러 추가
src/renderer.js            # 모드 전환 로직 구현
src/index.html             # 모드 선택 UI 추가
src/styles.css             # 모드 버튼 스타일 추가
```

---

## 💡 실전 예제

### 게임 자동화 with Live 모드

```
1. [🎥 Live] 모드 시작
   → scrcpy 창에서 게임 실행

2. Vision Auto에서 [🔄 새로고침]
   → 현재 화면 캡처

3. [✂️ 크롭 모드] 활성화
   → "전투 시작" 버튼 드래그

4. scrcpy 창에서 버튼 클릭되는지 실시간 확인!

5. [▶️ 실행]으로 매크로 반복
```

---

## ⚙️ 설정 옵션

`src/renderer.js`에서 Live 모드 설정 변경 가능:

```javascript
options: {
  maxSize: 1024,         // 해상도 (720, 1024, 1920)
  videoBitRate: '8M'     // 비트레이트 (4M, 8M, 16M)
}
```

---

## 🐛 버그 수정

- scrcpy 3.3.2 호환성 수정
  - `--bit-rate` → `--video-bit-rate`로 변경
- Live 모드에서 크롭 기능 안정화

---

## 📚 문서

- **README.md**: 전체 사용 가이드
- **QUICKSTART.md**: 빠른 시작 (5분)
- **LIVE_MODE_GUIDE.md**: Live 모드 상세 가이드 (NEW!)
- **TEST_RESULTS.md**: 테스트 결과

---

## 🎓 다음 업데이트 예정

- [ ] Live 화면을 Electron 창에 임베드
- [ ] 다중 디바이스 동시 제어
- [ ] 조건문/루프 GUI 편집기
- [ ] OCR 텍스트 인식

---

## 📝 알려진 제한사항

1. **scrcpy 별도 창**
   - 현재는 scrcpy가 별도 창으로 실행됨
   - 추후 Electron 창에 임베드 예정

2. **해상도 차이**
   - scrcpy 화면과 실제 디바이스 해상도가 다를 수 있음
   - 크롭 전에 반드시 [새로고침] 필요

3. **macOS 권한**
   - scrcpy 창 제어를 위해 접근성 권한 필요할 수 있음

---

## 🙏 감사합니다!

Vision Auto를 사용해주셔서 감사합니다.
Live 모드로 더 강력한 자동화를 경험하세요! 🚀

**버전**: 1.1.0
**릴리즈 날짜**: 2025-10-27
**변경사항**: Live 모드 추가 (scrcpy 통합)
