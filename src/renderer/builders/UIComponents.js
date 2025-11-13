/**
 * UIComponents
 * Centralized UI component library for consistent design across the app
 * All components return HTML strings and use design system tokens
 */

class UIComponents {
    /**
     * Alert/Info Box Components
     */
    static alert(content, variant = 'info') {
        const variants = {
            info: {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-700'
            },
            success: {
                bg: 'bg-green-50',
                border: 'border-green-200',
                text: 'text-green-700'
            },
            warning: {
                bg: 'bg-yellow-50',
                border: 'border-yellow-200',
                text: 'text-yellow-700'
            },
            error: {
                bg: 'bg-red-50',
                border: 'border-red-200',
                text: 'text-red-700'
            }
        };

        const style = variants[variant] || variants.info;

        return `
            <div class="${style.bg} border ${style.border} rounded px-3 py-2">
                <p class="text-xs ${style.text}">${content}</p>
            </div>
        `;
    }

    /**
     * Section Container with consistent padding
     */
    static section(content, spacing = 'normal') {
        const spacings = {
            compact: 'space-y-2',
            normal: 'space-y-4',
            relaxed: 'space-y-6'
        };

        const spaceClass = spacings[spacing] || spacings.normal;

        return `
            <div class="${spaceClass} px-4 py-4">
                ${content}
            </div>
        `;
    }

    /**
     * Form Group - Label + Input wrapper
     */
    static formGroup(label, content, helper = '') {
        return `
            <div>
                ${label ? `<label class="setting-label">${label}</label>` : ''}
                <div class="mt-2">
                    ${content}
                </div>
                ${helper ? `<p class="text-xs text-slate-600 mt-1">${helper}</p>` : ''}
            </div>
        `;
    }

    /**
     * Text Input Field
     */
    static textInput({ value = '', placeholder = '', actionId, field, type = 'text', disabled = false }) {
        return `
            <input
                type="${type}"
                value="${value}"
                placeholder="${placeholder}"
                ${disabled ? 'disabled' : ''}
                onclick="event.stopPropagation()"
                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                onchange="window.macroApp.updateActionValue('${actionId}', '${field}', this.value)"
            >
        `;
    }

    /**
     * Number Input Field
     */
    static numberInput({ value = 0, min, max, actionId, field, disabled = false }) {
        return `
            <input
                type="number"
                value="${value}"
                ${min !== undefined ? `min="${min}"` : ''}
                ${max !== undefined ? `max="${max}"` : ''}
                ${disabled ? 'disabled' : ''}
                onclick="event.stopPropagation()"
                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                onchange="window.macroApp.updateActionValue('${actionId}', '${field}', parseInt(this.value))"
            >
        `;
    }

