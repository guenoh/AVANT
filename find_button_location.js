// 버튼의 실제 위치 찾기
const imageMatcher = require('./src/imageMatch')

async function findActualLocation() {
  console.log('='.repeat(60))
  console.log('🔍 버튼의 실제 위치 찾기')
  console.log('='.repeat(60))

  const screenshotPath = './temp/test_screenshot.png'
  const templatePath = './temp/cropped_button.png'

  console.log('\n전체 화면에서 버튼 검색 중...\n')

  const result = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.7,
    null  // 전체 화면 검색
  )

  if (result.found) {
    console.log('✅ 버튼 발견!')
    console.log(`📍 실제 위치: (${result.x}, ${result.y})`)
    console.log(`🎯 신뢰도: ${(result.confidence * 100).toFixed(2)}%`)

    console.log('\n💡 이 위치를 사용하여 다시 테스트하세요:')
    console.log(`const exactPosition = { x: ${result.x}, y: ${result.y}, width: 387, height: 60 }`)
  } else {
    console.log('❌ 버튼을 찾지 못했습니다')
  }
}

findActualLocation().catch(console.error)
