/**
 * AI Analysis Service
 * Uses LLM API to analyze scenario execution failures and provide recommendations
 *
 * Features:
 * - Claude API integration
 * - Prompt engineering for failure analysis
 * - Structured response parsing
 * - Rate limiting and error handling
 */

const https = require('https');

const SYSTEM_PROMPT = `You are an expert in mobile device automation testing analysis.
Your role is to analyze failed test scenarios and provide:
1. Root cause analysis
2. Specific failure point identification
3. Actionable recommendations

You will receive:
- Scenario information (name, description)
- Execution summary (total actions, failed action, duration)
- Failed action details (type, expected vs actual behavior, match scores)
- Device logs (if available)

Respond in JSON format with the following structure:
{
  "summary": "Brief one-line summary of the failure",
  "rootCause": {
    "category": "timing" | "ui_change" | "device_issue" | "scenario_design" | "network" | "unknown",
    "description": "Detailed description of the root cause",
    "confidence": 0.0-1.0
  },
  "failurePoint": {
    "actionIndex": number,
    "actionType": "string",
    "issue": "Description of the specific issue"
  },
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "type": "increase_wait" | "lower_threshold" | "update_image" | "add_retry" | "check_device" | "modify_flow",
      "description": "Specific actionable recommendation",
      "actionIndex": number or null
    }
  ],
  "additionalInsights": ["Array of additional observations or suggestions"]
}

Respond in Korean for the description fields. Be concise but thorough.`;

class AIAnalysisService {
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
        this.model = config.model || 'claude-sonnet-4-20250514';
        this.maxTokens = config.maxTokens || 4096;
        this.temperature = config.temperature || 0.3;
        this.enabled = !!this.apiKey;

