// 최종 성능 테스트 (실제 위치 기반)
const imageMatcher = require('./src/imageMatch')

async function testFinalPerformance() {
  console.log('='.repeat(60))
  console.log('🎯 4단계 스마트 검색 최종 성능 테스트')
  console.log('='.repeat(60))

  const screenshotPath = './temp/test_screenshot.png'
  const templatePath = './temp/cropped_button.png'

  // 실제 버튼 위치: (714, 130)
  const actualPosition = { x: 714, y: 130, width: 387, height: 60 }

  console.log('\n📍 실제 버튼 위치:', actualPosition)
  console.log('='.repeat(60))

  // 테스트 1: 정확한 위치 (1단계에서 찾아야 함)
  console.log('\n\n테스트 1️⃣: 정확한 위치로 검색')
  console.log('-'.repeat(60))
  console.log('예상: 1단계에서 즉시 발견 (매우 빠름)\n')

  const start1 = Date.now()
  const result1 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.8,
    actualPosition  // 정확한 위치!
  )
  const time1 = Date.now() - start1

  console.log(`⏱️  소요 시간: ${time1}ms`)
  console.log(`✅ 결과: ${result1.found ? '찾음' : '못 찾음'}`)
  if (result1.found) {
    console.log(`📍 위치: (${result1.x}, ${result1.y})`)
    console.log(`🎯 신뢰도: ${(result1.confidence * 100).toFixed(2)}%`)
  }

  // 테스트 2: 세로로 50px 이동 (2단계에서 찾아야 함)
  console.log('\n\n테스트 2️⃣: 세로로 50px 스크롤된 경우')
  console.log('-'.repeat(60))
  console.log('예상: 2단계(세로 방향)에서 발견\n')

  const scrolledPosition = { x: 714, y: 180, width: 387, height: 60 }  // 50px 아래
  const start2 = Date.now()
  const result2 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.8,
    scrolledPosition
  )
  const time2 = Date.now() - start2

  console.log(`⏱️  소요 시간: ${time2}ms`)
  console.log(`✅ 결과: ${result2.found ? '찾음' : '못 찾음'}`)
  if (result2.found) {
    console.log(`📍 위치: (${result2.x}, ${result2.y})`)
    console.log(`🎯 신뢰도: ${(result2.confidence * 100).toFixed(2)}%`)
  }

  // 테스트 3: 가로로 30px 이동 (3단계에서 찾아야 함)
  console.log('\n\n테스트 3️⃣: 가로로 30px 이동한 경우')
  console.log('-'.repeat(60))
  console.log('예상: 3단계(가로 방향)에서 발견\n')

  const shiftedPosition = { x: 744, y: 130, width: 387, height: 60 }  // 30px 오른쪽
  const start3 = Date.now()
  const result3 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.8,
    shiftedPosition
  )
  const time3 = Date.now() - start3

  console.log(`⏱️  소요 시간: ${time3}ms`)
  console.log(`✅ 결과: ${result3.found ? '찾음' : '못 찾음'}`)
  if (result3.found) {
    console.log(`📍 위치: (${result3.x}, ${result3.y})`)
    console.log(`🎯 신뢰도: ${(result3.confidence * 100).toFixed(2)}%`)
  }

  // 테스트 4: 완전히 다른 위치 (4단계까지 가야 함)
  console.log('\n\n테스트 4️⃣: 완전히 다른 위치')
  console.log('-'.repeat(60))
  console.log('예상: 4단계(전체 검색)까지 진행\n')

  const farPosition = { x: 100, y: 500, width: 387, height: 60 }
  const start4 = Date.now()
  const result4 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.8,
    farPosition
  )
  const time4 = Date.now() - start4

  console.log(`⏱️  소요 시간: ${time4}ms`)
  console.log(`✅ 결과: ${result4.found ? '찾음' : '못 찾음'}`)
  if (result4.found) {
    console.log(`📍 위치: (${result4.x}, ${result4.y})`)
    console.log(`🎯 신뢰도: ${(result4.confidence * 100).toFixed(2)}%`)
  }

  // 비교: 전체 화면 검색 (매번 같은 시간)
  console.log('\n\n비교 🐢: 매번 전체 화면 검색')
  console.log('-'.repeat(60))
  const startFull = Date.now()
  const resultFull = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.8,
    null
  )
  const timeFull = Date.now() - startFull

  console.log(`⏱️  소요 시간: ${timeFull}ms`)

  // 성능 요약
  console.log('\n\n📊 최종 성능 요약')
  console.log('='.repeat(60))
  console.log(`1️⃣  정확한 위치:     ${time1}ms  (${(timeFull / time1).toFixed(1)}배 빠름)`)
  console.log(`2️⃣  세로 50px 이동:  ${time2}ms  (${(timeFull / time2).toFixed(1)}배 빠름)`)
  console.log(`3️⃣  가로 30px 이동:  ${time3}ms  (${(timeFull / time3).toFixed(1)}배 빠름)`)
  console.log(`4️⃣  완전히 다른 위치: ${time4}ms  (${(timeFull / time4).toFixed(1)}배 빠름)`)
  console.log(`🐢 전체 검색 (기준): ${timeFull}ms`)

  const avgSmart = (time1 + time2 + time3 + time4) / 4
  console.log(`\n평균: ${avgSmart.toFixed(0)}ms (전체 검색 대비 ${(timeFull / avgSmart).toFixed(1)}배 빠름)`)

  console.log('\n✨ 결론:')
  console.log('   • UI가 거의 안 움직이면 → 압도적으로 빠름 🚀')
  console.log('   • 조금 스크롤/이동 → 여전히 빠름 ⚡')
  console.log('   • 완전히 다른 화면 → 전체 검색 수행 🐢')
  console.log('   • 실제 사용 시 대부분 1-2단계에서 해결!')
}

testFinalPerformance().catch(console.error)
