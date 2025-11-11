/**
 * ActionSettingsBuilder
 * Builds HTML for action settings panels
 * Extracted from MacroBuilderApp.getSettingsHTML() (was 645 lines)
 */

class ActionSettingsBuilder {
    constructor() {
        // Map action types to their builder methods
        this.builders = new Map([
            ['click', this.buildClickSettings.bind(this)],
            ['long-press', this.buildClickSettings.bind(this)],  // Shares same UI with click
            ['drag', this.buildDragSettings.bind(this)],
            ['keyboard', this.buildKeyboardSettings.bind(this)],
            ['wait', this.buildWaitSettings.bind(this)],
            ['screenshot', this.buildScreenshotSettings.bind(this)],
            ['image-match', this.buildImageMatchSettings.bind(this)],
            ['if', this.buildConditionalSettings.bind(this)],
            ['else-if', this.buildConditionalSettings.bind(this)],
            ['while', this.buildConditionalSettings.bind(this)],
            ['loop', this.buildLoopSettings.bind(this)],
            ['log', this.buildLogSettings.bind(this)],
            ['success', this.buildResultSettings.bind(this)],
            ['fail', this.buildResultSettings.bind(this)],
            ['skip', this.buildResultSettings.bind(this)],
            ['tap-matched-image', this.buildTapMatchedImageSettings.bind(this)],
            ['test', this.buildTestSettings.bind(this)],
            ['home', this.buildNoSettings.bind(this)],
            ['back', this.buildNoSettings.bind(this)],
            ['sound-check', this.buildSoundCheckSettings.bind(this)]
        ]);
    }

    /**
     * Main entry point - builds settings HTML for any action type
     */
    build(action) {
        const builder = this.builders.get(action.type);
        if (!builder) {
            return `<p class="text-xs text-slate-600 text-center py-2">알 수 없는 액션 타입: ${action.type}</p>`;
        }
        return builder(action);
    }

    /**
     * Click & Long-press settings
     */
    buildClickSettings(action) {
        const isLongPress = action.type === 'long-press';
        const H = TemplateHelpers;

        const content = H.coordinateInputs(action) +
            (isLongPress ? H.incrementControl({
                value: action.duration || 1000,
                min: 100,
                max: 5000,
                step: 100,
                actionId: action.id,
                field: 'duration',
                unit: 'ms',
                label: '지속 시간'
            }) : '');

        return H.settingsContainer(content);
    }

