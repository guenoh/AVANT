// 이미지 크롭 기능 테스트
const Jimp = require('jimp')

async function testCrop() {
  console.log('이미지 크롭 테스트 시작...')

  // 스크린샷 읽기
  const image = await Jimp.read('./temp/test_screenshot.png')
  console.log(`원본 이미지: ${image.bitmap.width}x${image.bitmap.height}`)

  // "블루투스 연결" 버튼 영역 크롭 (대략적인 위치)
  // 화면을 보니 중앙 하단에 버튼이 있음
  const buttonX = 523
  const buttonY = 640
  const buttonWidth = 387
  const buttonHeight = 60

  const cropped = image.crop(buttonX, buttonY, buttonWidth, buttonHeight)

  // 크롭된 이미지 저장
  await cropped.writeAsync('./temp/cropped_button.png')
  console.log('크롭 완료: ./temp/cropped_button.png')
  console.log(`크롭 크기: ${buttonWidth}x${buttonHeight}`)
}

testCrop().catch(console.error)
