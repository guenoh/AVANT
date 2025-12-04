# AI Failure Analysis Feature Design

## Overview
시나리오 실행 실패 시 LLM API를 활용하여 원인 분석 및 해결책을 제시하는 기능

## Architecture

```
+-------------------------------------------------------------+
|                        Vision Auto                           |
+-------------------------------------------------------------+
|  Renderer Process                                            |
|  +------------+  +------------+  +-----------------------+   |
|  | MacroRunner|  | ResultView |  | AI Analysis Panel     |   |
|  |            |  |            |  |  - Analysis Request   |   |
|  |            |  |            |  |  - Result Display     |   |
|  |            |  |            |  |  - Suggestion Actions |   |
|  +------------+  +------------+  +-----------------------+   |
+-------------------------------------------------------------+
|  Main Process                                                |
|  +----------------+  +----------------+  +---------------+   |
|  | ExecutionCtx   |  | ResultReport   |  | AIAnalysis    |   |
|  |  - Screenshot  |  |  - Session     |  |  - LLM API    |   |
|  |  - ADB Logcat  |  |  - ActionRec   |  |  - Prompt     |   |
|  |  - MatchScore  |  |  - Export JSON |  |  - Response   |   |
|  +----------------+  +----------------+  +---------------+   |
+-------------------------------------------------------------+
```

## Data Collection Layer

### Current Data (ResultReportService)
```javascript
actionRecord = {
  index,              // Action index
  name,               // Action name
  type,               // Action type
  result,             // PASS/FAIL
  startTime,          // Start time
  endTime,            // End time
  duration,           // Duration
  screenshot,         // Screenshot path
  matchImage,         // Match target image
  details,            // Details
  error               // Error message
}
```

### Extended Data (Required)
```javascript
// Extended actionRecord
actionRecord = {
  ...existing,

  // Image matching
  matchScore: 0.87,           // Actual match similarity
  matchThreshold: 0.95,       // Configured threshold
  matchRegion: { x, y, w, h },// Match region

  // Screen state
  screenState: {
    before: 'screenshot_before.png',
    after: 'screenshot_after.png'
  },

  // Device metrics
  deviceMetrics: {
    cpuUsage: 45,
    memoryUsage: 2048,
    batteryLevel: 85
  }
}

// Session level additions
session = {
  ...existing,

  // ADB Logcat (ADB connection only)
  logcat: {
    startTimestamp: 1234567890,
    endTimestamp: 1234567899,
    logs: [
      { timestamp, level, tag, message }
    ],
    filteredLogs: []  // Errors/warnings only
  },

  // Environment info
  environment: {
    connectionType: 'adb' | 'ccnc',
    deviceName: 'Galaxy S21',
    osVersion: 'Android 13',
    appVersion: '1.0.0'
  }
}
```

## LLM API Integration Service

### AIAnalysisService Structure
```javascript
// src/main/services/ai-analysis.service.js

class AIAnalysisService {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
  }

  async analyzeFailure(sessionData, scenario) {
    const prompt = this._buildAnalysisPrompt(sessionData, scenario);
    const response = await this._callLLMAPI(prompt);
    return this._parseAnalysisResponse(response);
  }

  _buildAnalysisPrompt(sessionData, scenario) {
    return {
      system: SYSTEM_PROMPT,
      user: this._formatUserPrompt(sessionData, scenario)
    };
  }
}
```

### Prompt Engineering
```javascript
const SYSTEM_PROMPT = `
You are an expert in mobile device automation testing analysis.
Your role is to analyze failed test scenarios and provide:
1. Root cause analysis
2. Specific failure point identification
3. Actionable recommendations

Respond in Korean. Be concise but thorough.
`;

const USER_PROMPT_TEMPLATE = `
## Scenario Information
- Name: {{scenarioName}}
- Description: {{scenarioDescription}}
- Expected Outcome: {{expectedOutcome}}

## Execution Summary
- Total Actions: {{totalActions}}
- Failed at: Action #{{failedIndex}} ({{failedActionType}})
- Duration: {{totalDuration}}ms

## Failed Action Details
- Type: {{failedActionType}}
- Expected: {{expectedBehavior}}
- Actual: {{actualBehavior}}
- Match Score: {{matchScore}} (Threshold: {{threshold}})

## Device Logs (if available)
{{logcatSummary}}

## Screenshots
[Previous Action Screenshot]
[Failed Action Screenshot]

## Analysis Request
Please analyze:
1. Why did this action fail?
2. What is the likely root cause?
3. How can the scenario be improved?
`;
```