    /**
     * Drag settings
     */
    buildDragSettings(action) {
        return `
            <div class="bg-slate-50/50 px-4 py-4 space-y-4">
                <div>
                    <label class="text-xs text-slate-600 mb-2 block">시작점</label>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs">X</label>
                            <input type="number" value="${action.x || 0}"
                                onclick="event.stopPropagation()"
                                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                onchange="window.macroApp.updateActionValue('${action.id}', 'x', parseInt(this.value))">
                        </div>
                        <div>
                            <label class="text-xs">Y</label>
                            <input type="number" value="${action.y || 0}"
                                onclick="event.stopPropagation()"
                                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                onchange="window.macroApp.updateActionValue('${action.id}', 'y', parseInt(this.value))">
                        </div>
                    </div>
                </div>
                <div>
                    <label class="text-xs text-slate-600 mb-2 block">종료점</label>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs">X</label>
                            <input type="number" value="${action.endX || 0}"
                                onclick="event.stopPropagation()"
                                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                onchange="window.macroApp.updateActionValue('${action.id}', 'endX', parseInt(this.value))">
                        </div>
                        <div>
                            <label class="text-xs">Y</label>
                            <input type="number" value="${action.endY || 0}"
                                onclick="event.stopPropagation()"
                                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                onchange="window.macroApp.updateActionValue('${action.id}', 'endY', parseInt(this.value))">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Keyboard input settings
     */
    buildKeyboardSettings(action) {
        const H = TemplateHelpers;
        const content = H.textInput({
            value: action.text || '',
            actionId: action.id,
            field: 'text',
            label: '입력할 텍스트',
            placeholder: '텍스트 입력'
        });
        return H.settingsContainer(content);
    }

    /**
     * Wait settings
     */
    buildWaitSettings(action) {
        const H = TemplateHelpers;
        const content = H.incrementControl({
            value: action.duration || 1000,
            min: 100,
            max: 10000,
            step: 100,
            actionId: action.id,
            field: 'duration',
            unit: 'ms',
            label: '대기 시간'
        });
        return H.settingsContainer(content);
    }

    /**
     * Screenshot settings
     */
    buildScreenshotSettings(action) {
        const H = TemplateHelpers;
        const content = H.textInput({
            value: action.filename || 'screenshot.png',
            actionId: action.id,
            field: 'filename',
            label: '파일 이름',
            placeholder: 'screenshot.png'
        });
        return H.settingsContainer(content);
    }

    /**
     * Image match settings
     * TODO: Refactor to use TemplateHelpers
     * This is one of the most complex builders - kept simplified for now
     */
    buildImageMatchSettings(action) {
        // This would be the large image-match settings panel
        // For now, return a placeholder - full implementation would be extracted from original code
        return `
            <div class="bg-slate-50/50 px-4 py-4">
                <p class="text-xs text-slate-600">이미지 매칭 설정 (구현 예정)</p>
            </div>
        `;
    }

    /**
     * Conditional settings (if/else-if/while)
     * TODO: Refactor to use TemplateHelpers
     */
    buildConditionalSettings(action) {
        return `
            <div class="bg-slate-50/50 px-4 py-4">
                <p class="text-xs text-slate-600">조건문 설정 (구현 예정)</p>
            </div>
        `;
    }

    /**
     * Loop settings
     */
    buildLoopSettings(action) {
        const H = TemplateHelpers;
        const content = H.incrementControl({
            value: action.loopCount || 1,
            min: 1,
            max: 1000,
            step: 1,
            actionId: action.id,
            field: 'loopCount',
            label: '반복 횟수'
        });
        return H.settingsContainer(content);
    }

    /**
     * Log settings
     */
    buildLogSettings(action) {
        const H = TemplateHelpers;
        const content = H.textInput({
            value: action.message || '',
            actionId: action.id,
            field: 'message',
            label: '로그 메시지',
            placeholder: '로그 메시지'
        });
        return H.settingsContainer(content);
    }

    /**
     * Result settings (success/fail/skip)
     */
    buildResultSettings(action) {
        const H = TemplateHelpers;
        const content = H.textInput({
            value: action.message || '',
            actionId: action.id,
            field: 'message',
            label: '결과 메시지',
            placeholder: '결과 메시지'
        });
        return H.settingsContainer(content);
    }

    /**
     * Tap matched image settings
     * TODO: Refactor to use TemplateHelpers
     */
    buildTapMatchedImageSettings(action) {
        return `
            <div class="bg-slate-50/50 px-4 py-4">
                <p class="text-xs text-slate-600">이미지 매칭 탭 설정 (구현 예정)</p>
            </div>
        `;
    }

    /**
     * Test settings
     * TODO: Refactor to use TemplateHelpers
     */
    buildTestSettings(action) {
        return `
            <div class="bg-slate-50/50 px-4 py-4">
                <p class="text-xs text-slate-600">테스트 설정 (구현 예정)</p>
            </div>
        `;
    }

    /**
     * Sound check settings
     * TODO: Refactor to use TemplateHelpers
     */
    buildSoundCheckSettings(action) {
        return `
            <div class="bg-slate-50/50 px-4 py-4">
                <p class="text-xs text-slate-600">사운드 체크 설정 (구현 예정)</p>
            </div>
        `;
    }

    /**
     * No settings needed (home/back buttons)
     */
    buildNoSettings(action) {
        return `<p class="text-xs text-slate-600 text-center py-2">이 액션은 별도 설정이 필요하지 않습니다.</p>`;
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionSettingsBuilder;
}

if (typeof window !== 'undefined') {
    window.ActionSettingsBuilder = ActionSettingsBuilder;
}
