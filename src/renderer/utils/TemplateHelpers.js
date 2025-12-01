/**
 * TemplateHelpers
 * Reusable HTML template utilities to eliminate code duplication
 */

class TemplateHelpers {
    /**
     * SVG Icons
     */
    static icons = {
        minus: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>`,

        plus: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,

        clock: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,

        camera: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,

        refresh: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`,

        check: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,

        x: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,

        image: `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`
    };

    /**
     * Input field
     */
    static input(params) {
        const {
            type = 'number',
            value = '',
            actionId,
            field,
            min,
            max,
            step,
            placeholder = '',
            className = 'w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300'
        } = params;

        const minAttr = min !== undefined ? `min="${min}"` : '';
        const maxAttr = max !== undefined ? `max="${max}"` : '';
        const stepAttr = step !== undefined ? `step="${step}"` : '';
        const placeholderAttr = placeholder ? `placeholder="${placeholder}"` : '';

        const onchangeValue = type === 'number' ? 'parseInt(this.value)' : 'this.value';

        return `<input type="${type}" value="${value}"
            ${minAttr} ${maxAttr} ${stepAttr} ${placeholderAttr}
            onclick="event.stopPropagation()"
            class="${className}"
            onchange="window.macroApp.updateActionValue('${actionId}', '${field}', ${onchangeValue})">`;
    }

    /**
     * Coordinate input pair (X, Y)
     */
    static coordinateInputs(action) {
        return `
            <div>
                <label class="text-xs text-slate-600 mb-2 block">좌표</label>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs">X</label>
                        ${this.input({ value: action.x || 0, actionId: action.id, field: 'x' })}
                    </div>
                    <div>
                        <label class="text-xs">Y</label>
                        ${this.input({ value: action.y || 0, actionId: action.id, field: 'y' })}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Increment/Decrement button group with input
     */
    static incrementControl(params) {
        const {
            value,
            min = 0,
            max = 10000,
            step = 100,
            actionId,
            field,
            unit = '',
            label = ''
        } = params;

        return `
            <div>
                ${label ? `<label class="text-xs mb-2 block">${label}</label>` : ''}
                <div class="flex items-center gap-2">
                    <button onclick="event.stopPropagation(); const val = ${value}; const newVal = Math.max(${min}, val - ${step}); window.macroApp.updateActionValue('${actionId}', '${field}', newVal);"
                        class="w-8 h-8 flex items-center justify-center bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors">
                        ${this.icons.minus}
                    </button>
                    ${this.input({
                        value,
                        actionId,
                        field,
                        min,
                        max,
                        step,
                        className: 'flex-1 h-8 px-3 text-center border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300 font-mono'
                    })}
                    <button onclick="event.stopPropagation(); const val = ${value}; const newVal = Math.min(${max}, val + ${step}); window.macroApp.updateActionValue('${actionId}', '${field}', newVal);"
                        class="w-8 h-8 flex items-center justify-center bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors">
                        ${this.icons.plus}
                    </button>
                    ${unit ? `<span class="text-xs text-slate-500">${unit}</span>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Settings container wrapper
     */
    static settingsContainer(content) {
        return `<div class="bg-slate-50/50 px-4 py-4 space-y-4">${content}</div>`;
    }

    /**
     * Empty settings message
     */
    static noSettings() {
        return `<p class="text-xs text-slate-600 text-center py-2">설정 항목 없음</p>`;
    }

    /**
     * Text input field
     */
    static textInput(params) {
        const {
            value = '',
            actionId,
            field,
            placeholder = '',
            label = ''
        } = params;

        return `
            <div>
                ${label ? `<label class="text-xs text-slate-600 mb-2 block">${label}</label>` : ''}
                ${this.input({
                    type: 'text',
                    value,
                    actionId,
                    field,
                    placeholder
                })}
            </div>
        `;
    }

    /**
     * Button
     */
    static button(params) {
        const {
            label,
            icon = '',
            onclick = '',
            className = 'btn-outline btn-sm'
        } = params;

        return `
            <button onclick="event.stopPropagation(); ${onclick}" class="${className}">
                ${icon ? `${icon}` : ''}
                ${label}
            </button>
        `;
    }
}
