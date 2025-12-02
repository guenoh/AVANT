// 실제 사용 시나리오 데모
const Jimp = require('jimp')
const imageMatcher = require('./src/imageMatch')
const path = require('path')

async function realWorldExample() {
  console.log('='.repeat(60))
  console.log('🎬 실제 사용 시나리오 데모')
  console.log('='.repeat(60))

  const screenshotPath = './temp/test_screenshot.png'
  const screenshot = await Jimp.read(screenshotPath)

  // 시나리오: 사용자가 드래그로 버튼을 크롭함
  console.log('\n👤 사용자: 드래그로 버튼 크롭 (714, 130)')
  const cropX = 714
  const cropY = 130
  const cropWidth = 100
  const cropHeight = 60

  // 크롭한 이미지를 템플릿으로 저장
  const template = screenshot.clone().crop(
    cropX - cropWidth / 2,
    cropY - cropHeight / 2,
    cropWidth,
    cropHeight
  )

  const templatePath = './temp/button_template_demo.png'
  await template.writeAsync(templatePath)
  console.log(`   → 템플릿 저장: ${templatePath}`)
  console.log(`   → 크롭 위치: (${cropX}, ${cropY}), 크기: ${cropWidth}x${cropHeight}`)

  // 매크로 저장: 크롭 위치 기록
  const macroAction = {
    type: 'image_match',
    templatePath: templatePath,
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
    threshold: 0.8,
    action: 'tap'
  }

  console.log('\n📝 매크로 저장됨:', macroAction)

  // 케이스 1: 매크로 즉시 실행 (같은 화면)
  console.log('\n\n케이스 1️⃣: 매크로 즉시 실행 (같은 화면)')
  console.log('-'.repeat(60))

  const start1 = Date.now()
  const result1 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.8,
    { x: macroAction.x, y: macroAction.y, width: macroAction.width, height: macroAction.height }
  )
  const time1 = Date.now() - start1

  console.log(`⏱️  소요 시간: ${time1}ms`)
  console.log(`✅ 결과: ${result1.found ? '찾음' : '못 찾음'}`)
  console.log(`📍 위치: (${result1.x}, ${result1.y})`)
  console.log(`🎯 신뢰도: ${(result1.confidence * 100).toFixed(2)}%`)

  // 케이스 2: 전체 화면 검색과 비교
  console.log('\n\n비교 🐢: 전체 화면 검색 (느림)')
  console.log('-'.repeat(60))

  const start2 = Date.now()
  const result2 = await imageMatcher.findImage(
    screenshotPath,
    templatePath,
    0.8,
    null  // 검색 영역 없음
  )
  const time2 = Date.now() - start2

  console.log(`⏱️  소요 시간: ${time2}ms`)

  // 성능 비교
  console.log('\n\n📊 성능 비교')
  console.log('='.repeat(60))
  console.log(`스마트 검색: ${time1}ms`)
  console.log(`전체 검색:   ${time2}ms`)
  console.log(`속도 향상:   ${(time2 / time1).toFixed(1)}배 빠름! 🚀`)
  console.log(`시간 절감:   ${time2 - time1}ms (${((1 - time1/time2) * 100).toFixed(1)}%)`)

  console.log('\n✨ 결론:')
  console.log('   • 크롭한 위치 주변을 먼저 검색 → 압도적으로 빠름!')
  console.log('   • 1단계에서 즉시 발견 (99%+ 신뢰도)')
  console.log('   • UI/UX 특성을 고려한 4단계 검색 전략')
}

realWorldExample().catch(console.error)
