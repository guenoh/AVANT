/**
 * Test file for the block-based macro system
 * Run with: node test-block-system.js
 */

const ActionBlock = require('./src/main/services/blocks/ActionBlock');
const TypedActionBlock = require('./src/main/services/blocks/TypedActionBlock');
const TapBlock = require('./src/main/services/blocks/actions/TapBlock');
const MacroExecutor = require('./src/main/services/MacroExecutor');
const { BLOCK_TYPES, getBlocksByCategory } = require('./src/shared/block-types');

// Test 1: Create and validate a basic TAP block
console.log('=== Test 1: TAP Block Creation ===');
const tapBlock = new TapBlock({
  x: 500,
  y: 300,
  duration: 100
});

console.log('TAP Block created:');
console.log('- ID:', tapBlock.id);
console.log('- Type:', tapBlock.type);
console.log('- Params:', tapBlock.params);
console.log('- Display Info:', tapBlock.getDisplayInfo());

// Test 2: Type validation
console.log('\n=== Test 2: Type Validation ===');

// Valid params
const validationResult1 = tapBlock.validateInputs({ x: 100, y: 200 });
console.log('Valid params (x:100, y:200):', validationResult1);

// Invalid params (missing required field)
const validationResult2 = tapBlock.validateInputs({ x: 100 });
console.log('Invalid params (missing y):', validationResult2);

// Invalid params (wrong type)
const validationResult3 = tapBlock.validateInputs({ x: 'not a number', y: 200 });
console.log('Invalid params (x is string):', validationResult3);

// Test 3: Create a simple macro flow
console.log('\n=== Test 3: Simple Macro Flow ===');

// Create blocks
const tap1 = new TapBlock({ x: 100, y: 100 });
const tap2 = new TapBlock({ x: 200, y: 200 });
const tap3 = new TapBlock({ x: 300, y: 300 });

// Connect blocks
tap1.connectTo(tap2, 'next');
tap2.connectTo(tap3, 'next');

console.log('Created flow: tap1 -> tap2 -> tap3');
console.log('- tap1.next:', tap1.next?.id);
console.log('- tap2.next:', tap2.next?.id);
console.log('- tap3.next:', tap3.next?.id);

// Test 4: Serialize and deserialize blocks
console.log('\n=== Test 4: Serialization ===');

const serialized = tapBlock.toJSON();
console.log('Serialized block:', JSON.stringify(serialized, null, 2));

// Test 5: Mock execution
console.log('\n=== Test 5: Mock Execution ===');

// Create a mock context for testing
const mockContext = {
  device: {
    executeShellCommand: async (cmd) => {
      console.log(`  [Mock Device] Executing: ${cmd}`);
      return { success: true };
    },
    getScreenInfo: async () => ({
      width: 1080,
      height: 1920
    })
  },
  logger: {
    log: (level, message) => {
      console.log(`  [${level.toUpperCase()}] ${typeof message === 'object' ? message.message : message}`);
    }
  },
  debugMode: false
};

// Test single block execution
(async () => {
  try {
    console.log('Executing single TAP block...');
    const result = await tapBlock.runAction(mockContext);
    console.log('Result:', result);
  } catch (error) {
    console.error('Execution failed:', error.message);
  }

  // Test 6: Executor with macro
  console.log('\n=== Test 6: MacroExecutor ===');

  const executor = new MacroExecutor({
    debugMode: true,
    logLevel: 'debug'
  });

  // Create a simple macro
  const macro = {
    name: 'Test Macro',
    startBlock: tap1
  };

  // Listen to executor events
  executor.on('execution:start', (data) => {
    console.log('Macro execution started');
  });

  executor.on('block:start', (data) => {
    console.log(`Block ${data.blockType} [${data.blockId}] starting...`);
  });

  executor.on('block:complete', (data) => {
    console.log(`Block ${data.blockType} completed with result: ${data.result}`);
  });

  executor.on('execution:complete', (data) => {
    console.log('Macro execution completed');
    console.log('Stats:', data.stats);
  });

  // Execute the macro
  try {
    console.log('Executing macro with 3 connected TAP blocks...');
    const result = await executor.execute(macro, mockContext);
    console.log('Macro execution result:', result.success);
  } catch (error) {
    console.error('Macro execution failed:', error.message);
  }

  // Test 7: Block types from constants
  console.log('\n=== Test 7: Block Type Registry ===');

  const interactionBlocks = getBlocksByCategory('interaction');
  console.log(`Found ${interactionBlocks.length} interaction blocks:`);
  interactionBlocks.forEach(block => {
    console.log(`  - ${block.name} (${block.id}): ${block.description}`);
  });

  const controlBlocks = getBlocksByCategory('control');
  console.log(`\nFound ${controlBlocks.length} control blocks:`);
  controlBlocks.forEach(block => {
    console.log(`  - ${block.name} (${block.id}): ${block.description}`);
  });

  // Test 8: Circular reference detection
  console.log('\n=== Test 8: Circular Reference Detection ===');

  const circularBlock1 = new ActionBlock('TEST1');
  const circularBlock2 = new ActionBlock('TEST2');
  const circularBlock3 = new ActionBlock('TEST3');

  circularBlock1.connectTo(circularBlock2);
  circularBlock2.connectTo(circularBlock3);
  circularBlock3.connectTo(circularBlock1); // Creates circular reference

  const hasCircular = circularBlock1.hasCircularReference();
  console.log('Circular reference detected:', hasCircular);

  // Test 9: Validation of macro
  console.log('\n=== Test 9: Macro Validation ===');

  const validMacro = {
    startBlock: tap1,
    blocks: [tap1, tap2, tap3]
  };

  const validationResultMacro = MacroExecutor.validateMacro(validMacro);
  console.log('Macro validation:', validationResultMacro);

  console.log('\n=== All tests completed ===');
})();