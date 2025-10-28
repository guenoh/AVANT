/**
 * Comprehensive test suite for block-based macro system
 * Tests all components: blocks, executor, factory, and integration
 */

const { getBlockFactory } = require('./src/main/services/blocks/BlockFactory');
const MacroExecutor = require('./src/main/services/MacroExecutor');
const { BLOCK_TYPES, BLOCK_CATEGORIES } = require('./src/shared/block-types');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

// Test suite class
class BlockSystemTestSuite {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.factory = null;
  }

  /**
   * Initialize test suite
   */
  async init() {
    console.log(`${colors.blue}=== Block System Test Suite ===${colors.reset}\n`);

    // Initialize factory
    this.factory = getBlockFactory();
    await this.factory.init();

    console.log(`Factory initialized with ${this.factory.getAvailableTypes().length} block types\n`);
  }

  /**
   * Add a test
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log(`Running ${this.tests.length} tests...\n`);

    for (const test of this.tests) {
      try {
        console.log(`${colors.gray}Testing: ${test.name}${colors.reset}`);
        await test.fn();
        this.passed++;
        console.log(`${colors.green}✓ ${test.name}${colors.reset}\n`);
      } catch (error) {
        this.failed++;
        console.log(`${colors.red}✗ ${test.name}${colors.reset}`);
        console.log(`  Error: ${error.message}\n`);
      }
    }

    // Print summary
    this.printSummary();
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log(`${colors.blue}=== Test Summary ===${colors.reset}`);
    console.log(`Total: ${this.tests.length}`);
    console.log(`${colors.green}Passed: ${this.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.failed}${colors.reset}`);

    if (this.failed === 0) {
      console.log(`\n${colors.green}All tests passed! ✨${colors.reset}`);
    } else {
      console.log(`\n${colors.red}Some tests failed. Please review.${colors.reset}`);
    }
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Assert equal helper
   */
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
  }
}

// Create test suite
const suite = new BlockSystemTestSuite();

// Test 1: Block Factory
suite.test('Block Factory - Create all block types', async () => {
  const types = suite.factory.getAvailableTypes();
  suite.assert(types.length > 0, 'Should have registered block types');

  for (const type of types) {
    const block = suite.factory.createBlock(type, {});
    suite.assert(block !== null, `Should create ${type} block`);
    suite.assert(block.type === type, `Block type should be ${type}`);
  }
});

// Test 2: Block Parameters and Validation
suite.test('Block validation - TAP block parameters', async () => {
  const tapBlock = suite.factory.createBlock('TAP', { x: 100, y: 200 });

  const validResult = tapBlock.validate();
  suite.assert(validResult.valid === true, 'Valid parameters should pass validation');

  const invalidBlock = suite.factory.createBlock('TAP', { x: 100 }); // Missing y
  const invalidResult = invalidBlock.validate();
  suite.assert(invalidResult.valid === false, 'Invalid parameters should fail validation');
});

// Test 3: Block Connections
suite.test('Block connections - Linear flow', async () => {
  const tap1 = suite.factory.createBlock('TAP', { x: 100, y: 100 });
  const wait = suite.factory.createBlock('WAIT', { milliseconds: 1000 });
  const tap2 = suite.factory.createBlock('TAP', { x: 200, y: 200 });

  tap1.connectTo(wait);
  wait.connectTo(tap2);

  suite.assert(tap1.next === wait, 'tap1 should connect to wait');
  suite.assert(wait.next === tap2, 'wait should connect to tap2');
  suite.assert(tap2.next === null, 'tap2 should have no next');
});

// Test 4: Conditional Flow
suite.test('Block connections - Conditional branching', async () => {
  const ifBlock = suite.factory.createBlock('IF_IMAGE', {
    image: 'test.png',
    confidence: 0.8
  });
  const trueBranch = suite.factory.createBlock('TAP', { x: 100, y: 100 });
  const falseBranch = suite.factory.createBlock('WAIT', { milliseconds: 2000 });

  ifBlock.connectTo(trueBranch, 'true');
  ifBlock.connectTo(falseBranch, 'false');

  suite.assert(ifBlock.onTrue === trueBranch, 'True branch should be connected');
  suite.assert(ifBlock.onFalse === falseBranch, 'False branch should be connected');
});

// Test 5: Loop Block
suite.test('Loop block - Body connection', async () => {
  const loop = suite.factory.createBlock('LOOP', { count: 5 });
  const body = suite.factory.createBlock('SWIPE', {
    startX: 500,
    startY: 1000,
    endX: 500,
    endY: 500,
    duration: 500
  });
  const after = suite.factory.createBlock('WAIT', { milliseconds: 1000 });

  loop.connectBody(body);
  loop.connectTo(after);

  suite.assert(loop.bodyBlock === body, 'Loop body should be connected');
  suite.assert(loop.next === after, 'After-loop block should be connected');
});

// Test 6: Parallel Block
suite.test('Parallel block - Multiple branches', async () => {
  const parallel = suite.factory.createBlock('PARALLEL', {
    waitAll: true,
    requireAll: false
  });

  const branch1 = suite.factory.createBlock('TAP', { x: 100, y: 100 });
  const branch2 = suite.factory.createBlock('TAP', { x: 200, y: 200 });
  const branch3 = suite.factory.createBlock('TAP', { x: 300, y: 300 });

  parallel.addBranch(branch1);
  parallel.addBranch(branch2);
  parallel.addBranch(branch3);

  suite.assertEqual(parallel.branches.length, 3, 'Should have 3 branches');
});