### Response Structure
```javascript
// AnalysisResult
{
  summary: "Image match failure - screen transition delay suspected",

  rootCause: {
    category: "timing" | "ui_change" | "device_issue" | "scenario_design",
    description: "Device reboot took 15+ seconds causing timeout",
    confidence: 0.85
  },

  failurePoint: {
    actionIndex: 2,
    actionType: "image-match",
    issue: "Match score 0.72 below threshold 0.95"
  },

  recommendations: [
    {
      priority: "high",
      type: "increase_wait",
      description: "Increase wait time from 15s to 30s after reboot",
      actionIndex: 1
    },
    {
      priority: "medium",
      type: "lower_threshold",
      description: "Lower match threshold from 0.95 to 0.85",
      actionIndex: 2
    }
  ],

  additionalInsights: [
    "Logcat shows 'ActivityManager: Display freeze' message",
    "Device CPU usage exceeded 90% immediately after reboot"
  ]
}
```

## UI/UX Flow

### User Flow
```
Scenario execution fails
      |
      v
Result screen shows "AI Analysis" button
      |
      v
Button click -> Analysis request
      |
      v
Loading indicator (2-5 seconds)
      |
      v
Analysis result panel displays
  - Summary
  - Root cause analysis
  - Recommendations
      |
      v
"Apply" button on recommendation -> Auto-modify scenario suggestion
```

### UI Component
```
+---------------------------------------------+
| AI Analysis Result                    [X]   |
+---------------------------------------------+
| Summary                                      |
| +------------------------------------------+|
| | Image match failure - transition delay   ||
| +------------------------------------------+|
|                                              |
| Root Cause                         85% conf |
| +------------------------------------------+|
| | Device reboot took 15+ seconds           ||
| | causing timeout                          ||
| +------------------------------------------+|
|                                              |
| Recommendations                              |
| +------------------------------------------+|
| | [High] Wait time 15s -> 30s     [Apply]  ||
| | [Med]  Threshold 0.95 -> 0.85   [Apply]  ||
| +------------------------------------------+|
+---------------------------------------------+
```

## Implementation Phases

### Phase 1: Foundation (Required)
1. `ExecutionContextService` - Extended data collection during execution
   - Image matching score collection
   - Before/after screenshot saving
2. `ResultReportService` extension - Data format changes
3. Session data JSON export feature

### Phase 2: AI Integration (Core)
1. `AIAnalysisService` implementation
2. LLM API connection (Anthropic Claude API)
3. Prompt engineering and testing
4. Response parsing and structuring

### Phase 3: ADB Logcat (ADB only)
1. `ADBLogcatService` implementation
2. Log collection during scenario execution
3. Log filtering and summarization

### Phase 4: UI Integration
1. Analysis button and result panel UI
2. Recommendation apply functionality
3. Analysis history storage

## File Structure

```
src/
  main/
    services/
      ai-analysis.service.js      # New - LLM API integration
      adb-logcat.service.js       # New - ADB log collection
      execution-context.service.js # New - Extended data collection
      result-report.service.js    # Modify - Data format extension
    ipc-handlers/
      ai-analysis.handler.js      # New - IPC handlers
  renderer/
    components/
      ai-analysis-panel.js        # New - Analysis UI component
    styles/
      ai-analysis.css             # New - Component styles
  shared/
    constants.js                  # Modify - Add IPC channels
```

## IPC Channels

```javascript
// Add to constants.js
const IPC = {
  ...existing,

  // AI Analysis
  AI_ANALYZE: 'ai:analyze',
  AI_ANALYZE_RESULT: 'ai:analyze:result',
  AI_APPLY_RECOMMENDATION: 'ai:apply-recommendation',

  // Logcat
  LOGCAT_START: 'logcat:start',
  LOGCAT_STOP: 'logcat:stop',
  LOGCAT_DATA: 'logcat:data'
};
```

## Configuration

```javascript
// AI service configuration
{
  ai: {
    enabled: true,
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.3
  }
}
```

## Security Considerations

1. API key storage: Use system keychain or encrypted storage
2. Data sanitization: Remove sensitive info before sending to API
3. Rate limiting: Prevent abuse of API calls
4. Error handling: Graceful degradation when API unavailable

## Future Enhancements

1. Analysis history and pattern detection
2. Auto-fix suggestions based on common patterns
3. Multi-language support for analysis output
4. Custom prompt templates per scenario type
5. Integration with issue tracking systems
