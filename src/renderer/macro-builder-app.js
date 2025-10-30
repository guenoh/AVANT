/**
 * Macro Builder App - Main Application
 * React design implementation with vanilla JavaScript
 */

class MacroBuilderApp {
    constructor() {
        this.actions = [];
        this.selectedActionId = null;
        this.isRunning = false;
        this.macroName = '새 매크로';
        this.currentCoordinate = null;

        this.init();
    }

    init() {
        console.log('Initializing Macro Builder App...');
        this.setupEventListeners();
        this.renderScreenPreview();
        this.renderActionList();
        this.renderActionSequence();
    }

    setupEventListeners() {
        // Macro name input
        const macroNameInput = document.getElementById('macro-name-input');
        if (macroNameInput) {
            macroNameInput.addEventListener('input', (e) => {
                this.macroName = e.target.value;
            });
        }

        // Buttons
        document.getElementById('btn-run-macro')?.addEventListener('click', () => this.runMacro());
        document.getElementById('btn-export-macro')?.addEventListener('click', () => this.exportMacro());
        document.getElementById('btn-import-macro')?.addEventListener('click', () => {
            document.getElementById('import-input-seq')?.click();
        });
        document.getElementById('import-input-seq')?.addEventListener('change', (e) => this.importMacro(e));
        document.getElementById('btn-save-macro')?.addEventListener('click', () => this.saveMacro());

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');

        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.dataset.tab === tabName) {
                content.classList.remove('hidden');
                content.classList.add('active');
            } else {
                content.classList.add('hidden');
                content.classList.remove('active');
            }
        });
    }

    renderScreenPreview() {
        const container = document.getElementById('screen-preview-container');
        if (!container) return;

        container.innerHTML = `
            <div class="screen-preview-wrapper">
                <div class="screen-preview" id="screen-preview-canvas">
                    <div class="screen-preview-content">
                        <!-- Status Bar -->
                        <div class="screen-status-bar">
                            <span>12:00</span>
                            <div class="flex gap-1">
                                <div style="width: 1rem; height: 0.75rem; border: 1px solid white; border-radius: 0.125rem;"></div>
                                <div style="width: 0.75rem; height: 0.75rem; background: white; border-radius: 9999px;"></div>
                            </div>
                        </div>

                        <!-- Mock App Content -->
                        <div class="screen-app-content">
                            <div class="screen-grid">
                                <div class="screen-card">
                                    <div class="screen-card-bar screen-card-bar-primary"></div>
                                    <div class="screen-card-bar screen-card-bar-secondary"></div>
                                    <div class="screen-card-bar screen-card-bar-secondary" style="width: 66%;"></div>
                                </div>
                                <div class="screen-card">
                                    <div class="screen-card-bar screen-card-bar-primary" style="width: 50%;"></div>
                                    <div class="screen-card-bar screen-card-bar-secondary"></div>
                                    <div class="screen-card-bar screen-card-bar-secondary" style="width: 75%;"></div>
                                </div>
                                <div class="screen-card">
                                    <div class="screen-card-bar screen-card-bar-primary" style="width: 66%;"></div>
                                    <div class="screen-card-bar screen-card-bar-secondary"></div>
                                    <div class="screen-card-bar screen-card-bar-secondary" style="width: 50%;"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Navigation Bar -->
                        <div class="screen-nav-bar">
                            <div class="screen-nav-button screen-nav-button-square"></div>
                            <div class="screen-nav-button screen-nav-button-circle"></div>
                            <div class="screen-nav-button-bar"></div>
                        </div>
                    </div>
                </div>

                <!-- Selected Action Info -->
                <div id="selected-action-info"></div>
            </div>
        `;

        // Add click handler
        const screenCanvas = document.getElementById('screen-preview-canvas');
        if (screenCanvas) {
            screenCanvas.addEventListener('click', (e) => this.handleScreenClick(e));
        }
    }

    handleScreenClick(e) {
        if (!this.selectedActionId) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 1400);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 500);

        const action = this.actions.find(a => a.id === this.selectedActionId);
        if (!action) return;

        if (action.type === 'click' || action.type === 'long-press') {
            action.x = x;
            action.y = y;
            this.renderActionSequence();
            this.updateSelectedActionMarker(action);
        } else if (action.type === 'drag') {
            if (!action.x || !action.y) {
                action.x = x;
                action.y = y;
            } else {
                action.endX = x;
                action.endY = y;
            }
            this.renderActionSequence();
            this.updateSelectedActionMarker(action);
        }
    }

    updateSelectedActionMarker(action) {
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (!screenPreview) return;

        // Remove existing markers
        const existingMarkers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
        existingMarkers.forEach(m => m.remove());

        if (action.x !== undefined && action.y !== undefined) {
            const xPercent = (action.x / 1400) * 100;
            const yPercent = (action.y / 500) * 100;

            const marker = document.createElement('div');
            marker.className = 'action-marker';
            marker.style.left = `${xPercent}%`;
            marker.style.top = `${yPercent}%`;
            marker.innerHTML = '<div class="action-marker-pulse"></div>';
            screenPreview.appendChild(marker);

            // For drag, show line and end marker
            if (action.type === 'drag' && action.endX !== undefined && action.endY !== undefined) {
                const endXPercent = (action.endX / 1400) * 100;
                const endYPercent = (action.endY / 500) * 100;

                // SVG line
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('class', 'action-marker-line');
                svg.style.position = 'absolute';
                svg.style.inset = '0';
                svg.style.pointerEvents = 'none';
                svg.style.zIndex = '10';
                svg.style.width = '100%';
                svg.style.height = '100%';

                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', 'arrowhead');
                marker.setAttribute('markerWidth', '10');
                marker.setAttribute('markerHeight', '7');
                marker.setAttribute('refX', '9');
                marker.setAttribute('refY', '3.5');
                marker.setAttribute('orient', 'auto');

                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
                polygon.setAttribute('fill', '#3b82f6');

                marker.appendChild(polygon);
                defs.appendChild(marker);
                svg.appendChild(defs);

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${xPercent}%`);
                line.setAttribute('y1', `${yPercent}%`);
                line.setAttribute('x2', `${endXPercent}%`);
                line.setAttribute('y2', `${endYPercent}%`);
                line.setAttribute('stroke', '#3b82f6');
                line.setAttribute('stroke-width', '3');
                line.setAttribute('marker-end', 'url(#arrowhead)');

                svg.appendChild(line);
                screenPreview.appendChild(svg);

                // End marker
                const endMarker = document.createElement('div');
                endMarker.className = 'action-marker';
                endMarker.style.left = `${endXPercent}%`;
                endMarker.style.top = `${endYPercent}%`;
                endMarker.style.width = '1.5rem';
                endMarker.style.height = '1.5rem';
                endMarker.style.marginLeft = '-0.75rem';
                endMarker.style.marginTop = '-0.75rem';
                endMarker.style.borderColor = 'var(--green-500)';
                endMarker.style.background = 'rgba(34, 197, 94, 0.2)';
                screenPreview.appendChild(endMarker);
            }
        }

        // Update info
        this.updateSelectedActionInfo(action);
    }

    updateSelectedActionInfo(action) {
        const infoContainer = document.getElementById('selected-action-info');
        if (!infoContainer) return;

        let infoText = '';
        if (action.type === 'click') {
            infoText = `클릭: (${action.x || 0}, ${action.y || 0})`;
        } else if (action.type === 'long-press') {
            infoText = `롱프레스: (${action.x || 0}, ${action.y || 0})`;
        } else if (action.type === 'drag') {
            infoText = `드래그: (${action.x || 0}, ${action.y || 0}) → (${action.endX || 0}, ${action.endY || 0})`;
        }

        if (infoText) {
            infoContainer.innerHTML = `
                <div class="text-center text-sm space-y-1">
                    <p class="text-slate-600">현재 선택된 액션</p>
                    <div style="background: var(--blue-50); border: 1px solid var(--blue-200); border-radius: var(--radius); padding: 0.5rem 0.75rem;">
                        <p style="color: #1E3A8A;">${infoText}</p>
                    </div>
                </div>
            `;
        } else {
            infoContainer.innerHTML = '';
        }
    }

    renderActionList() {
        const actionTypes = {
            basic: [
                { type: 'click', icon: this.getIconSVG('click'), label: '클릭', description: '화면 클릭', color: 'bg-blue-500' },
                { type: 'long-press', icon: this.getIconSVG('hand'), label: '롱프레스', description: '길게 누르기', color: 'bg-purple-500' },
                { type: 'drag', icon: this.getIconSVG('move'), label: '드래그', description: '스와이프', color: 'bg-green-500' },
                { type: 'keyboard', icon: this.getIconSVG('keyboard'), label: '입력', description: '텍스트 입력', color: 'bg-orange-500' },
                { type: 'wait', icon: this.getIconSVG('clock'), label: '대기', description: '시간 대기', color: 'bg-slate-500' },
            ],
            system: [
                { type: 'home', icon: this.getIconSVG('home'), label: '홈', description: '홈 버튼', color: 'bg-cyan-500' },
                { type: 'back', icon: this.getIconSVG('arrow-left'), label: '뒤로', description: '뒤로가기', color: 'bg-pink-500' },
            ],
            image: [
                { type: 'screenshot', icon: this.getIconSVG('camera'), label: '스크린샷', description: '화면 저장', color: 'bg-violet-500' },
                { type: 'image-match', icon: this.getIconSVG('image'), label: '이미지 매칭', description: '이미지 찾기', color: 'bg-indigo-500' },
            ],
            logic: [
                { type: 'if', icon: this.getIconSVG('git-branch'), label: 'If', description: '조건문', color: 'bg-emerald-500' },
                { type: 'else-if', icon: this.getIconSVG('code'), label: 'Else If', description: '추가 조건', color: 'bg-teal-500' },
                { type: 'else', icon: this.getIconSVG('code'), label: 'Else', description: '기본 실행', color: 'bg-sky-500' },
                { type: 'end-if', icon: this.getIconSVG('x'), label: 'End If', description: '조건 종료', color: 'bg-red-500' },
                { type: 'loop', icon: this.getIconSVG('repeat'), label: 'Loop', description: '반복문', color: 'bg-pink-500' },
                { type: 'end-loop', icon: this.getIconSVG('x'), label: 'End Loop', description: '반복 종료', color: 'bg-red-500' },
                { type: 'while', icon: this.getIconSVG('rotate-cw'), label: 'While', description: '조건 반복', color: 'bg-cyan-500' },
                { type: 'end-while', icon: this.getIconSVG('x'), label: 'End While', description: 'While 종료', color: 'bg-red-500' },
                { type: 'log', icon: this.getIconSVG('file-text'), label: '로그', description: '로그 저장', color: 'bg-amber-500' },
            ]
        };

        for (const [category, actions] of Object.entries(actionTypes)) {
            const container = document.getElementById(`${category}-actions`);
            if (!container) continue;

            container.innerHTML = `
                <div class="space-y-2">
                    ${actions.map(action => this.renderActionCard(action)).join('')}
                </div>
            `;

            // Add click handlers
            actions.forEach(action => {
                const card = container.querySelector(`[data-action-type="${action.type}"]`);
                if (card) {
                    card.addEventListener('click', () => this.addAction(action.type));
                }
            });
        }
    }

    renderActionCard(action) {
        return `
            <div class="action-card" data-action-type="${action.type}">
                <div class="flex items-center gap-3">
                    <div class="action-card-icon ${action.color}">
                        ${action.icon}
                    </div>
                    <div class="action-card-content">
                        <h3 class="action-card-title">${action.label}</h3>
                        <p class="action-card-description">${action.description}</p>
                    </div>
                </div>
            </div>
        `;
    }

    addAction(type) {
        const newAction = {
            id: `action-${Date.now()}`,
            type,
            ...(type === 'wait' && { duration: 1000 }),
            ...(type === 'click' && { x: 0, y: 0 }),
            ...(type === 'long-press' && { x: 0, y: 0, duration: 1000 }),
            ...(type === 'drag' && { x: 0, y: 0, endX: 0, endY: 0 }),
            ...(type === 'keyboard' && { text: '' }),
            ...(type === 'screenshot' && { filename: 'screenshot.png' }),
            ...(type === 'log' && { message: 'Log message' }),
            ...(type === 'if' && { condition: 'condition' }),
            ...(type === 'else-if' && { condition: 'condition' }),
            ...(type === 'image-match' && { imagePath: 'image.png', threshold: 0.9 }),
            ...(type === 'loop' && { loopCount: 1 }),
            ...(type === 'while' && { condition: 'condition' }),
        };

        this.actions.push(newAction);
        this.selectedActionId = newAction.id;
        this.renderActionSequence();
    }

    renderActionSequence() {
        const container = document.getElementById('action-sequence-list');
        if (!container) return;

        const emptyState = container.querySelector('#empty-state');

        if (this.actions.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Calculate depths
        const actionsWithDepth = this.calculateDepths();

        container.innerHTML = `
            <div id="empty-state" class="empty-state" style="display: none;">
                <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p class="empty-title">매크로가 비어있습니다</p>
                <p class="empty-description">오른쪽에서 액션을 선택하여 시작하세요</p>
            </div>
            <div class="space-y-2">
                ${actionsWithDepth.map((action, index) => this.renderActionBlock(action, index, actionsWithDepth.length)).join('')}
            </div>
        `;

        // Add event listeners
        this.actions.forEach((action, index) => {
            const block = container.querySelector(`[data-action-id="${action.id}"]`);
            if (block) {
                block.addEventListener('click', () => this.selectAction(action.id));

                const deleteBtn = block.querySelector('.btn-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteAction(action.id);
                    });
                }

                const upBtn = block.querySelector('.btn-move-up');
                if (upBtn) {
                    upBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.moveAction(action.id, 'up');
                    });
                }

                const downBtn = block.querySelector('.btn-move-down');
                if (downBtn) {
                    downBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.moveAction(action.id, 'down');
                    });
                }
            }
        });
    }

    calculateDepths() {
        const blockStartTypes = ['if', 'else-if', 'else', 'loop', 'while'];
        const blockEndTypes = ['end-if', 'end-loop', 'end-while'];
        const blockMidTypes = ['else-if', 'else'];

        let currentDepth = 0;
        return this.actions.map((action) => {
            let actionDepth = currentDepth;

            if (blockMidTypes.includes(action.type)) {
                actionDepth = Math.max(0, currentDepth - 1);
            }

            if (blockEndTypes.includes(action.type)) {
                currentDepth = Math.max(0, currentDepth - 1);
                actionDepth = currentDepth;
            }

            const result = { ...action, depth: actionDepth };

            if (blockStartTypes.includes(action.type) && !blockMidTypes.includes(action.type)) {
                currentDepth++;
            } else if (action.type === 'if') {
                currentDepth++;
            } else if (blockMidTypes.includes(action.type)) {
                currentDepth = actionDepth + 1;
            }

            return result;
        });
    }

    renderActionBlock(action, index, total) {
        const config = this.getActionConfig(action.type);
        const isSelected = this.selectedActionId === action.id;
        const isRunning = this.isRunning && isSelected;
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const depth = action.depth || 0;

        const description = this.getActionDescription(action);

        // Border and background styles based on selection
        let cardStyle = 'border: 2px solid var(--slate-200); background: white;';
        if (isSelected) {
            cardStyle = `border: 2px solid var(${config.borderColorVar}); background: var(${config.bgColorVar});`;
        }
        if (isRunning) {
            cardStyle += ' box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5); animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;';
        }

        return `
            <div style="margin-left: ${depth * 24}px; position: relative;" data-action-id="${action.id}">
                ${depth > 0 ? '<div style="position: absolute; left: -12px; top: 0; bottom: 0; width: 2px; background-color: var(--slate-300);"></div>' : ''}
                ${!isLast ? `<div class="action-connector" style="left: ${24 + depth * 24}px;"></div>` : ''}

                <div class="action-block" style="${cardStyle} border-radius: var(--radius); cursor: pointer; transition: all 0.2s; ${isSelected ? '' : 'hover: box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);'}">
                    <div class="p-4">
                        <div class="flex items-start gap-3">
                            <!-- Index Badge -->
                            <div style="flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 9999px; background: white; border: 2px solid var(--slate-300); display: flex; align-items: center; justify-content: center; font-size: 0.875rem; font-weight: 500; color: var(--slate-700);">
                                ${index + 1}
                            </div>

                            <!-- Icon -->
                            <div class="action-card-icon ${config.color}">
                                ${config.icon}
                            </div>

                            <!-- Content -->
                            <div class="action-card-content">
                                <h3 style="font-size: var(--text-base); font-weight: 500; color: var(--slate-900); margin: 0 0 0.25rem 0;">${config.label}</h3>
                                ${description ? `<p style="font-size: var(--text-sm); color: var(--slate-600); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${description}</p>` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex gap-1 flex-shrink-0">
                                <button class="btn-sm btn-move-up" ${isFirst ? 'disabled' : ''} style="width: 2rem; height: 2rem; padding: 0; display: flex; align-items: center; justify-content: center;">
                                    ${this.getIconSVG('chevron-up')}
                                </button>
                                <button class="btn-sm btn-move-down" ${isLast ? 'disabled' : ''} style="width: 2rem; height: 2rem; padding: 0; display: flex; align-items: center; justify-content: center;">
                                    ${this.getIconSVG('chevron-down')}
                                </button>
                                <button class="btn-sm btn-delete" style="width: 2rem; height: 2rem; padding: 0; color: var(--red-500); display: flex; align-items: center; justify-content: center;">
                                    ${this.getIconSVG('trash')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getActionConfig(type) {
        const configs = {
            'click': { label: '클릭', color: 'bg-blue-500', borderColorVar: '--blue-500', bgColorVar: '--blue-50', icon: this.getIconSVG('click') },
            'long-press': { label: '롱프레스', color: 'bg-purple-500', borderColorVar: '--purple-500', bgColorVar: '--purple-50', icon: this.getIconSVG('hand') },
            'drag': { label: '드래그', color: 'bg-green-500', borderColorVar: '--green-500', bgColorVar: '--green-50', icon: this.getIconSVG('move') },
            'keyboard': { label: '키보드 입력', color: 'bg-orange-500', borderColorVar: '--orange-500', bgColorVar: '--orange-50', icon: this.getIconSVG('keyboard') },
            'wait': { label: '대기', color: 'bg-slate-500', borderColorVar: '--slate-600', bgColorVar: '--slate-50', icon: this.getIconSVG('clock') },
            'home': { label: '홈 버튼', color: 'bg-cyan-500', borderColorVar: '--cyan-500', bgColorVar: '--cyan-50', icon: this.getIconSVG('home') },
            'back': { label: '뒤로가기', color: 'bg-pink-500', borderColorVar: '--pink-500', bgColorVar: '--pink-50', icon: this.getIconSVG('arrow-left') },
            'screenshot': { label: '스크린샷', color: 'bg-violet-500', borderColorVar: '--violet-500', bgColorVar: '--violet-50', icon: this.getIconSVG('camera') },
            'image-match': { label: '이미지 매칭', color: 'bg-indigo-500', borderColorVar: '--indigo-500', bgColorVar: '--indigo-50', icon: this.getIconSVG('image') },
            'if': { label: 'If', color: 'bg-emerald-500', borderColorVar: '--emerald-500', bgColorVar: '--emerald-50', icon: this.getIconSVG('git-branch') },
            'else-if': { label: 'Else If', color: 'bg-teal-500', borderColorVar: '--teal-500', bgColorVar: '--teal-50', icon: this.getIconSVG('code') },
            'else': { label: 'Else', color: 'bg-sky-500', borderColorVar: '--sky-500', bgColorVar: '--sky-50', icon: this.getIconSVG('code') },
            'log': { label: '로그', color: 'bg-amber-500', borderColorVar: '--amber-500', bgColorVar: '--amber-50', icon: this.getIconSVG('file-text') },
            'loop': { label: 'Loop', color: 'bg-pink-500', borderColorVar: '--pink-500', bgColorVar: '--pink-50', icon: this.getIconSVG('repeat') },
            'while': { label: 'While', color: 'bg-cyan-500', borderColorVar: '--cyan-500', bgColorVar: '--cyan-50', icon: this.getIconSVG('rotate-cw') },
            'end-if': { label: 'End If', color: 'bg-red-500', borderColorVar: '--red-500', bgColorVar: '--red-50', icon: this.getIconSVG('x') },
            'end-loop': { label: 'End Loop', color: 'bg-red-500', borderColorVar: '--red-500', bgColorVar: '--red-50', icon: this.getIconSVG('x') },
            'end-while': { label: 'End While', color: 'bg-red-500', borderColorVar: '--red-500', bgColorVar: '--red-50', icon: this.getIconSVG('x') },
        };
        return configs[type] || configs['click'];
    }

    getActionDescription(action) {
        switch (action.type) {
            case 'click':
                return `좌표: (${action.x || 0}, ${action.y || 0})`;
            case 'long-press':
                return `좌표: (${action.x || 0}, ${action.y || 0}), ${action.duration || 1000}ms`;
            case 'drag':
                return `(${action.x || 0}, ${action.y || 0}) → (${action.endX || 0}, ${action.endY || 0})`;
            case 'keyboard':
                return action.text || '텍스트 미입력';
            case 'wait':
                return `${action.duration || 1000}ms 대기`;
            case 'screenshot':
                return action.filename || 'screenshot.png';
            case 'image-match':
                return `${action.imagePath || 'image.png'} (${Math.round((action.threshold || 0.9) * 100)}%)`;
            case 'if':
            case 'else-if':
            case 'while':
                return action.condition || '조건 미설정';
            case 'log':
                return action.message || '로그 메시지';
            case 'loop':
                return `${action.loopCount || 1}회 반복`;
            case 'home':
            case 'back':
                return '시스템 버튼';
            default:
                return '';
        }
    }

    selectAction(id) {
        this.selectedActionId = id;
        this.renderActionSequence();

        const action = this.actions.find(a => a.id === id);
        if (action) {
            this.updateSelectedActionMarker(action);
        }
    }

    deleteAction(id) {
        this.actions = this.actions.filter(a => a.id !== id);
        if (this.selectedActionId === id) {
            this.selectedActionId = null;
        }
        this.renderActionSequence();
    }

    moveAction(id, direction) {
        const index = this.actions.findIndex(a => a.id === id);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= this.actions.length) return;

        [this.actions[index], this.actions[newIndex]] = [this.actions[newIndex], this.actions[index]];
        this.renderActionSequence();
    }

    async runMacro() {
        this.isRunning = true;
        const runBtn = document.getElementById('btn-run-macro');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                실행 중...
            `;
        }

        for (let i = 0; i < this.actions.length; i++) {
            this.selectedActionId = this.actions[i].id;
            this.renderActionSequence();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.isRunning = false;
        this.selectedActionId = null;
        this.renderActionSequence();

        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                실행
            `;
        }
    }

    exportMacro() {
        const data = JSON.stringify(this.actions, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'macro.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    importMacro(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target?.result);
                this.actions = imported;
                this.renderActionSequence();
            } catch (error) {
                console.error('Failed to import macro:', error);
                alert('매크로 파일을 불러오는데 실패했습니다.');
            }
        };
        reader.readAsText(file);
    }

    saveMacro() {
        console.log('Saving macro:', this.macroName, this.actions);
        alert(`매크로 "${this.macroName}"이(가) 저장되었습니다!`);
    }

    getIconSVG(name) {
        const icons = {
            'click': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>',
            'hand': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"></path></svg>',
            'move': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>',
            'keyboard': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>',
            'clock': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            'home': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>',
            'arrow-left': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>',
            'camera': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
            'image': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>',
            'git-branch': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>',
            'code': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>',
            'repeat': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>',
            'rotate-cw': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>',
            'x': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
            'file-text': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>',
            'chevron-up': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>',
            'chevron-down': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>',
            'trash': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',
        };
        return icons[name] || icons['click'];
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.macroApp = new MacroBuilderApp();
});
