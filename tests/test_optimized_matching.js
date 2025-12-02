// 최적화된 이미지 매칭 테스트
const imageMatcher = require('./src/imageMatch')

async function testOptimizedMatching() {
  console.log('='.repeat(60))
  console.log('이미지 매칭 성능 비교 테스트')
  console.log('='.repeat(60))

  const screenshotPath = './temp/test_screenshot.png'
  const templatePath = './temp/cropped_button.png'

  // 버튼이 원래 있던 위치
  const originalPosition = {
    x: 717,
    y: 670,
    width: 387,
    height: 60
  }

  console.log('\n📍 원본 크롭 위치:', originalPosition)

  // 테스트 1: 전체 화면 검색 (기존 방식)
  console.log('\n\n🐢 테스트 1: 전체 화면 검색 (느림)')
  console.log('-'.repeat(60))
  const start1 = Date.now()
  const result1 = await imageMatcher.findImage(screenshotPath, templatePath, 0.7, null)
  const time1 = Date.now() - start1

  console.log(`⏱️  소요 시간: ${time1}ms`)
  console.log(`✅ 결과: ${result1.found ? '찾음' : '못 찾음'}`)
  if (result1.found) {
    console.log(`📍 위치: (${result1.x}, ${result1.y})`)
    console.log(`🎯 신뢰도: ${(result1.confidence * 100).toFixed(2)}%`)
  }

  // 테스트 2: 크롭 위치 주변만 검색 (최적화)
  console.log('\n\n🚀 테스트 2: 크롭 위치 주변만 검색 (빠름)')
  console.log('-'.repeat(60))
  const start2 = Date.now()
  const result2 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    originalPosition  // 검색 영역 지정!
  )
  const time2 = Date.now() - start2

  console.log(`⏱️  소요 시간: ${time2}ms`)
  console.log(`✅ 결과: ${result2.found ? '찾음' : '못 찾음'}`)
  if (result2.found) {
    console.log(`📍 위치: (${result2.x}, ${result2.y})`)
    console.log(`🎯 신뢰도: ${(result2.confidence * 100).toFixed(2)}%`)
  }

  // 성능 비교
  console.log('\n\n📊 성능 비교')
  console.log('='.repeat(60))
  console.log(`전체 검색: ${time1}ms`)
  console.log(`영역 검색: ${time2}ms`)
  console.log(`속도 향상: ${(time1 / time2).toFixed(1)}배 빠름!`)
  console.log(`시간 절감: ${time1 - time2}ms (${((1 - time2/time1) * 100).toFixed(1)}%)`)

  console.log('\n✨ 결론: 크롭 위치 주변만 검색하면 훨씬 빠릅니다!')
}

testOptimizedMatching().catch(console.error)