    /**
     * Coordinate Input Grid (X, Y)
     */
    static coordinateInputs({ x = 0, y = 0, actionId, label = '좌표', xField = 'x', yField = 'y' }) {
        return `
            <div>
                <label class="text-xs text-slate-600 mb-2 block">${label}</label>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs">X</label>
                        ${this.numberInput({ value: x, actionId, field: xField })}
                    </div>
                    <div>
                        <label class="text-xs">Y</label>
                        ${this.numberInput({ value: y, actionId, field: yField })}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Increment Control - Number input with +/- buttons
     */
    static incrementControl({ value = 0, min = 0, max = 100, step = 1, actionId, field, unit = '', label }) {
        return `
            <div>
                ${label ? `<label class="setting-label">${label}</label>` : ''}
                <div class="flex items-center gap-2 mt-2">
                    <button
                        onclick="event.stopPropagation(); window.macroApp.updateActionValue('${actionId}', '${field}', Math.max(${min}, ${value} - ${step}))"
                        class="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        ${value <= min ? 'disabled' : ''}
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                        </svg>
                    </button>
                    <div class="flex-1 text-center">
                        <span class="font-mono text-sm font-semibold text-slate-700">${value}${unit}</span>
                    </div>
                    <button
                        onclick="event.stopPropagation(); window.macroApp.updateActionValue('${actionId}', '${field}', Math.min(${max}, ${value} + ${step}))"
                        class="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        ${value >= max ? 'disabled' : ''}
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Slider with Label
     */
    static slider({ value = 50, min = 0, max = 100, actionId, field, label, unit = '%', marks = true, helper = '' }) {
        const percentage = ((value - min) / (max - min)) * 100;

        return `
            <div>
                <label class="setting-label">
                    ${label}: <span class="font-mono text-primary-600">${value}${unit}</span>
                </label>
                <input
                    type="range"
                    class="setting-slider mt-2"
                    min="${min}"
                    max="${max}"
                    value="${value}"
                    data-action-id="${actionId}"
                    data-setting="${field}"
                    onchange="window.macroApp.updateActionSetting('${actionId}', '${field}', parseFloat(this.value))"
                >
                ${marks ? `
                    <div class="flex justify-between text-xs text-slate-500 mt-1">
                        <span>${min}${unit}</span>
                        <span>${Math.floor((min + max) / 2)}${unit}</span>
                        <span>${max}${unit}</span>
                    </div>
                ` : ''}
                ${helper ? `<p class="text-xs text-slate-600 mt-2">${helper}</p>` : ''}
            </div>
        `;
    }

    /**
     * Image Thumbnail with Border
     */
    static imageThumbnail(imagePath, alt = 'Image', maxWidth = '200px') {
        return `
            <div class="border border-slate-200 rounded overflow-hidden bg-slate-50" style="max-width: ${maxWidth};">
                <img src="${imagePath}" alt="${alt}" style="display: block; width: 100%; height: auto;">
            </div>
        `;
    }

    /**
     * Select Dropdown
     */
    static select({ value = '', options = [], actionId, field, disabled = false }) {
        return `
            <select
                ${disabled ? 'disabled' : ''}
                onclick="event.stopPropagation()"
                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                onchange="window.macroApp.updateActionValue('${actionId}', '${field}', this.value)"
            >
                ${options.map(opt => `
                    <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                        ${opt.label}
                    </option>
                `).join('')}
            </select>
        `;
    }

    /**
     * Checkbox
     */
    static checkbox({ checked = false, label, actionId, field }) {
        return `
            <label class="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    ${checked ? 'checked' : ''}
                    onclick="event.stopPropagation()"
                    class="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-600/20"
                    onchange="window.macroApp.updateActionValue('${actionId}', '${field}', this.checked)"
                >
                <span class="text-sm text-slate-700">${label}</span>
            </label>
        `;
    }

    /**
     * Button Group - Toggle buttons
     */
    static buttonGroup({ options = [], value, actionId, field }) {
        return `
            <div class="flex gap-1">
                ${options.map(opt => `
                    <button
                        onclick="event.stopPropagation(); window.macroApp.updateActionValue('${actionId}', '${field}', '${opt.value}');"
                        class="px-2 py-1 text-xs rounded transition-colors ${
                            value === opt.value
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }"
                    >
                        ${opt.label}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Divider
     */
    static divider(margin = 'my-4') {
        return `<div class="border-t border-slate-200 ${margin}"></div>`;
    }

    /**
     * Empty State Message
     */
    static emptyState(message, icon = '') {
        return `
            <div class="text-center py-8">
                ${icon ? `<div class="text-4xl mb-2">${icon}</div>` : ''}
                <p class="text-sm text-slate-500">${message}</p>
            </div>
        `;
    }

    /**
     * Code Block
     */
    static codeBlock(code) {
        return `
            <div class="bg-slate-900 text-slate-100 rounded px-3 py-2 text-xs font-mono overflow-x-auto">
                <pre>${code}</pre>
            </div>
        `;
    }

    /**
     * Grid Layout
     */
    static grid(items, columns = 2) {
        return `
            <div class="grid grid-cols-${columns} gap-4">
                ${items.join('')}
            </div>
        `;
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIComponents;
}

if (typeof window !== 'undefined') {
    window.UIComponents = UIComponents;
}
