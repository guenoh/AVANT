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
- [ ] Phase 4: 복잡한 빌더 메서드 구현
- [ ] Phase 5: 렌더링 계층 완전 분리

## 다음 단계

1. `getSettingsHTML()` 메서드를 `ActionSettingsBuilder` 클래스로 추출
2. 각 액션 타입별 빌더 메서드 생성
3. 인라인 이벤트 핸들러를 이벤트 위임으로 변경
4. 중복 템플릿 유틸리티 함수로 통합

## 참고사항

- 점진적 리팩토링 (Strangler Fig Pattern) 적용
- 기존 API 하위 호환성 유지
- 각 단계마다 테스트 및 검증
- 기능 깨짐 방지를 위한 단계적 접근
