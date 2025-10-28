# Design Consistency Audit - Vision Auto v2

## 분석 날짜: 2025-10-28

## 현재 확인된 문제점

### 1. 버튼 스타일 불일치

#### 문제점
- 여러 종류의 버튼 클래스가 존재하지만 일관성이 부족
- 폰트 크기, weight, 패딩, border-radius가 제각각

#### 버튼 종류 및 현재 스타일

**A. 기본 버튼 (.btn)**
- 위치: components.css
- 스타일: 기본 버튼 스타일
- 문제: 일관된 크기/간격 부족

**B. 액션 버튼 (.btn-action)**
- 위치: components.css:99
- 용도: 초기화, 저장, 실행 버튼
- 스타일:
  ```css
  padding: var(--spacing-2) var(--spacing-4);  /* 8px 16px */
  font-size: var(--font-size-sm);               /* 14px */
  font-weight: 600;
  min-width: 70px;
  ```

**C. 미니 탭 (.mini-tab)**
- 위치: unified-layout.css:415
- 용도: 추가/관리 탭
- 스타일:
  ```css
  padding: var(--spacing-2) var(--spacing-3);  /* 8px 12px */
  font-size: 0.75rem;                          /* 12px */
  font-weight: 500;
  ```

**D. 액션 탭 (.action-tab)**
- 위치: unified-layout.css:500
- 용도: 상호작용/제어/스마트/ADB 탭
- 스타일:
  ```css
  padding: var(--spacing-2) var(--spacing-3);  /* 8px 12px */
  font-size: 0.75rem;                          /* 12px */
  font-weight: 500;
  ```

**E. 액션 추가 버튼 (.action-btn)**
- 위치: unified-layout.css:538
- 용도: 탭, 스와이프, 이미지 매칭 등
- 스타일:
  ```css
  padding: var(--spacing-2) var(--spacing-3);  /* 8px 12px */
  font-size: 0.75rem;                          /* 12px */
  font-weight: 500;
  ```

**F. 액션 아이템 버튼 (.btn-edit, .btn-settings, .btn-remove)**
- 위치: unified-layout.css:639, 669, 692
- 용도: 액션 아이템 내 설정/이름변경/삭제
- 스타일:
  ```css
  padding: 4px 8px;                            /* 4px 8px */
  font-size: 11px;                             /* 11px */
  font-weight: 500;
  ```

**G. 모달 버튼**
- 위치: 모달 내 취소/저장 버튼
- 현재 스타일: 확인 필요

### 2. 폰트 크기 불일치

현재 사용 중인 폰트 크기:
- 11px (액션 아이템 버튼)
- 12px (0.75rem - 탭, 액션 버튼)
- 14px (0.875rem - 액션 버튼)
- 16px (기본)

**권장 통일 기준:**
- 주요 버튼: 14px (var(--font-size-sm))
- 보조/소형 버튼: 13px
- 액션 아이템 버튼: 12px (var(--font-size-xs))

### 3. Border Radius 불일치

현재 사용 중인 border-radius:
- --radius-sm: 4px
- --radius-md: 6px
- --radius-lg: 8px

**문제:**
일부 요소는 하드코딩된 값 사용

### 4. Spacing/Padding 불일치

**문제점:**
- 버튼마다 다른 패딩 사용
- 일부는 px 단위 직접 사용 (4px 8px)
- 일부는 CSS 변수 사용

**권장:**
모든 spacing을 CSS 변수로 통일

### 5. Transition/Hover 효과 불일치

**문제점:**
- 일부 버튼은 transition 있음
- 일부는 없음
- hover 효과 일관성 부족

### 6. 색상 사용 불일치

**문제점:**
- Primary 색상: 일관적으로 사용
- 하지만 hover/active 상태 일관성 부족
- 일부 하드코딩된 색상 존재

## 개선 방안

### Phase 1: 버튼 시스템 통합

1. **버튼 크기 표준화**
   ```css
   .btn-xs:  padding: 4px 8px;   font-size: 12px;
   .btn-sm:  padding: 6px 12px;  font-size: 13px;
   .btn-md:  padding: 8px 16px;  font-size: 14px;
   .btn-lg:  padding: 10px 20px; font-size: 16px;
   ```

2. **버튼 스타일 변형 표준화**
   - btn-primary (주요 액션)
   - btn-secondary (보조 액션)
   - btn-ghost (테두리만)
   - btn-danger (삭제 등)

