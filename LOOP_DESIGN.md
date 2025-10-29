# Loop Action System Design

## 개요
IF/ELSEIF/ELSE 시스템과 유사한 블록 기반 반복문 시스템

## 반복문 종류

### 1. 횟수 반복 (LOOP COUNT)
```
LOOP 5회
  액션1
  액션2
ENDLOOP
```
- 지정된 횟수만큼 반복
- 모달에서 횟수 입력 (1~1000)
- 현재 반복 횟수 표시 가능

### 2. 조건 반복 (LOOP WHILE)
```
LOOP WHILE (이미지 발견됨)
  액션1
  액션2
ENDLOOP
```
- 조건이 참인 동안 반복
- 조건 타입:
  - 이미지 발견됨
  - 이미지 발견 안됨
  - 변수 비교 (향후)

### 3. 무한 반복 (LOOP FOREVER)
```
LOOP FOREVER
  액션1
  IF 조건
    BREAK
  ENDIF
ENDLOOP
```
- 명시적으로 중단할 때까지 반복
- BREAK 액션과 함께 사용
- 안전장치: 최대 반복 횟수 제한 (기본 10000)

### 4. BREAK
```
LOOP 10회
  액션1
  IF 조건
    BREAK  <- 가장 가까운 LOOP 탈출
  ENDIF
  액션2
ENDLOOP
```
- 가장 가까운 LOOP 탈출
- LOOP 외부에서 사용 시 에러

### 5. CONTINUE (선택적)
```
LOOP 5회
  액션1
  IF 조건
    CONTINUE  <- 다음 반복으로
  ENDIF
  액션2
ENDLOOP
```
- 현재 반복 스킵, 다음 반복으로
- LOOP 외부에서 사용 시 에러

## 데이터 구조

```javascript
// 횟수 반복
{
  type: 'loop_count',
  count: 5,
  depth: 0,
  loopId: 'loop_uuid_1'
}

// 조건 반복
{
  type: 'loop_while',
  condition: {
    type: 'image_found',  // or 'image_not_found'
    imagePath: '/path/to/image.png',
    threshold: 0.8
  },
  depth: 0,
  loopId: 'loop_uuid_2'
}

// 무한 반복
{
  type: 'loop_forever',
  maxIterations: 10000,  // 안전장치
  depth: 0,
  loopId: 'loop_uuid_3'
}

// 종료
{
  type: 'endloop',
  depth: 0,
  loopId: 'loop_uuid_1'  // 쌍 추적
}

// 중단
{
  type: 'break'
}

// 계속
{
  type: 'continue'
}
```

## UI 구성

### 액션 카테고리 탭
```
[상호작용] [제어] [스마트] [ADB] [반복] <- 새로 추가
```

### 반복 탭 버튼들
```
[횟수 반복]   [조건 반복]   [무한 반복]
[중단 (BREAK)]   [계속 (CONTINUE)]
```

### 모달 - 횟수 반복
```
+---------------------------+
|    횟수 반복 추가          |
+---------------------------+
| 반복 횟수:                |
| [     5     ]  (1-1000)  |
|                           |
| [취소]        [확인]      |
+---------------------------+
```

### 모달 - 조건 반복
```
+---------------------------+
|    조건 반복 추가          |
+---------------------------+
| 조건 타입:                |
| ( ) 이미지 발견됨         |
| (•) 이미지 발견 안됨      |
|                           |
| 이미지:                   |
| [이미지 선택...]          |
|                           |
| 유사도: [0.8] (0.0-1.0)  |
|                           |
| [취소]        [확인]      |
+---------------------------+
```

## 색상 코딩

```css
/* LOOP 계열 - 주황색 */
.action-loop_count,
.action-loop_while,
.action-loop_forever {
  background: linear-gradient(135deg, #fff5e6 0%, #ffe0b3 100%);
  border-left: 4px solid #ff9800;
}

/* ENDLOOP - 회색 */
.action-endloop {
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  border-left: 4px solid #9e9e9e;
}

/* BREAK - 빨간색 */
.action-break {
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
  border-left: 4px solid #f44336;
}

/* CONTINUE - 파란색 */
.action-continue {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-left: 4px solid #2196f3;
}

/* Depth 별 색상 농도 */
.action-item[data-depth="1"] { opacity: 0.95; }
.action-item[data-depth="2"] { opacity: 0.9; }
.action-item[data-depth="3"] { opacity: 0.85; }
```

