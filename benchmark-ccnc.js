// ccNC Image Format & FPS Benchmark
const { CCNCConnectionService } = require('./src/main/services/ccnc-connection.service');

const FORMATS = ['jpeg', 'png', 'bitmap'];
const TEST_FRAMES = 50; // Test with 50 frames per format
const FPS_TESTS = [10, 15, 20, 25, 30]; // FPS levels to test

async function benchmarkFormat(ccnc, format) {
  console.log(`\n📊 Testing format: ${format.toUpperCase()}`);

  const times = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < TEST_FRAMES; i++) {
    const startTime = Date.now();

    try {
      await ccnc.capture(0, 0, 1920, 720, { format });
      const elapsed = Date.now() - startTime;
      times.push(elapsed);
      successCount++;
    } catch (error) {
      errorCount++;
      console.log(`  ❌ Frame ${i + 1} failed: ${error.message}`);
    }
  }

  if (times.length === 0) {
    console.log(`  ⚠️  All frames failed!`);
    return null;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const theoreticalMaxFPS = 1000 / avgTime;

  console.log(`  ✅ Success: ${successCount}/${TEST_FRAMES} frames`);
  console.log(`  ⏱️  Average time: ${avgTime.toFixed(2)}ms`);
  console.log(`  ⚡ Min time: ${minTime}ms`);
  console.log(`  🐌 Max time: ${maxTime}ms`);
  console.log(`  🎯 Theoretical max FPS: ${theoreticalMaxFPS.toFixed(2)}`);

  return { format, avgTime, minTime, maxTime, theoreticalMaxFPS, successCount, errorCount };
}

async function testFPS(ccnc, format, targetFPS) {
  console.log(`\n🎬 Testing ${format} @ ${targetFPS} FPS...`);

  const interval = 1000 / targetFPS;
  let active = true;
  let frameCount = 0;
  let errorCount = 0;
  const startTime = Date.now();
  const testDuration = 5000; // Test for 5 seconds

  async function captureLoop() {
    if (!active) return;

    const loopStart = Date.now();

    try {
      await ccnc.capture(0, 0, 1920, 720, { format });
      frameCount++;
    } catch (error) {
      errorCount++;
    }

    const elapsed = Date.now() - loopStart;
    const waitTime = Math.max(0, interval - elapsed);

    if (Date.now() - startTime < testDuration) {
      setTimeout(() => captureLoop(), waitTime);
    } else {
      active = false;
      const actualFPS = (frameCount / (testDuration / 1000)).toFixed(2);
      const successRate = ((frameCount / (frameCount + errorCount)) * 100).toFixed(1);

      console.log(`  📈 Captured ${frameCount} frames in 5s (${actualFPS} FPS)`);
      console.log(`  ✅ Success rate: ${successRate}%`);

      if (errorCount === 0) {
        console.log(`  🎉 ${targetFPS} FPS is STABLE!`);
      } else {
        console.log(`  ⚠️  ${errorCount} errors occurred`);
      }
    }
  }

  await captureLoop();

  return { targetFPS, frameCount, errorCount, duration: testDuration };
}

async function main() {
  console.log('🚀 ccNC Performance Benchmark\n');
  console.log('Connecting to localhost:20000...');

  const ccnc = new CCNCConnectionService();

  try {
    await ccnc.connect('localhost', 20000);
    console.log('✅ Connected!\n');

    // Phase 1: Benchmark each format
    console.log('=' .repeat(60));
    console.log('PHASE 1: Format Benchmark');
    console.log('=' .repeat(60));

    const results = [];
    for (const format of FORMATS) {
      const result = await benchmarkFormat(ccnc, format);
      if (result) results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
    }

    // Sort by average time (fastest first)
    results.sort((a, b) => a.avgTime - b.avgTime);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 BENCHMARK RESULTS (Fastest to Slowest)');
    console.log('=' .repeat(60));
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.format.toUpperCase()}: ${r.avgTime.toFixed(2)}ms avg (max ${r.theoreticalMaxFPS.toFixed(1)} FPS)`);
    });

    // Phase 2: Test FPS with fastest format
    if (results.length > 0) {
      const fastestFormat = results[0].format;

      console.log('\n' + '=' .repeat(60));
      console.log(`PHASE 2: FPS Stress Test (${fastestFormat.toUpperCase()})`);
      console.log('=' .repeat(60));

      for (const fps of FPS_TESTS) {
        await testFPS(ccnc, fastestFormat, fps);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Benchmark Complete!');
    console.log('=' .repeat(60));

    await ccnc.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
