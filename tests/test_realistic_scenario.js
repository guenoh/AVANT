// 실제 사용 시나리오 테스트
const imageMatcher = require('./src/imageMatch')

async function testRealisticScenario() {
  console.log('='.repeat(60))
  console.log('📱 실제 사용 시나리오 테스트')
  console.log('='.repeat(60))

  const screenshotPath = './temp/test_screenshot.png'
  const templatePath = './temp/cropped_button.png'

  // 시나리오 1: 정확한 위치에 그대로 있음 (가장 일반적)
  console.log('\n\n시나리오 1️⃣: UI가 그대로 있을 때')
  console.log('-'.repeat(60))
  const exactPosition = { x: 910, y: 700, width: 387, height: 60 }
  console.log(`이전 매칭 위치: (${exactPosition.x}, ${exactPosition.y})`)

  const start1 = Date.now()
  const result1 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    exactPosition
  )
  const time1 = Date.now() - start1

  console.log(`⏱️  소요 시간: ${time1}ms`)
  console.log(`✅ 결과: ${result1.found ? '찾음' : '못 찾음'}`)
  if (result1.found) {
    console.log(`📍 위치: (${result1.x}, ${result1.y})`)
    console.log(`🎯 신뢰도: ${(result1.confidence * 100).toFixed(2)}%`)
  }

  // 시나리오 2: 살짝 스크롤됨 (세로 ±100px)
  console.log('\n\n시나리오 2️⃣: 조금 스크롤됐을 때')
  console.log('-'.repeat(60))
  const scrolledPosition = { x: 910, y: 600, width: 387, height: 60 }
  console.log(`이전 매칭 위치: (${scrolledPosition.x}, ${scrolledPosition.y})`)
  console.log('(실제로는 100px 아래로 스크롤됨)')

  const start2 = Date.now()
  const result2 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    scrolledPosition
  )
  const time2 = Date.now() - start2

  console.log(`⏱️  소요 시간: ${time2}ms`)
  console.log(`✅ 결과: ${result2.found ? '찾음' : '못 찾음'}`)
  if (result2.found) {
    console.log(`📍 위치: (${result2.x}, ${result2.y})`)
    console.log(`🎯 신뢰도: ${(result2.confidence * 100).toFixed(2)}%`)
  }

  // 시나리오 3: 많이 스크롤됨 (세로 ±200px)
  console.log('\n\n시나리오 3️⃣: 많이 스크롤됐을 때')
  console.log('-'.repeat(60))
  const farScrolledPosition = { x: 910, y: 500, width: 387, height: 60 }
  console.log(`이전 매칭 위치: (${farScrolledPosition.x}, ${farScrolledPosition.y})`)
  console.log('(실제로는 200px 아래로 스크롤됨)')

  const start3 = Date.now()
  const result3 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    farScrolledPosition
  )
  const time3 = Date.now() - start3

  console.log(`⏱️  소요 시간: ${time3}ms`)
  console.log(`✅ 결과: ${result3.found ? '찾음' : '못 찾음'}`)
  if (result3.found) {
    console.log(`📍 위치: (${result3.x}, ${result3.y})`)
    console.log(`🎯 신뢰도: ${(result3.confidence * 100).toFixed(2)}%`)
  }

  // 시나리오 4: 완전히 다른 화면
  console.log('\n\n시나리오 4️⃣: 완전히 다른 화면일 때')
  console.log('-'.repeat(60))
  const differentPosition = { x: 100, y: 100, width: 387, height: 60 }
  console.log(`이전 매칭 위치: (${differentPosition.x}, ${differentPosition.y})`)
  console.log('(완전히 다른 화면으로 이동)')

  const start4 = Date.now()
  const result4 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    differentPosition
  )
  const time4 = Date.now() - start4

  console.log(`⏱️  소요 시간: ${time4}ms`)
  console.log(`✅ 결과: ${result4.found ? '찾음' : '못 찾음'}`)
  if (result4.found) {
    console.log(`📍 위치: (${result4.x}, ${result4.y})`)
    console.log(`🎯 신뢰도: ${(result4.confidence * 100).toFixed(2)}%`)
  }

  // 전체 화면 검색 (비교용)
  console.log('\n\n비교 🐢: 전체 화면 검색 (매번)')
  console.log('-'.repeat(60))
  const startFull = Date.now()
  const resultFull = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    null
  )
  const timeFull = Date.now() - startFull

  console.log(`⏱️  소요 시간: ${timeFull}ms`)
  console.log(`✅ 결과: ${resultFull.found ? '찾음' : '못 찾음'}`)

  // 평균 성능 비교
  console.log('\n\n📊 성능 요약')
  console.log('='.repeat(60))
  const avgSmart = (time1 + time2 + time3 + time4) / 4
  console.log(`스마트 검색 평균: ${avgSmart.toFixed(0)}ms`)
  console.log(`  • 시나리오 1 (그대로): ${time1}ms`)
  console.log(`  • 시나리오 2 (조금): ${time2}ms`)
  console.log(`  • 시나리오 3 (많이): ${time3}ms`)
  console.log(`  • 시나리오 4 (완전히): ${time4}ms`)
  console.log(`전체 검색 (매번): ${timeFull}ms`)
  console.log(`\n평균 ${(timeFull / avgSmart).toFixed(1)}배 빠름!`)

  console.log('\n✨ 결론:')
  console.log('   • UI가 거의 안 움직이면 스마트 검색이 압도적으로 빠름')
  console.log('   • 스크롤된 경우에도 2-3단계에서 빠르게 발견')
  console.log('   • 최악의 경우에만 전체 화면 검색 수행')
}

testRealisticScenario().catch(console.error)