## 자동 페어링

### LOOP 추가 시
```javascript
addAction('loop_count') {
  const loopId = generateUUID();

  // LOOP 추가
  actions.push({
    type: 'loop_count',
    count: 5,
    depth: currentDepth,
    loopId: loopId
  });

  // 자동으로 ENDLOOP 추가
  actions.push({
    type: 'endloop',
    depth: currentDepth,
    loopId: loopId
  });
}
```

### 삭제 시
- LOOP 삭제 → 쌍인 ENDLOOP도 함께 삭제
- ENDLOOP 삭제 → 쌍인 LOOP도 함께 삭제
- 내부 액션들은 유지 (사용자 확인)

### 드래그 앤 드롭
- LOOP와 ENDLOOP는 세트로 이동
- LOOP 블록 내부로만 액션 이동 가능
- 블록 밖으로 이동 시 depth 조정

## 실행 로직

```javascript
async executeActions(actions) {
  const loopStack = [];  // 반복문 스택
  let index = 0;

  while (index < actions.length) {
    const action = actions[index];

    switch (action.type) {
      case 'loop_count':
      case 'loop_while':
      case 'loop_forever':
        // 반복문 시작 - 스택에 추가
        loopStack.push({
          loopId: action.loopId,
          startIndex: index,
          currentIteration: 0,
          maxIterations: getMaxIterations(action),
          action: action
        });
        index++;
        break;

      case 'endloop':
        // 반복문 종료 체크
        const currentLoop = loopStack[loopStack.length - 1];

        if (!currentLoop || currentLoop.loopId !== action.loopId) {
          throw new Error('LOOP/ENDLOOP 쌍이 맞지 않음');
        }

        currentLoop.currentIteration++;

        // 반복 계속 여부 확인
        const shouldContinue = await checkLoopCondition(currentLoop);

        if (shouldContinue) {
          // 반복 계속 - LOOP 시작으로 돌아감
          index = currentLoop.startIndex + 1;
        } else {
          // 반복 종료 - 스택에서 제거
          loopStack.pop();
          index++;
        }
        break;

      case 'break':
        // 가장 가까운 LOOP 탈출
        if (loopStack.length === 0) {
          throw new Error('BREAK는 LOOP 내부에서만 사용 가능');
        }

        const breakLoop = loopStack.pop();
        // ENDLOOP 위치 찾기
        index = findMatchingEndLoop(actions, breakLoop.loopId) + 1;
        break;

      case 'continue':
        // 다음 반복으로
        if (loopStack.length === 0) {
          throw new Error('CONTINUE는 LOOP 내부에서만 사용 가능');
        }

        const continueLoop = loopStack[loopStack.length - 1];
        index = findMatchingEndLoop(actions, continueLoop.loopId);
        break;

      default:
        // 일반 액션 실행
        await executeAction(action);
        index++;
    }
  }
}

function getMaxIterations(loopAction) {
  switch (loopAction.type) {
    case 'loop_count':
      return loopAction.count;
    case 'loop_forever':
      return loopAction.maxIterations || 10000;
    case 'loop_while':
      return 10000;  // 안전장치
    default:
      return 1;
  }
}

async function checkLoopCondition(currentLoop) {
  const { action, currentIteration, maxIterations } = currentLoop;

  // 최대 반복 횟수 체크
  if (currentIteration >= maxIterations) {
    return false;
  }

  switch (action.type) {
    case 'loop_count':
      return currentIteration < action.count;

    case 'loop_forever':
      return true;

    case 'loop_while':
      // 조건 체크
      return await checkCondition(action.condition);

    default:
      return false;
  }
}

async function checkCondition(condition) {
  switch (condition.type) {
    case 'image_found':
      const found = await findImage(condition.imagePath, condition.threshold);
      return found !== null;

    case 'image_not_found':
      const notFound = await findImage(condition.imagePath, condition.threshold);
      return notFound === null;

    default:
      return false;
  }
}
```

## 검증