        if (!this.enabled) {
            console.warn('[AIAnalysis] API key not configured. AI analysis will be disabled.');
        }
    }

    /**
     * Check if service is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Configure the service with new settings
     * @param {Object} config Configuration options
     */
    configure(config) {
        if (config.apiKey !== undefined) {
            this.apiKey = config.apiKey;
            this.enabled = !!this.apiKey;
        }
        if (config.model) this.model = config.model;
        if (config.maxTokens) this.maxTokens = config.maxTokens;
        if (config.temperature !== undefined) this.temperature = config.temperature;
    }

    /**
     * Analyze a failed scenario execution
     * @param {Object} sessionData Session data from ResultReportService
     * @param {Object} scenario Scenario configuration
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeFailure(sessionData, scenario = {}) {
        if (!this.enabled) {
            return {
                success: false,
                error: 'AI Analysis is not enabled. Please configure API key.'
            };
        }

        try {
            const prompt = this._buildAnalysisPrompt(sessionData, scenario);
            const response = await this._callClaudeAPI(prompt);
            const result = this._parseAnalysisResponse(response);

            return {
                success: true,
                analysis: result
            };
        } catch (error) {
            console.error('[AIAnalysis] Analysis failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Build analysis prompt from session data
     * @private
     */
    _buildAnalysisPrompt(sessionData, scenario) {
        const failedAction = sessionData.actions.find(a => a.result === 'FAIL');
        const failedIndex = failedAction ? failedAction.index : -1;

        let prompt = `## Scenario Information
- Name: ${sessionData.scenarioName}
- File: ${sessionData.scenarioFile}
- Description: ${scenario.description || 'No description provided'}

## Execution Summary
- Total Actions: ${sessionData.actions.length}
- Failed at: ${failedIndex >= 0 ? `Action #${failedIndex} (${failedAction.type})` : 'None'}
- Total Duration: ${sessionData.duration}ms
- Result: ${sessionData.result}

## Device Information
- Model: ${sessionData.device?.model || 'Unknown'}
- Connection Type: ${sessionData.environment?.connectionType || 'Unknown'}
- OS Version: ${sessionData.environment?.osVersion || 'Unknown'}

## Action History
`;

        // Add action history (last 5 actions before failure, or all if less)
        const relevantActions = sessionData.actions.slice(Math.max(0, failedIndex - 5), failedIndex + 1);
        relevantActions.forEach(action => {
            prompt += `
### Action #${action.index}: ${action.name}
- Type: ${action.type}
- Result: ${action.result}
- Duration: ${action.duration}ms`;

            if (action.matchScore !== null) {
                prompt += `
- Match Score: ${(action.matchScore * 100).toFixed(1)}%
- Threshold: ${(action.matchThreshold * 100).toFixed(1)}%`;
            }

            if (action.matchRegion) {
                prompt += `
- Region: x=${action.matchRegion.x}, y=${action.matchRegion.y}, w=${action.matchRegion.width}, h=${action.matchRegion.height}`;
            }

            if (action.error) {
                prompt += `
- Error: ${action.error}`;
            }
            prompt += '\n';
        });

        // Add failure info if available
        if (sessionData.failureInfo) {
            prompt += `
## Failure Details
- Failed Action: ${sessionData.failureInfo.actionName}
- Action Type: ${sessionData.failureInfo.actionType}
- Reason: ${sessionData.failureInfo.reason}
- Timestamp: ${sessionData.failureInfo.timestamp}
`;
        }

        // Add logcat summary if available
        if (sessionData.logcat && sessionData.logcat.filteredLogs.length > 0) {
            prompt += `
## Device Logs (Errors/Warnings)
`;
            const recentLogs = sessionData.logcat.filteredLogs.slice(-20);
            recentLogs.forEach(log => {
                prompt += `[${log.level}] ${log.tag}: ${log.message}\n`;
            });
        }

        prompt += `
## Analysis Request
Please analyze this scenario execution failure and provide:
1. A summary of what went wrong
2. The likely root cause
3. Specific recommendations to fix the issue
4. Any additional insights from the data
`;

        return prompt;
    }

    /**
     * Call Claude API
     * @private
     */
    async _callClaudeAPI(userPrompt) {
        return new Promise((resolve, reject) => {
            const requestBody = JSON.stringify({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                system: SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ]
            });

            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const response = JSON.parse(data);
                            if (response.content && response.content[0] && response.content[0].text) {
                                resolve(response.content[0].text);
                            } else {
                                reject(new Error('Invalid API response format'));
                            }
                        } catch (error) {
                            reject(new Error(`Failed to parse API response: ${error.message}`));
                        }
                    } else {
                        let errorMessage = `API request failed with status ${res.statusCode}`;
                        try {
                            const errorData = JSON.parse(data);
                            if (errorData.error && errorData.error.message) {
                                errorMessage = errorData.error.message;
                            }
                        } catch (e) {
                            // Ignore parse error
                        }
                        reject(new Error(errorMessage));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Network error: ${error.message}`));
            });

            req.setTimeout(60000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Parse and validate API response
     * @private
     */
    _parseAnalysisResponse(responseText) {
        // Try to extract JSON from the response
        let jsonStr = responseText;

        // Check if response is wrapped in markdown code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        try {
            const parsed = JSON.parse(jsonStr);

            // Validate required fields
            const result = {
                summary: parsed.summary || 'Analysis completed',
                rootCause: {
                    category: parsed.rootCause?.category || 'unknown',
                    description: parsed.rootCause?.description || 'Unable to determine root cause',
                    confidence: parsed.rootCause?.confidence || 0.5
                },
                failurePoint: parsed.failurePoint || null,
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
                additionalInsights: Array.isArray(parsed.additionalInsights) ? parsed.additionalInsights : []
            };

            return result;
        } catch (error) {
            console.error('[AIAnalysis] Failed to parse response:', error.message);
            console.error('[AIAnalysis] Raw response:', responseText.substring(0, 500));

            // Return a basic response if parsing fails
            return {
                summary: 'Analysis completed but response parsing failed',
                rootCause: {
                    category: 'unknown',
                    description: responseText.substring(0, 500),
                    confidence: 0.3
                },
                failurePoint: null,
                recommendations: [],
                additionalInsights: ['Raw response could not be parsed as JSON']
            };
        }
    }
}

module.exports = AIAnalysisService;