// Test 7: Macro Creation from JSON
suite.test('Macro creation from JSON', async () => {
  const macroJSON = {
    name: 'Test Macro',
    blocks: [
      { id: 'b1', type: 'TAP', params: { x: 100, y: 100 } },
      { id: 'b2', type: 'WAIT', params: { milliseconds: 1000 } },
      { id: 'b3', type: 'TAP', params: { x: 200, y: 200 } }
    ],
    startBlockId: 'b1'
  };

  // Add connections
  macroJSON.blocks[0].connections = { next: 'b2' };
  macroJSON.blocks[1].connections = { next: 'b3' };

  const macro = suite.factory.createMacroFromJSON(macroJSON);

  suite.assert(macro.name === 'Test Macro', 'Macro name should match');
  suite.assert(macro.blocks.length === 3, 'Should have 3 blocks');
  suite.assert(macro.startBlock.id === 'b1', 'Start block should be b1');
  suite.assert(macro.blocks[0].next === macro.blocks[1], 'Blocks should be connected');
});

// Test 8: Macro Executor
suite.test('Macro executor - Simple execution', async () => {
  const macro = {
    name: 'Simple Test',
    startBlock: suite.factory.createBlock('WAIT', { milliseconds: 100 })
  };

  const executor = new MacroExecutor({
    debugMode: false,
    logLevel: 'error'
  });

  // Mock context
  const context = {
    device: {
      executeShellCommand: async (cmd) => ({ success: true })
    }
  };

  const result = await executor.execute(macro, context);

  suite.assert(result.success === true, 'Execution should succeed');
  suite.assert(result.stats.blocksExecuted === 1, 'Should execute 1 block');
});

// Test 9: Circular Reference Detection
suite.test('Circular reference detection', async () => {
  const block1 = suite.factory.createBlock('TAP', { x: 100, y: 100 });
  const block2 = suite.factory.createBlock('WAIT', { milliseconds: 500 });
  const block3 = suite.factory.createBlock('TAP', { x: 200, y: 200 });

  block1.connectTo(block2);
  block2.connectTo(block3);
  block3.connectTo(block1); // Creates circular reference

  const hasCircular = block1.hasCircularReference();
  suite.assert(hasCircular === true, 'Should detect circular reference');
});

// Test 10: Smart Blocks
suite.test('Smart blocks - FIND_AND_TAP creation', async () => {
  const findTap = suite.factory.createBlock('FIND_AND_TAP', {
    image: 'button.png',
    confidence: 0.9,
    timeout: 5000,
    offset: { x: 0, y: 0 }
  });

  suite.assert(findTap !== null, 'Should create FIND_AND_TAP block');
  suite.assert(findTap.type === 'FIND_AND_TAP', 'Type should be FIND_AND_TAP');

  const displayInfo = findTap.getDisplayInfo();
  suite.assert(displayInfo.title === 'Find & Tap', 'Display title should match');
});

// Test 11: Block Serialization
suite.test('Block serialization and deserialization', async () => {
  const original = suite.factory.createBlock('SWIPE', {
    startX: 100,
    startY: 200,
    endX: 300,
    endY: 400,
    duration: 1000
  });

  const json = original.toJSON();
  suite.assert(json.type === 'SWIPE', 'Serialized type should match');
  suite.assert(json.params.startX === 100, 'Parameters should be preserved');

  const restored = suite.factory.createBlockFromJSON(json);
  suite.assert(restored.type === original.type, 'Restored type should match');
  suite.assert(restored.params.startX === original.params.startX, 'Restored params should match');
});

// Test 12: Input Text Block
suite.test('Input text block - Special character handling', async () => {
  const inputBlock = suite.factory.createBlock('INPUT_TEXT', {
    text: 'Test "quoted" text with $special chars',
    clearFirst: true,
    pressEnter: false
  });

  const escapedText = inputBlock.escapeShellText(inputBlock.params.text);
  suite.assert(escapedText.includes('\\"'), 'Should escape quotes');
  suite.assert(escapedText.includes('\\$'), 'Should escape dollar sign');
});

// Test 13: Example Macros
suite.test('Example macros generation', async () => {
  const examples = suite.factory.createExampleMacros();

  suite.assert(examples.length > 0, 'Should generate example macros');

  for (const example of examples) {
    suite.assert(example.name !== undefined, 'Example should have name');
    suite.assert(example.blocks.length > 0, 'Example should have blocks');
    suite.assert(example.startBlock !== null, 'Example should have start block');
  }
});

// Test 14: Connection Validation
suite.test('Connection validation', async () => {
  const tap = suite.factory.createBlock('TAP', { x: 100, y: 100 });
  const wait = suite.factory.createBlock('WAIT', { milliseconds: 1000 });

  // Valid connection
  const validResult = suite.factory.validateConnection(tap, wait, 'next');
  suite.assert(validResult.valid === true, 'Valid connection should pass');

  // Self connection
  const selfResult = suite.factory.validateConnection(tap, tap, 'next');
  suite.assert(selfResult.valid === false, 'Self connection should fail');
});

// Test 15: Block Categories
suite.test('Block categories and metadata', async () => {
  suite.assert(Object.keys(BLOCK_CATEGORIES).length > 0, 'Should have block categories');
  suite.assert(Object.keys(BLOCK_TYPES).length > 0, 'Should have block types');

  // Check each block type has required fields
  Object.values(BLOCK_TYPES).forEach(blockType => {
    suite.assert(blockType.id !== undefined, `${blockType.id} should have id`);
    suite.assert(blockType.category !== undefined, `${blockType.id} should have category`);
    suite.assert(blockType.name !== undefined, `${blockType.id} should have name`);
  });
});

// Main test runner
(async () => {
  try {
    await suite.init();
    await suite.runAll();
  } catch (error) {
    console.error(`${colors.red}Test suite failed to run:${colors.reset}`, error);
    process.exit(1);
  }
})();