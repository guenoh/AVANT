# AVANT

**A**utomated **V**ision **AN**droid **T**esting

이미지 매칭 기반 Android 디바이스 자동화 도구

[English](README.en.md)

> "Avant"는 프랑스어로 "앞서가는", "전위적인"이라는 뜻을 가지고 있습니다.
> 앞서가는 자동화 기술로 테스트의 미래를 열어갑니다.

---

## 목차

1. [소개](#소개)
2. [주요 기능](#주요-기능)
3. [시스템 요구사항](#시스템-요구사항)
4. [설치](#설치)
5. [시작하기](#시작하기)
6. [사용자 가이드](#사용자-가이드)
7. [아키텍처](#아키텍처)
8. [API 레퍼런스](#api-레퍼런스)
9. [문제 해결](#문제-해결)
10. [개발](#개발)
11. [라이선스](#라이선스)

---

## 소개

Vision Auto는 Android 디바이스 자동화를 위한 데스크톱 애플리케이션입니다. Electron과 ADB(Android Debug Bridge)를 기반으로 구축되었으며, 자동화 시나리오를 생성하고 관리하며 실행할 수 있는 시각적 인터페이스를 제공합니다.

이 애플리케이션은 이미지 매칭 기술을 사용하여 디바이스 화면의 UI 요소를 식별합니다. 이를 통해 앱의 내부 구조에 접근하지 않고도 동적 콘텐츠에 적응하는 자동화가 가능합니다.

### 활용 사례

- **품질 보증 테스트**: 여러 디바이스에서 반복적인 테스트 시나리오 자동화
- **디바이스 설정**: 일관된 설정으로 여러 디바이스 구성
- **앱 데모**: 프레젠테이션용 재현 가능한 데모 시퀀스 생성
- **데이터 수집**: 시각적 인터페이스가 있는 앱에서 데이터 추출 자동화
- **접근성 테스트**: 다양한 입력 조건에서 앱 동작 검증

### 설계 철학

Vision Auto는 다음과 같은 핵심 원칙을 따릅니다:

1. **시각적 우선 접근**: 내부 앱 구조가 아닌 사용자가 보는 것을 기반으로 자동화
2. **루팅 불필요**: 표준 USB 디버깅으로 작동, 디바이스 수정 불필요
3. **오프라인 작동**: 모든 처리가 로컬에서 수행, 클라우드 의존성 없음
4. **확장 가능한 아키텍처**: 명확한 관심사 분리로 커스터마이징 가능

---

## 주요 기능

### 디바이스 연결

| 기능 | 설명 |
|------|------|
| USB 연결 | USB 케이블을 통한 직접 연결 및 자동 감지 |
| 무선 ADB | 초기 USB 페어링 후 WiFi를 통한 연결 |
| 다중 디바이스 지원 | 연결된 여러 디바이스 간 전환 |
| 연결 상태 | 자동 재연결 기능이 있는 실시간 연결 모니터링 |

### 화면 상호작용

| 기능 | 설명 |
|------|------|
| 실시간 스트리밍 | 애플리케이션에서 라이브 디바이스 화면 표시 |
| 화면 캡처 | 현재 화면을 이미지 파일로 저장 |
| 터치 액션 | 탭, 롱프레스, 스와이프, 드래그 작업 |
| 텍스트 입력 | 화면 키보드 없이 직접 텍스트 입력 |
| 하드웨어 키 | Home, Back, 최근 앱, 볼륨, 전원 버튼 시뮬레이션 |

### 이미지 매칭

| 기능 | 설명 |
|------|------|
| 영역 선택 | 매칭 템플릿 정의를 위한 시각적 드래그 선택 |
| 템플릿 저장 | 캡처된 영역 자동 저장 |
| 유사도 임계값 | 설정 가능한 매칭 민감도 (0-100%) |
| 매칭 시각화 | 신뢰도 점수와 함께 매칭 결과 표시 |
| 다중 영역 매칭 | 여러 매칭 조건 지원 |

### 시나리오 관리

| 기능 | 설명 |
|------|------|
| 액션 팔레트 | 드래그 앤 드롭 액션 빌딩 인터페이스 |
| 조건부 로직 | 매칭 결과 기반 IF/ELSE IF/ELSE 분기 |
| 반복 구조 | 이미지 기반 조건의 WHILE 루프 |
| 시나리오 파일 | JSON 기반 시나리오 저장 및 공유 |
| 실행 이력 | 타임스탬프와 함께 모든 실행된 액션 로깅 |

### AI 기반 분석

| 기능 | 설명 |
|------|------|
| 실패 분석 | 실패한 시나리오에 대한 LLM 기반 원인 분석 |
| 권장 사항 | 문제 해결을 위한 실행 가능한 제안 |
| Logcat 통합 | 실행 중 디바이스 로그 수집 |
| 결과 리포트 | 스크린샷이 포함된 포괄적인 실행 보고서 |

---

## 시스템 요구사항

### 운영 체제

| OS | 버전 | 상태 |
|----|------|------|
| macOS | 12.0 (Monterey) 이상 | 완전 지원 |
| Windows | 10 이상 | 지원 |
| Linux | Ubuntu 20.04 이상 | 커뮤니티 테스트됨 |

### 소프트웨어 요구사항

| 소프트웨어 | 버전 | 필수 여부 |
|-----------|------|----------|
| Node.js | 18.0 이상 | 예 |
| ADB | 최신 버전 | 예 |
| npm | 9.0 이상 | 예 |

### 하드웨어 요구사항

| 구성 요소 | 최소 | 권장 |
|----------|------|------|
| RAM | 4 GB | 8 GB 이상 |
| 저장 공간 | 500 MB | 1 GB 이상 |
| USB | USB 2.0 | USB 3.0 |

### Android 디바이스 요구사항

| 요구사항 | 세부 사항 |
|---------|----------|
| Android 버전 | 7.0 (API 24) 이상 |
| USB 디버깅 | 개발자 옵션에서 활성화 |
| USB 연결 | MTP 또는 PTP 모드 |
| 화면 잠금 | 자동화 중 비활성화 또는 잠금 해제 상태 |

---

## 설치

### 1단계: ADB 설치

**macOS (Homebrew 사용)**
```bash
brew install android-platform-tools
```

**Windows**
1. [Android SDK Platform Tools](https://developer.android.com/studio/releases/platform-tools) 다운로드
2. 폴더에 압축 해제 (예: `C:\platform-tools`)
3. 해당 폴더를 시스템 PATH에 추가

**Linux (Debian/Ubuntu)**
```bash
sudo apt-get update
sudo apt-get install android-tools-adb
```

설치 확인:
```bash
adb version
```

### 2단계: 복제 및 설치

```bash
git clone https://github.com/guenoh/AVANT.git
cd AVANT
npm install
```

### 3단계: Android 디바이스 설정

1. **개발자 옵션 활성화**
   - 설정 > 휴대전화 정보로 이동
   - "빌드 번호"를 7번 탭
   - 설정에 개발자 옵션이 나타남

2. **USB 디버깅 활성화**
   - 설정 > 개발자 옵션으로 이동
   - "USB 디버깅" 활성화
   - (선택사항) 화면 시간 초과 방지를 위해 "화면 켜짐 유지" 활성화

3. **디바이스 연결**
   - USB 케이블로 디바이스 연결
   - 디바이스에서 "USB 디버깅 허용" 프롬프트 수락
   - 편의를 위해 "이 컴퓨터에서 항상 허용" 체크

연결 확인:
```bash
adb devices
```

예상 출력:
```
List of devices attached
XXXXXXXXXX    device
```

### 4단계: 애플리케이션 실행

```bash
# 개발 모드 (DevTools 포함)
npm run dev

# 프로덕션 모드
npm start
```

---

## 시작하기

### 첫 연결

1. Vision Auto 실행
2. USB로 Android 디바이스 연결
3. 디바이스 패널에서 "새로고침" 버튼 클릭
4. 드롭다운에서 디바이스 선택
5. 메인 패널에 디바이스 화면 표시

### 첫 번째 시나리오 만들기

**1단계: 대상 이미지 캡처**
1. 크롭 아이콘을 클릭하여 "크롭 모드" 활성화
2. 화면에서 영역(예: 버튼)을 드래그하여 선택
3. 캡처된 영역이 자동 저장됨

**2단계: 액션 추가**
1. 액션 팔레트 열기
2. "이미지 매칭"을 시나리오로 드래그
3. 매칭 임계값 설정 (기본값: 85%)
4. 매칭 시 수행할 액션 설정 (탭, 롱프레스 등)

**3단계: 지원 액션 추가**
1. 안정성을 위해 매칭 전에 "대기" 액션 추가
2. 필요에 따라 추가 액션 추가

**4단계: 실행 및 확인**
1. "재생" 버튼을 클릭하여 시나리오 실행
2. 라이브 미리보기에서 실행 관찰
3. 로그 패널에서 결과 확인

**5단계: 시나리오 저장**
1. "시나리오 저장" 클릭
2. 설명적인 이름 입력
3. 시나리오가 JSON 파일로 저장됨

---

## 사용자 가이드

### 인터페이스 이해하기

```
+------------------------------------------------------------------+
|  툴바                                                             |
+------------------------------------------------------------------+
|          |                              |                         |
|  디바이스 |        화면 미리보기          |     시나리오 패널        |
|  패널    |                              |                         |
|          |                              |     - 액션 목록          |
|          |                              |     - 설정              |
|          |                              |     - 컨트롤            |
+----------+------------------------------+-------------------------+
|                        로그 패널                                   |
+------------------------------------------------------------------+
```

### 액션 유형

#### 기본 액션

| 액션 | 설명 | 매개변수 |
|------|------|---------|
| 탭 | 좌표에서 단일 터치 | X, Y 위치 |
| 롱프레스 | 확장된 터치 | X, Y 위치, 지속 시간 |
| 스와이프 | 한 지점에서 다른 지점으로 슬라이드 | 시작 X/Y, 끝 X/Y, 지속 시간 |
| 드래그 | 터치 후 홀드하면서 이동 | 시작 X/Y, 끝 X/Y, 지속 시간 |
| 텍스트 입력 | 텍스트 입력 | 텍스트 문자열, IME 옵션 |
| 대기 | 실행 일시 중지 | 밀리초 단위 지속 시간 |

#### 하드웨어 키

| 액션 | 설명 |
|------|------|
| Home | 홈 화면으로 이동 |
| Back | 뒤로 가기 / 다이얼로그 닫기 |
| 최근 앱 | 최근 앱 보기 열기 |
| 볼륨 업/다운 | 디바이스 볼륨 조정 |
| 전원 | 화면 켜기/끄기 토글 |

#### 스마트 액션

| 액션 | 설명 | 매개변수 |
|------|------|---------|
| 이미지 매칭 | 화면에서 이미지 찾기 | 템플릿, 임계값, 타임아웃 |
| 매칭 탭 | 마지막으로 매칭된 위치 탭 | 없음 |

#### 제어 흐름

| 액션 | 설명 |
|------|------|
| IF | 조건이 참이면 블록 실행 |
| ELSE IF | 대체 조건 확인 |
| ELSE | 모든 조건이 거짓일 때 실행 |
| WHILE | 조건이 참인 동안 반복 |
| LOOP | 고정 횟수만큼 반복 |

#### 결과 액션

| 액션 | 설명 |
|------|------|
| 성공 | 시나리오를 통과로 표시 |
| 실패 | 시나리오를 실패로 표시 |
| 건너뛰기 | 나머지 액션 건너뛰기 |

### 이미지 매칭 모범 사례

**좋은 매칭 영역 선택**

권장:
- 고유한 시각적 요소 선택
- 일부 주변 컨텍스트 포함
- 뚜렷한 색상이나 패턴이 있는 영역 사용
- 애니메이션되지 않는 정적 요소 선택

피해야 할 것:
- 20x20 픽셀보다 작은 영역 선택
- 애니메이션되거나 변경되는 콘텐츠 포함
- 화면에 여러 번 나타나는 영역 사용
- 순수 흰색 또는 단색 영역 선택

**임계값 가이드라인**

| 임계값 | 사용 사례 |
|--------|----------|
| 95-100% | 픽셀 완벽 매칭, 정적 콘텐츠 |
| 85-95% | 약간의 변형이 있는 표준 UI 요소 |
| 75-85% | 일관된 레이아웃의 동적 콘텐츠 |
| 60-75% | 상당한 변형 예상 (주의해서 사용) |

### 조건부 로직 예제

**예제 1: 오류 처리가 있는 로그인 흐름**
```
IF [로그인 버튼 표시됨]
    매칭된 위치 탭
    3000ms 대기
    IF [홈 화면 표시됨]
        성공
    ELSE IF [에러 메시지 표시됨]
        [재시도 버튼] 탭
    ELSE
        실패
ENDIF
```

**예제 2: 찾을 때까지 스크롤**
```
WHILE [대상 항목 표시 안됨]
    위로 스와이프
    500ms 대기
ENDWHILE
매칭된 위치 탭
```

### 여러 디바이스 작업

1. 모든 디바이스를 USB로 연결
2. `adb devices`로 모든 디바이스가 연결되었는지 확인
3. Vision Auto에서 드롭다운으로 대상 디바이스 선택
4. 선택한 디바이스에서 시나리오 실행
5. 재연결 없이 드롭다운으로 디바이스 전환

---

## 아키텍처

### 프로젝트 구조

```
vision-auto/
+-- src/
|   +-- main/                      # Electron 메인 프로세스
|   |   +-- main.js                # 애플리케이션 진입점
|   |   +-- preload.js             # 렌더러로의 IPC 브릿지
|   |   +-- services/              # 비즈니스 로직 서비스
|   |       +-- device.service.js      # 디바이스 관리
|   |       +-- screen.service.js      # 화면 캡처 및 스트리밍
|   |       +-- action.service.js      # 액션 실행
|   |       +-- macro.service.js       # 시나리오 관리
|   |       +-- result-report.service.js   # 실행 리포트
|   |       +-- ai-analysis.service.js     # LLM 통합
|   |       +-- adb-logcat.service.js      # 디바이스 로그 수집
|   |       +-- protocols/             # 프로토콜 구현
|   |           +-- AdbProtocol.js     # ADB 명령어
|   |           +-- BaseProtocol.js    # 프로토콜 인터페이스
|   +-- renderer/                  # Electron 렌더러 프로세스
|   |   +-- index.html             # 메인 UI
|   |   +-- macro-builder-app.js   # 애플리케이션 컨트롤러
|   |   +-- components/            # UI 컴포넌트
|   |   +-- services/              # 프론트엔드 서비스
|   |   +-- styles/                # CSS 스타일시트
|   +-- shared/                    # 공유 코드
|       +-- constants.js           # IPC 채널, 열거형
+-- docs/                          # 문서
+-- tests/                         # 테스트 파일
+-- package.json                   # 프로젝트 설정
```

### 기술 스택

| 레이어 | 기술 | 용도 |
|--------|------|------|
| 데스크톱 프레임워크 | Electron 28 | 크로스 플랫폼 데스크톱 앱 |
| 런타임 | Node.js 18+ | JavaScript 런타임 |
| 디바이스 제어 | ADB | Android 디바이스 통신 |
| 이미지 처리 | Jimp | 순수 JavaScript 이미지 조작 |
| UI 렌더링 | Vanilla JS, CSS3 | 프레임워크 의존성 없음 |
| 테스트 | Jest, Playwright | 단위 및 E2E 테스트 |

### IPC 통신

애플리케이션은 메인 프로세스와 렌더러 프로세스 간 통신을 위해 Electron의 IPC(Inter-Process Communication)를 사용합니다.

**채널 명명 규칙**
```
{도메인}:{액션}:{서브-액션}

예시:
- device:list
- screen:capture
- action:execute
- scenario:save
```

**요청/응답 패턴**
```javascript
// 렌더러 프로세스
const result = await window.api.device.list();

// 메인 프로세스
ipcMain.handle('device:list', async () => {
    return await deviceService.getDevices();
});
```

### 서비스 레이어

모든 비즈니스 로직은 서비스에 캡슐화되어 있습니다:

| 서비스 | 책임 |
|--------|------|
| DeviceService | 디바이스 감지, 연결 관리 |
| ScreenService | 화면 캡처, 스트리밍, 이미지 처리 |
| ActionService | 액션 실행, 좌표 변환 |
| MacroService | 시나리오 파일 작업 |
| ResultReportService | 실행 로깅, 리포트 생성 |
| AIAnalysisService | 실패 분석을 위한 LLM API 통합 |
| ADBLogcatService | 디바이스 로그 수집 및 필터링 |

---

## API 레퍼런스

### Device API

```javascript
// 연결된 디바이스 목록
await window.api.device.list();
// 반환: Array<{id: string, model: string, status: string}>

// 디바이스 선택
await window.api.device.select(deviceId);
// 반환: {success: boolean}

// 현재 디바이스 정보 가져오기
await window.api.device.getInfo();
// 반환: {id, model, manufacturer, androidVersion, resolution}

// 무선 ADB로 연결
await window.api.device.connectWireless(ipAddress);
// 반환: {success: boolean}
```

### Screen API

```javascript
// 현재 화면 캡처
await window.api.screen.capture();
// 반환: {success: boolean, imagePath: string, dataUrl: string}

// 화면 스트리밍 시작
await window.api.screen.startStream({fps: 10, quality: 80});
// 반환: {success: boolean}

// 화면 스트리밍 중지
await window.api.screen.stopStream();
// 반환: {success: boolean}
```

### Action API

```javascript
// 단일 액션 실행
await window.api.action.execute({
    type: 'tap',
    x: 500,
    y: 1000
});
// 반환: {success: boolean, duration: number}

// 액션 배치 실행
await window.api.action.executeBatch([
    {type: 'tap', x: 500, y: 1000},
    {type: 'wait', duration: 1000},
    {type: 'swipe', x1: 500, y1: 1500, x2: 500, y2: 500, duration: 300}
]);
// 반환: {success: boolean, results: Array}
```

### Scenario API

```javascript
// 모든 시나리오 목록
await window.api.scenario.list();
// 반환: Array<{filename: string, name: string, modified: Date}>

// 시나리오 저장
await window.api.scenario.save({
    name: '로그인 테스트',
    actions: [...],
    metadata: {...}
});
// 반환: {success: boolean, filename: string}

// 시나리오 불러오기
await window.api.scenario.load(filename);
// 반환: {success: boolean, scenario: Object}

// 시나리오 삭제
await window.api.scenario.delete(filename);
// 반환: {success: boolean}
```

---

## 문제 해결

### 디바이스가 감지되지 않음

**증상**: 디바이스가 디바이스 드롭다운에 나타나지 않음

**해결 방법**:
1. USB 케이블이 데이터 전송 가능한지 확인 (충전 전용이 아닌지)
2. 디바이스에서 USB 디버깅이 활성화되어 있는지 확인
3. 디바이스에서 "USB 디버깅 허용" 프롬프트 수락
4. ADB 서버 재시작:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```
5. 다른 USB 포트 시도

### 디바이스가 "Unauthorized" 표시

**증상**: 디바이스가 나타나지만 제어할 수 없음

**해결 방법**:
1. USB 케이블 분리 후 재연결
2. 디바이스 화면에서 인증 프롬프트 확인
3. "이 컴퓨터에서 항상 허용" 체크
4. 프롬프트가 나타나지 않으면:
   ```bash
   adb kill-server
   rm ~/.android/adbkey*    # macOS/Linux
   adb start-server
   ```
5. 디바이스 재연결 후 프롬프트 수락

### 화면 캡처가 검은색 이미지 반환

**증상**: 미리보기가 검은색 또는 빈 화면 표시

**해결 방법**:
1. 디바이스 화면이 잠금 해제되어 있는지 확인
2. 앱에 보안 플래그가 있는지 확인 (뱅킹 앱에서 자주 발생)
3. 화면 오버레이 앱 비활성화
4. 다른 앱(예: 홈 화면)에서 캡처 시도
5. Vision Auto 애플리케이션 재시작

### 이미지 매칭이 항상 실패

**증상**: 대상이 보이는데도 매칭이 성공하지 않음

**해결 방법**:
1. 임계값 낮추기 (75-80% 시도)
2. 현재 화면에서 템플릿 다시 캡처
3. 디바이스 해상도가 변경되지 않았는지 확인
4. 애니메이션 요소 캡처 피하기
5. 더 크고 뚜렷한 영역 선택

### 느린 화면 스트리밍

**증상**: 미리보기가 느리게 업데이트되거나 지연됨

**원인 및 해결 방법**:
| 원인 | 해결 방법 |
|------|----------|
| USB 2.0 | USB 3.0 포트 사용 |
| 높은 해상도 | 설정에서 디바이스 해상도 낮추기 |
| CPU 부하 | 다른 애플리케이션 종료 |
| 무선 연결 | 더 나은 성능을 위해 USB 사용 |

### 애플리케이션 시작 시 충돌

**해결 방법**:
1. `node_modules` 삭제 후 재설치:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Node.js 버전 확인 (18+ 필요)
3. 디버그 모드로 실행:
   ```bash
   npm run dev
   ```
4. 콘솔에서 오류 메시지 확인

---

## 개발

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 모드로 실행
npm run dev

# 테스트 실행
npm test

# 커버리지로 테스트 실행
npm run test:coverage
```

### 코드 스타일 가이드라인

- 코드, 주석, 커밋 메시지에 이모지 사용 금지
- 의미 있는 변수 및 함수 이름 사용
- 함수를 작고 집중적으로 유지
- "무엇"이 아닌 "왜"를 설명하는 주석 작성
- 코드베이스의 기존 패턴 따르기

### 새 액션 유형 추가

1. **ActionConfigProvider.js에 액션 정의**
   - 액션 메타데이터 추가
   - 색상 스킴 설정
   - 적절한 카테고리에 추가

2. **ActionSettingsBuilder.js에 설정 빌더 생성**
   - 설정 패널 HTML 빌드
   - 매개변수 유효성 검사 처리

3. **main.js에 실행 구현**
   - action:execute 핸들러에 case 추가
   - 실제 디바이스 액션 구현

4. **새 IPC가 필요하면 preload.js 업데이트**
   - 새 API 메서드 노출
   - 응답 형식 처리

### 테스트 실행

```bash
# 단위 테스트
npm test

# E2E 테스트
npm run test:e2e

# 커버리지 리포트
npm run test:coverage
```

### 프로덕션 빌드

```bash
# 현재 플랫폼용 빌드
npm run build

# 특정 플랫폼용 빌드
npm run build:mac
npm run build:win
npm run build:linux
```

---

## 라이선스

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 참고 자료

- [Electron 문서](https://www.electronjs.org/docs/latest)
- [ADB 명령어 레퍼런스](https://developer.android.com/studio/command-line/adb)
- [Jimp 이미지 처리](https://github.com/jimp-dev/jimp)
- [Android 개발자 옵션](https://developer.android.com/studio/debug/dev-options)