3. **Transition 통일**
   ```css
   transition: all var(--transition-base);
   ```

4. **Border Radius 통일**
   - 버튼: var(--radius-md) - 6px
   - 탭: var(--radius-sm) - 4px

### Phase 2: 탭 시스템 통합

1. **탭 스타일 통일**
   - mini-tab과 action-tab 스타일 일관성
   - Active 상태 표시 방식 통일
   - Hover 효과 통일

2. **탭 크기 표준화**
   ```css
   padding: var(--spacing-2) var(--spacing-4);
   font-size: var(--font-size-sm);
   font-weight: var(--font-weight-medium);
   ```

### Phase 3: 모달 스타일 통합

1. **모달 버튼 표준화**
   - 취소: btn btn-secondary
   - 저장/확인: btn btn-primary
   - 크기: btn-md

2. **모달 레이아웃 일관성**
   - 패딩: var(--spacing-6)
   - Border radius: var(--radius-lg)
   - Shadow: var(--shadow-xl)

### Phase 4: 액션 아이템 스타일 통합

1. **액션 버튼 크기 통일**
   ```css
   .btn-edit, .btn-settings, .btn-remove {
     padding: var(--spacing-1) var(--spacing-2);
     font-size: var(--font-size-xs);
     font-weight: var(--font-weight-medium);
   }
   ```

2. **Hover 효과 통일**

## 우선순위

### High Priority
1. ✅ 메인 액션 버튼 (초기화, 저장, 실행) - 완료
2. ✅ 모달 버튼 스타일 통일 - 완료
3. ✅ 탭 시스템 통일 - 완료

### Medium Priority
4. ✅ 액션 아이템 버튼 스타일 미세 조정 - 완료
5. Input/Select 스타일 통일
6. 전반적인 spacing 점검

### Low Priority
7. ✅ 애니메이션 효과 통일 - 완료 (모달 fadeIn, slideUp)
8. 다크 테마 대응 확인

## 다음 단계

1. ✅ Git 초기화 및 현재 상태 커밋
2. ✅ 디자인 문제 분석 및 문서화
3. ✅ CSS 변수 추가/수정
4. ✅ 버튼 시스템 리팩토링
5. ✅ 탭 시스템 리팩토링
6. ✅ 모달 스타일 통일
7. [ ] 테스트 및 검증
8. ✅ 커밋 및 문서화

## 완료된 작업 (2025-10-28)

### Phase 1: CSS 변수 추가 ✅
- base.css에 버튼 크기 표준 변수 추가
  - --btn-padding-xs/sm/md/lg
  - --btn-font-xs/sm/md/lg
  - --btn-height-xs/sm/md/lg
  - --btn-min-width-xs/sm/md/lg
- --font-size-md (13px) 추가

### Phase 2: 버튼 시스템 통합 ✅
- .btn 기본 클래스 표준화
- .btn-xs, .btn-sm, .btn-md, .btn-lg 크기 변형 구현
- .btn-primary, .btn-secondary, .btn-ghost, .btn-danger 스타일 변형
- .btn-action 메인 액션 버튼 통일
- 모든 버튼에 일관된 transition 적용

### Phase 3: 탭 시스템 통합 ✅
- mini-tabs 레이아웃 개선 (left/right 분리)
- .mini-tab 스타일 표준화
- .action-tab 스타일 통일
- .action-btn 스타일 일관성 확보
- 액션 아이템 버튼 (.btn-edit, .btn-settings, .btn-remove) 표준화

### Phase 4: 모달 스타일 통합 ✅
- 모달 애니메이션 추가 (fadeIn, slideUp)
- Backdrop blur 효과 적용
- 일관된 spacing (CSS 변수 사용)
- Close 버튼 hover 효과 개선
- 모달 버튼 크기 통일 (btn-md)

### 개선 효과
- 폰트 크기 일관성: 11px, 12px, 14px, 16px → xs(12px), sm(13px), md(14px), lg(16px)
- 패딩 일관성: 하드코딩 px 값 → CSS 변수 사용
- Transition 일관성: 모든 인터랙티브 요소에 통일된 transition
- Border radius 일관성: var(--radius-sm/md/lg) 사용
- 애니메이션 효과: 모달 부드러운 등장 효과
