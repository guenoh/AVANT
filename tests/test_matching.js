// 이미지 매칭 기능 테스트
const imageMatcher = require('./src/imageMatch')

async function testMatching() {
  console.log('이미지 매칭 테스트 시작...\n')

  // 스크린샷에서 크롭된 버튼 찾기
  const screenshotPath = './temp/test_screenshot.png'
  const templatePath = './temp/cropped_button.png'

  console.log('템플릿 이미지로 화면에서 매칭 시도...')
  console.log('(순수 JavaScript 구현이라 시간이 좀 걸릴 수 있습니다)')

  const startTime = Date.now()
  const result = await imageMatcher.findImage(screenshotPath, templatePath, 0.7)
  const elapsed = Date.now() - startTime

  console.log(`\n실행 시간: ${elapsed}ms`)
  console.log('\n결과:')
  console.log(`- 발견 여부: ${result.found ? '✅ 찾음' : '❌ 못 찾음'}`)
  console.log(`- 위치: (${result.x}, ${result.y})`)
  console.log(`- 신뢰도: ${(result.confidence * 100).toFixed(2)}%`)

  if (result.found) {
    console.log('\n✅ 이미지 매칭 성공!')
    console.log(`이 위치를 클릭하면: adb shell input tap ${result.x} ${result.y}`)
  }
}

testMatching().catch(console.error)
