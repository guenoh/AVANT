# Vision Auto v2 리팩토링 계획

## 현재 상태 분석
- **파일**: `src/renderer/macro-builder-app.js`
- **크기**: 6,812줄
- **문제**: God Class 안티패턴, 강한 결합, 낮은 응집도

## 주요 문제점

### 1. 과도하게 긴 메서드
- `getSettingsHTML()`: 645줄
- `updateSelectedActionMarker()`: 224줄
- `renderScenarioListInPanel()`: 206줄
- `executeImageMatchAction()`: 185줄
- `renderActionSequence()`: 173줄

### 2. 강한 결합
- DOM 직접 조작: 149회
- 인라인 이벤트 핸들러: 75회
- localStorage 직접 접근: 29회

### 3. 중복 코드
- SVG 아이콘: 50회 이상 반복
- 버튼 HTML: 15회 반복
- 좌표 변환 로직: 여러 메서드에 산재

## 리팩토링 로드맵

### Phase 1: 긴급 안정화 ✅
- [x] 상수 파일 생성 (`constants/app-constants.js`)
- [ ] 디버그 로그 정리
- [ ] `getSettingsHTML()` 메서드 분해

### Phase 2: 렌더링 계층 분리
- [ ] `ActionSettingsBuilder` 클래스 생성
- [ ] `ActionRenderer` 클래스 생성
- [ ] `ScenarioRenderer` 클래스 생성

### Phase 3: 비즈니스 로직 분리
- [ ] `MacroExecutor` 서비스 강화
- [ ] `ImageMatchService` 생성
- [ ] `DeviceConnectionManager` 생성

### Phase 4: 데이터 & 상태 관리
- [ ] `ScenarioRepository` 생성
- [ ] `StateManager` 구현

### Phase 5: 최적화 & 문서화
- [ ] 렌더링 최적화
- [ ] 에러 처리 표준화
- [ ] 문서화 추가

## 예상 효과

### 메트릭 개선
| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| 클래스당 라인 수 | 6,812 | <500 | 92% ↓ |
| 평균 메서드 길이 | 68줄 | <30줄 | 56% ↓ |
| 최대 메서드 길이 | 645줄 | <100줄 | 84% ↓ |
| DOM 직접 접근 | 149회 | <10회 | 93% ↓ |

### 품질 개선
- 테스트 커버리지: 0% → 80%
- 유지보수 시간: 70% 단축
- 버그 발생률: 50% 감소

## 진행 상황

- [x] 리팩토링 분석 완료
- [x] 상수 파일 생성
- [x] Phase 2: getSettingsHTML() 메서드 추출 완료 (645줄 → 4줄)
- [x] Phase 3: TemplateHelpers 생성 및 중복 코드 제거 완료
- [ ] Phase 4: 복잡한 빌더 메서드 구현 (보류)
- [ ] Phase 5: 렌더링 계층 완전 분리 (보류)

## 완료된 작업 (Phase 2-3)

### Phase 2: ActionSettingsBuilder 생성
- 645줄의 `getSettingsHTML()` 메서드를 4줄로 축소
- 30개 액션 타입을 Map 기반 빌더로 리팩토링
- 구현된 빌더 메서드:
  - `buildClickSettings`: Click & Long-press 액션 설정
  - `buildDragSettings`: Drag 액션 설정
  - `buildKeyboardSettings`: Keyboard 입력 설정
  - `buildWaitSettings`: Wait 대기 설정
  - `buildScreenshotSettings`: Screenshot 설정
  - `buildLoopSettings`: Loop 반복 설정
  - `buildLogSettings`: Log 로그 설정
  - `buildResultSettings`: Success/Fail/Skip 결과 설정
  - `buildNoSettings`: Home/Back 버튼 (설정 없음)

### Phase 3: TemplateHelpers 유틸리티
- 중복 코드 50+ 인스턴스 제거
- 재사용 가능한 템플릿 함수 생성:
  - `icons`: 8개 SVG 아이콘 컬렉션
  - `input()`: 공통 input 필드 생성
  - `coordinateInputs()`: X, Y 좌표 입력 쌍
  - `incrementControl()`: 증감 버튼이 있는 숫자 입력
  - `textInput()`: 텍스트 입력 필드
  - `settingsContainer()`: 설정 컨테이너 래퍼
  - `button()`: 버튼 생성

### 개선 메트릭
- **코드 라인 수 감소**: 740+ 줄 (638줄 Phase 2 + 104줄 Phase 3)
- **DRY 원칙 적용**: SVG 아이콘 중복 50+ 회 → 1회
- **유지보수성 향상**: 단일 책임 원칙, Builder 패턴 적용
- **버그 감소**: 템플릿 로직 중앙화로 일관성 확보

## 보류된 작업 (Phase 4-5)

### Phase 4: 복잡한 빌더 메서드 (보류 이유)
다음 빌더 메서드들은 MacroBuilderApp과 강하게 결합되어 있어 추가 리팩토링이 필요함:

1. **image-match settings** (100줄)
   - 이유: 영역 선택, 썸네일 렌더링, 자동 자르기 기능이 앱 상태와 강하게 결합
   - 필요한 작업: 이미지 처리 로직을 별도 서비스로 분리

2. **Conditional settings** (if/else-if/while) (50줄)
   - 이유: `renderConditionCard()` 메서드 의존, 드래그 앤 드롭 로직
   - 필요한 작업: 조건 관리 로직을 별도 모듈로 분리

3. **tap-matched-image settings** (45줄)
   - 이유: `getImageMatchActionsBeforeAction()` 메서드 의존
   - 필요한 작업: 액션 간 참조 관리 시스템 재설계

4. **test settings** (200줄)
   - 이유: UI 컴포넌트 테스트용 샘플 (프로덕션 기능 아님)
   - 필요한 작업: 제거 또는 별도 테스트 도구로 이관

5. **sound-check settings** (65줄)
   - 이유: `openSoundCheckModal()` 메서드 의존
   - 필요한 작업: 모달 관리 시스템 재설계

### Phase 5: 렌더링 계층 분리 (보류 이유)
대규모 구조 변경이 필요하여 별도 이슈로 추진 예정:

1. **ActionRenderer 생성** (~1,800줄 추출)
   - `renderActionSequence()` (173줄)
   - `updateSelectedActionMarker()` (224줄)
   - `renderActionBlock()` (85줄)
   - 기타 렌더링 헬퍼 메서드들

2. **ScenarioRenderer 생성** (~545줄 추출)
   - `renderScenarioListInPanel()` (206줄)
   - 시나리오 목록 관리 로직

## 다음 단계 (권장 순서)

### 즉시 가능
1. 이벤트 핸들러 정리
   - 인라인 이벤트 핸들러를 이벤트 위임으로 변경
   - 75개 인라인 핸들러 → 중앙 집중식 관리

2. 디버그 로그 정리
   - console.log 정리 및 표준화
   - 개발/프로덕션 모드 분리

### 중기 (별도 이슈로 진행)
3. 비즈니스 로직 분리 (Phase 4)
   - ImageMatchService 생성
   - ConditionManager 생성
   - ActionReferenceManager 생성

4. 렌더링 계층 완전 분리 (Phase 5)
   - ActionRenderer 클래스 생성
   - ScenarioRenderer 클래스 생성
   - 이벤트 위임 시스템 구축

## 참고사항

- 점진적 리팩토링 (Strangler Fig Pattern) 적용
- 기존 API 하위 호환성 유지
- 각 단계마다 테스트 및 검증
- 기능 깨짐 방지를 위한 단계적 접근