### 추가 시 검증
```javascript
function validateLoopAction(actions, newAction, insertIndex) {
  if (newAction.type === 'break' || newAction.type === 'continue') {
    // LOOP 내부인지 확인
    const isInsideLoop = checkIfInsideLoop(actions, insertIndex);
    if (!isInsideLoop) {
      throw new Error('BREAK/CONTINUE는 LOOP 내부에서만 사용 가능');
    }
  }

  // 중첩 레벨 제한 (예: 최대 5단계)
  const depth = calculateDepth(actions, insertIndex);
  if (depth > 5) {
    throw new Error('최대 중첩 레벨(5)을 초과했습니다');
  }
}
```

### 실행 전 검증
```javascript
function validateLoopStructure(actions) {
  const loopStack = [];

  for (const action of actions) {
    if (action.type.startsWith('loop_')) {
      loopStack.push(action.loopId);
    } else if (action.type === 'endloop') {
      const lastLoopId = loopStack.pop();
      if (lastLoopId !== action.loopId) {
        throw new Error('LOOP/ENDLOOP 쌍이 맞지 않습니다');
      }
    }
  }

  if (loopStack.length > 0) {
    throw new Error('닫히지 않은 LOOP가 있습니다');
  }
}
```

## 디스플레이

```javascript
function getLoopDescription(action) {
  switch (action.type) {
    case 'loop_count':
      return `LOOP ${action.count}회`;

    case 'loop_while':
      const conditionText = action.condition.type === 'image_found'
        ? '이미지 발견됨'
        : '이미지 발견 안됨';
      return `LOOP WHILE (${conditionText})`;

    case 'loop_forever':
      return `LOOP FOREVER`;

    case 'endloop':
      return `ENDLOOP`;

    case 'break':
      return `BREAK (반복 중단)`;

    case 'continue':
      return `CONTINUE (다음 반복)`;
  }
}
```

## 실행 시 로그

```
[INFO] LOOP 5회 시작
[INFO]   액션1 실행
[INFO]   액션2 실행
[INFO] ENDLOOP (1/5)
[INFO]   액션1 실행
[INFO]   액션2 실행
[INFO] ENDLOOP (2/5)
...
[INFO] BREAK - 반복 중단
[INFO] LOOP 종료 (3/5회 완료)
```

## 구현 우선순위

### Phase 1: 기본 반복문
1. 횟수 반복 (LOOP COUNT)
2. ENDLOOP 자동 생성
3. 색상 코딩
4. 기본 실행 로직

### Phase 2: 제어문
1. BREAK
2. 중첩 반복문 지원
3. 검증 로직

### Phase 3: 고급 기능
1. 조건 반복 (LOOP WHILE)
2. 무한 반복 (LOOP FOREVER)
3. CONTINUE
4. 현재 반복 횟수 변수

## 예제 시나리오

### 예제 1: 아이템 수집 (횟수 반복)
```
LOOP 10회
  탭 (아이템 위치)
  대기 0.5초
  탭 (확인 버튼)
  대기 1초
ENDLOOP
```

### 예제 2: 특정 화면 대기 (조건 반복)
```
LOOP WHILE (로딩 이미지 발견됨)
  대기 1초
ENDLOOP
탭 (시작 버튼)
```

### 예제 3: 무한 파밍 (무한 반복 + BREAK)
```
LOOP FOREVER
  탭 (전투 시작)
  대기 30초

  IF (승리 이미지 발견됨)
    탭 (확인)
  ELSEIF (패배 이미지 발견됨)
    BREAK
  ENDIF

  대기 2초
ENDLOOP
```

### 예제 4: 중첩 반복
```
LOOP 3회
  탭 (스테이지 선택)

  LOOP 5회
    탭 (전투)
    대기 10초

    IF (체력 부족)
      BREAK
    ENDIF
  ENDLOOP

  탭 (나가기)
ENDLOOP
```

## 주의사항

1. **무한루프 방지**: 모든 반복문에 최대 반복 횟수 제한
2. **메모리 관리**: 반복문 스택 크기 제한
3. **사용자 중단**: 실행 중 언제든 중단 가능
4. **에러 처리**: 반복문 내부 에러 시 전체 중단 옵션
5. **성능**: 대량 반복 시 화면 업데이트 주기 조절
