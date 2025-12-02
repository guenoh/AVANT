// 4단계 스마트 검색 테스트
const imageMatcher = require('./src/imageMatch')

async function testSmartSearch() {
  console.log('='.repeat(60))
  console.log('🎯 4단계 스마트 검색 성능 테스트')
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
  console.log('   → 1단계: 정확한 위치 (±10px, stride=1)')
  console.log('   → 2단계: 세로 방향 확장 (±200px, stride=5)')
  console.log('   → 3단계: 가로 방향 확장 (±100px, stride=5)')
  console.log('   → 4단계: 전체 화면 검색 (stride=10)')

  // 테스트 1: 스마트 검색 (4단계)
  console.log('\n\n🚀 스마트 검색 실행')
  console.log('='.repeat(60))
  const startSmart = Date.now()
  const resultSmart = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    originalPosition  // 검색 영역 지정 → 스마트 검색 활성화
  )
  const timeSmart = Date.now() - startSmart

  console.log('\n📊 스마트 검색 결과:')
  console.log(`⏱️  총 소요 시간: ${timeSmart}ms`)
  console.log(`✅ 결과: ${resultSmart.found ? '찾음' : '못 찾음'}`)
  if (resultSmart.found) {
    console.log(`📍 위치: (${resultSmart.x}, ${resultSmart.y})`)
    console.log(`🎯 신뢰도: ${(resultSmart.confidence * 100).toFixed(2)}%`)
  }

  // 테스트 2: 전체 화면 검색 (비교용)
  console.log('\n\n🐢 전체 화면 검색 (비교용)')
  console.log('='.repeat(60))
  const startFull = Date.now()
  const resultFull = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    null  // 검색 영역 없음 → 전체 화면 검색
  )
  const timeFull = Date.now() - startFull

  console.log(`⏱️  총 소요 시간: ${timeFull}ms`)
  console.log(`✅ 결과: ${resultFull.found ? '찾음' : '못 찾음'}`)
  if (resultFull.found) {
    console.log(`📍 위치: (${resultFull.x}, ${resultFull.y})`)
    console.log(`🎯 신뢰도: ${(resultFull.confidence * 100).toFixed(2)}%`)
  }

  // 성능 비교
  console.log('\n\n📊 성능 비교')
  console.log('='.repeat(60))
  console.log(`스마트 검색: ${timeSmart}ms`)
  console.log(`전체 검색:   ${timeFull}ms`)
  console.log(`속도 향상:   ${(timeFull / timeSmart).toFixed(1)}배 빠름!`)
  console.log(`시간 절감:   ${timeFull - timeSmart}ms (${((1 - timeSmart/timeFull) * 100).toFixed(1)}%)`)

  console.log('\n\n✨ 결론:')
  console.log('   • 4단계 스마트 검색이 훨씬 효율적입니다!')
  console.log('   • UI/UX 특성(세로 스크롤)을 고려한 검색 순서')
  console.log('   • 단계별 stride 조절로 속도와 정확도 균형')
}

testSmartSearch().catch(console.error)
