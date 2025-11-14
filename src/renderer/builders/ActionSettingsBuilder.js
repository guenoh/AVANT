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
            ['sound-check', this.buildSoundCheckSettings.bind(this)],
            ['get-volume', this.buildGetVolumeSettings.bind(this)]
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
        const UI = UIComponents;
        const startPoint = UI.coordinateInputs({
            x: action.x || 0,
            y: action.y || 0,
            actionId: action.id,
            label: '시작점',
            xField: 'x',
            yField: 'y'
        });
        const endPoint = UI.coordinateInputs({
            x: action.endX || 0,
            y: action.endY || 0,
            actionId: action.id,
            label: '종료점',
            xField: 'endX',
            yField: 'endY'
        });

        return UI.section(startPoint + endPoint);
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
     */
    buildImageMatchSettings(action) {
        const UI = UIComponents;
        const threshold = action.threshold || 0.95;
        const imagePath = action.regionImage || action.imagePath || action.image;
        const hasImage = imagePath && imagePath !== 'image.png';

        const imageSection = hasImage
            ? UI.formGroup('캡처된 이미지', UI.imageThumbnail(imagePath, 'Captured region'))
            : UI.alert('화면에서 영역을 선택하여 이미지를 캡처하세요', 'info');

        // Get comparison data (backward compatible)
        const comparison = action.comparison || { operator: '>=', value: threshold };

        // Get operators from ActionConfigProvider
        const metadata = window.actionConfigProvider?.getConditionMetadata('image-match');
        const operators = metadata?.operators || [
            { value: '>=', label: '>=' },
            { value: '>', label: '>' },
            { value: '==', label: '==' },
            { value: '<', label: '<' },
            { value: '<=', label: '<=' },
            { value: '!=', label: '!=' }
        ];

        const comparisonUI = UI.comparisonOperator({
            operator: comparison.operator,
            value: comparison.value,
            operators: operators,
            actionId: action.id,
            label: '매칭 조건',
            unit: '신뢰도',
            min: 0,
            max: 1,
            step: 0.01
        });

        const helperText = UI.alert('조건이 참일 때 다음 액션들이 실행됩니다', 'info');

        return UI.section(imageSection + comparisonUI + helperText);
    }

    /**
     * Conditional settings (if/else-if/while)
     * Uses MacroBuilderApp's renderConditionCard for rendering condition list
     */
    buildConditionalSettings(action) {
        return `
            <div class="bg-slate-50/50 px-4 py-4 space-y-4">
                <!-- Condition Operator Selection -->
                ${action.conditions && action.conditions.length > 1 ? `
                    <div class="flex items-center gap-2 pb-2 border-b border-slate-200">
                        <label class="text-xs text-slate-600">조건 연산:</label>
                        <div class="flex gap-1">
                            <button
                                onclick="event.stopPropagation(); window.macroApp.updateActionValue('${action.id}', 'conditionOperator', 'AND');"
                                class="px-2 py-1 text-xs rounded transition-colors ${(action.conditionOperator || 'AND') === 'AND' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}"
                            >
                                모든 조건 (AND)
                            </button>
                            <button
                                onclick="event.stopPropagation(); window.macroApp.updateActionValue('${action.id}', 'conditionOperator', 'OR');"
                                class="px-2 py-1 text-xs rounded transition-colors ${action.conditionOperator === 'OR' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}"
                            >
                                하나라도 (OR)
                            </button>
                        </div>
                    </div>
                ` : ''}

                <div class="flex items-center justify-between mb-2">
                    <label class="text-xs">조건 목록</label>
                    <span class="text-xs text-slate-500">${action.conditions?.length || 0}개</span>
                </div>

                ${action.conditions && action.conditions.length > 0 ? `
                    <div class="space-y-2">
                        ${action.conditions.map((cond, index) => window.macroApp.renderConditionCard(action.id, cond, index, action.conditions.length)).join('')}
                    </div>
                ` : ''}

                <!-- Drop Zone -->
                <div
                    class="condition-drop-zone border border-dashed border-slate-300 bg-slate-50 rounded-lg p-3 text-center transition-all hover:border-slate-400 hover:bg-slate-100"
                    ondragover="event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.add('border-slate-400', 'bg-slate-100')"
                    ondragleave="event.currentTarget.classList.remove('border-slate-400', 'bg-slate-100')"
                    ondrop="event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('border-slate-400', 'bg-slate-100'); window.macroApp.handleConditionDrop(event, '${action.id}')"
                    onclick="event.stopPropagation()"
                >
                    <p class="text-xs text-slate-500">
                        <span style="opacity: 0.5;">+</span> 액션을 드래그하여 조건 추가
                    </p>
                </div>
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
     * Test settings - UI Component Guide
     * Demonstrates UIComponents library usage
     */
    buildTestSettings(action) {
        const UI = UIComponents;

        const header = UI.alert(
            `<div><strong class="block mb-1">UI 컴포넌트 라이브러리</strong>
            <span>UIComponents 클래스를 사용하여 일관된 디자인의 설정 패널을 구현할 수 있습니다</span></div>`,
            'info'
        );

        const alertsSection = UI.formGroup('알림 박스',
            UI.alert('정보 메시지', 'info') +
            UI.alert('성공 메시지', 'success') +
            UI.alert('경고 메시지', 'warning') +
            UI.alert('에러 메시지', 'error')
        );

        const inputsSection = UI.formGroup('텍스트 입력',
            UI.textInput({
                value: '',
                placeholder: '텍스트 입력...',
                actionId: action.id,
                field: 'testText'
            })
        );

        const numberSection = UI.formGroup('숫자 입력',
            UI.numberInput({
                value: 0,
                min: 0,
                max: 100,
                actionId: action.id,
                field: 'testNumber'
            })
        );

        const incrementSection = UI.incrementControl({
            value: 1000,
            min: 0,
            max: 5000,
            step: 100,
            actionId: action.id,
            field: 'testIncrement',
            unit: 'ms',
            label: '증감 컨트롤'
        });

        const sliderSection = UI.slider({
            value: 75,
            min: 0,
            max: 100,
            actionId: action.id,
            field: 'testSlider',
            label: '슬라이더',
            unit: '%',
            helper: '슬라이더 예제입니다'
        });

        const coordinatesSection = UI.coordinateInputs({
            x: 100,
            y: 200,
            actionId: action.id,
            label: '좌표 입력'
        });

        const selectSection = UI.formGroup('선택 박스',
            UI.select({
                value: 'option2',
                options: [
                    { value: 'option1', label: '옵션 1' },
                    { value: 'option2', label: '옵션 2' },
                    { value: 'option3', label: '옵션 3' }
                ],
                actionId: action.id,
                field: 'testSelect'
            })
        );

        const checkboxSection = UI.formGroup('체크박스',
            UI.checkbox({
                checked: false,
                label: '체크박스 옵션',
                actionId: action.id,
                field: 'testCheckbox'
            })
        );

        const buttonGroupSection = UI.formGroup('버튼 그룹',
            UI.buttonGroup({
                value: 'AND',
                options: [
                    { value: 'AND', label: '모든 조건 (AND)' },
                    { value: 'OR', label: '하나라도 (OR)' }
                ],
                actionId: action.id,
                field: 'testButtonGroup'
            })
        );

        const codeExample = UI.formGroup('사용 예제',
            UI.codeBlock(
`const UI = UIComponents;

// Alert box
UI.alert('메시지', 'info')

// Text input
UI.textInput({
  value: '',
  placeholder: '입력...',
  actionId: action.id,
  field: 'fieldName'
})

// Slider
UI.slider({
  value: 50,
  min: 0,
  max: 100,
  actionId: action.id,
  field: 'threshold',
  label: '임계값',
  unit: '%'
})`
            )
        );

        return UI.section(
            header +
            UI.divider() +
            alertsSection +
            inputsSection +
            numberSection +
            incrementSection +
            sliderSection +
            coordinatesSection +
            selectSection +
            checkboxSection +
            buttonGroupSection +
            UI.divider() +
            codeExample,
            'relaxed'
        );
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
     * Get volume settings
     */
    buildGetVolumeSettings(action) {
        const UI = UIComponents;

        const streamTypeSelect = UI.formGroup('스트림 타입',
            UI.select({
                value: action.streamType || 'music',
                options: [
                    { value: 'music', label: 'Music/Media' },
                    { value: 'ring', label: 'Ringtone' },
                    { value: 'alarm', label: 'Alarm' },
                    { value: 'notification', label: 'Notification' }
                ],
                actionId: action.id,
                field: 'streamType'
            }),
            '가져올 볼륨 스트림 종류를 선택하세요'
        );

        const variableInput = UI.formGroup('변수명 (선택사항)',
            UI.textInput({
                value: action.saveToVariable || '',
                placeholder: 'e.g., currentVolume',
                actionId: action.id,
                field: 'saveToVariable'
            }),
            '볼륨 값을 저장할 변수명을 입력하세요'
        );

        // Get comparison data (for condition usage)
        const comparison = action.comparison || { operator: '>=', value: 50 };

        // Get operators from ActionConfigProvider
        const metadata = window.actionConfigProvider?.getConditionMetadata('get-volume');
        const operators = metadata?.operators || [
            { value: '>=', label: '>=' },
            { value: '>', label: '>' },
            { value: '==', label: '==' },
            { value: '<', label: '<' },
            { value: '<=', label: '<=' },
            { value: '!=', label: '!=' }
        ];

        const comparisonUI = UI.comparisonOperator({
            operator: comparison.operator,
            value: comparison.value,
            operators: operators,
            actionId: action.id,
            label: '볼륨 조건 (조건문 사용시)',
            unit: '레벨 (0-100)',
            min: 0,
            max: 100,
            step: 1
        });

        const infoAlert = UI.alert(
            'ADB 전용: 디바이스의 볼륨 정보를 가져옵니다',
            'info'
        );

        return UI.section(
            infoAlert +
            streamTypeSelect +
            variableInput +
            UI.divider() +
            comparisonUI
        );
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
