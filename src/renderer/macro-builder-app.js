/**
 * Macro Builder App - Main Application
 * React design implementation with vanilla JavaScript
 */

class MacroBuilderApp {
    constructor() {
        this.actions = [];
        this.selectedActionId = null;
        this.expandedActionId = null;
        this.expandedConditionId = null;
        this.isRunning = false;
        this.macroName = '새 매크로';
        this.currentCoordinate = null;

        // Device screen resolution
        this.screenWidth = 1400; // Default, will be updated on device connect
        this.screenHeight = 500; // Default, will be updated on device connect

        // Coordinate picking mode
        this.isPickingCoordinate = false;
        this.pendingActionType = null;
        this.dragStartPoint = null; // For drag action: stores first click point

        // Region selection for image-match
        this.isSelectingRegion = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        // Log output
        this.logs = [];

        // Device connection
        this.isDeviceConnected = false;
        this.deviceType = null; // 'adb' or 'isap'
        this.deviceName = null;
        this.fps = 0;
        this.adbDevices = null; // Store ADB device list

        this.init();
    }

    init() {
        console.log('Initializing Macro Builder App...');
        this.setupEventListeners();
        this.renderScreenPreview();
        this.renderActionList();
        this.renderActionSequence();
        this.renderDeviceStatus();
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

        // Device connection buttons
        document.getElementById('btn-connect-adb')?.addEventListener('click', () => this.connectDevice('adb'));
        document.getElementById('btn-connect-isap')?.addEventListener('click', () => this.connectDevice('isap'));

        // Device card click to restore collapsed cards
        document.querySelector('.device-connection-methods')?.addEventListener('click', (e) => {
            const card = e.target.closest('.device-method-card');
            if (card && card.classList.contains('collapsed')) {
                this.restoreDeviceCards();
            }
        });

        // ESC key to deselect action or cancel coordinate picking
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Priority 1: Cancel coordinate picking if active
                if (this.isPickingCoordinate) {
                    this.cancelCoordinatePicking();
                    this.clearScreenMarkers(); // Remove any markers from screen
                    return;
                }

                // Priority 2: Deselect action if one is selected
                if (this.selectedActionId) {
                    this.selectedActionId = null;
                    this.renderActionSequence();
                    this.clearScreenMarkers(); // Remove markers from screen
                }
            }
        });

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Action list - use event delegation
        this.isDraggingAction = false;
        document.getElementById('action-list-container')?.addEventListener('click', (e) => {
            // Ignore click if drag just happened
            if (this.isDraggingAction) {
                this.isDraggingAction = false;
                return;
            }

            const actionCard = e.target.closest('.action-card');
            if (actionCard) {
                const actionType = actionCard.dataset.actionType;
                if (actionType) {
                    this.addAction(actionType);
                }
            }
        });

        // ESC key to cancel coordinate picking
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPickingCoordinate) {
                this.cancelCoordinatePicking();
            }
        });

        // Screen preview click handling - removed, now handled in renderScreenPreview once

        // Mouse move for tooltip
        document.addEventListener('mousemove', (e) => {
            if (this.isPickingCoordinate) {
                this.updatePickingTooltip(e);
            }
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
        // Don't render preview if device not connected
        if (!this.isDeviceConnected) {
            return;
        }

        const container = document.getElementById('screen-preview-container');
        if (!container) return;

        container.innerHTML = `
            <div class="screen-preview-with-log">
                <!-- Screen Preview Display (80%) -->
                <div class="screen-preview-display">
                    <div class="screen-preview" id="screen-preview-canvas">
                        <img id="screen-stream-image" draggable="false" style="width: 100%; height: 100%; object-fit: contain; background: #1e293b; user-select: none; -webkit-user-drag: none;" />
                    </div>
                </div>

                <!-- Log Output Area (20%) - Separate section -->
                <div class="log-output-container" id="log-output-container">
                    <div class="log-output-header">
                        <p class="log-output-title">실행 로그</p>
                        <button class="btn-ghost" id="btn-clear-logs" style="padding: 0.25rem 0.5rem;">
                            <svg style="width: 0.875rem; height: 0.875rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="log-output-content" id="log-output-content">
                        <div class="log-entry">
                            <span class="log-timestamp">00:00:00</span>
                            <span class="log-level log-level-info">[INFO]</span>
                            <span class="log-message">매크로 빌더 준비 완료</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add mouse event handlers
        const screenCanvas = document.getElementById('screen-preview-canvas');
        if (screenCanvas) {
            screenCanvas.addEventListener('click', (e) => this.handleScreenClick(e));
            screenCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            screenCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            screenCanvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            screenCanvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        }

        // Add clear logs button handler
        const clearLogsBtn = document.getElementById('btn-clear-logs');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }

        // Initialize with welcome log
        this.addLog('info', '매크로 빌더 준비 완료');
    }

    handleScreenClick(e) {
        // Get the actual img element bounds (not the container)
        const img = document.getElementById('screen-stream-image');
        if (!img) {
            console.warn('[handleScreenClick] screen-stream-image not found');
            return;
        }

        const imgRect = img.getBoundingClientRect();

        // Calculate click position relative to the actual image (not container)
        const clickX = e.clientX - imgRect.left;
        const clickY = e.clientY - imgRect.top;

        // Check if click is within the actual image bounds
        if (clickX < 0 || clickX > imgRect.width || clickY < 0 || clickY > imgRect.height) {
            return;
        }

        // Convert to device coordinates
        const x = Math.round((clickX / imgRect.width) * this.screenWidth);
        const y = Math.round((clickY / imgRect.height) * this.screenHeight);

        // If in coordinate picking mode, create new action
        if (this.isPickingCoordinate) {
            this.handleScreenPreviewClick(e);
            return;
        }

        // If no action selected, just show coordinates
        if (!this.selectedActionId) {
            this.addLog('info', `좌표: (${x}, ${y})`);
            return;
        }

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

    handleMouseDown(e) {
        const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
        if (!selectedAction || selectedAction.type !== 'image-match') {
            return;
        }

        // Prevent default drag behavior
        e.preventDefault();

        const coords = this.getScaledCoordinates(e);
        if (!coords) return;

        // Clear existing region when starting new selection
        if (selectedAction.region) {
            selectedAction.region = undefined;
            this.renderActionSequence();
        }

        this.isSelectingRegion = true;
        this.selectionStart = coords;
        this.selectionEnd = coords;
    }

    handleMouseMove(e) {
        const coords = this.getScaledCoordinates(e);
        if (!coords) return;

        // Update current coordinate display
        this.currentCoordinate = coords;

        // Update selection rectangle if selecting region
        if (this.isSelectingRegion && this.selectionStart) {
            e.preventDefault(); // Prevent default drag behavior during selection
            this.selectionEnd = coords;
            this.renderSelectionOverlay();
        }
    }

    handleMouseUp(e) {
        const coords = this.getScaledCoordinates(e);
        if (!coords) return;

        const selectedAction = this.actions.find(a => a.id === this.selectedActionId);

        if (selectedAction && selectedAction.type === 'image-match' && this.isSelectingRegion && this.selectionStart) {
            const region = {
                x: Math.min(this.selectionStart.x, coords.x),
                y: Math.min(this.selectionStart.y, coords.y),
                width: Math.abs(coords.x - this.selectionStart.x),
                height: Math.abs(coords.y - this.selectionStart.y),
            };

            // Only update if region is at least 10x10 pixels
            if (region.width >= 10 && region.height >= 10) {
                selectedAction.region = region;

                // Capture the region image immediately
                this.captureRegionImage(selectedAction);

                this.renderActionSequence();
                this.addLog('success', `영역 선택: ${region.width}×${region.height}`);
            }

            this.isSelectingRegion = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.renderSelectionOverlay();
        }
    }

    handleMouseLeave() {
        this.currentCoordinate = null;
        if (this.isSelectingRegion) {
            this.isSelectingRegion = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.renderSelectionOverlay();
        }
    }

    getScaledCoordinates(e) {
        const img = document.getElementById('screen-stream-image');
        if (!img) return null;

        const imgRect = img.getBoundingClientRect();
        const clickX = e.clientX - imgRect.left;
        const clickY = e.clientY - imgRect.top;

        // Check if click is within the actual image bounds
        if (clickX < 0 || clickX > imgRect.width || clickY < 0 || clickY > imgRect.height) {
            return null;
        }

        const x = Math.round((clickX / imgRect.width) * this.screenWidth);
        const y = Math.round((clickY / imgRect.height) * this.screenHeight);

        return {
            x: Math.max(0, Math.min(this.screenWidth, x)),
            y: Math.max(0, Math.min(this.screenHeight, y)),
        };
    }

    renderSelectionOverlay() {
        // This will be called by updateSelectedActionMarker
        const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
        if (selectedAction) {
            this.updateSelectedActionMarker(selectedAction);
        }
    }

    updateSelectedActionMarker(action) {
        const screenPreview = document.getElementById('screen-preview-canvas');
        const img = document.getElementById('screen-stream-image');

        if (!screenPreview || !img) {
            return;
        }

        // Remove existing markers
        const existingMarkers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
        existingMarkers.forEach(m => m.remove());

        if (action.x !== undefined && action.y !== undefined) {
            // Get img bounds relative to container
            const containerRect = screenPreview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Calculate marker position in pixels relative to container
            const imgX = (action.x / this.screenWidth) * imgRect.width;
            const imgY = (action.y / this.screenHeight) * imgRect.height;

            // Convert to position relative to container
            const markerX = (imgRect.left - containerRect.left) + imgX;
            const markerY = (imgRect.top - containerRect.top) + imgY;

            const marker = document.createElement('div');
            marker.className = 'action-marker';
            marker.style.left = `${markerX}px`;
            marker.style.top = `${markerY}px`;
            marker.innerHTML = '<div class="action-marker-pulse"></div>';
            screenPreview.appendChild(marker);

            // For drag, show line and end marker
            if (action.type === 'drag' && action.endX !== undefined && action.endY !== undefined) {
                // Calculate end marker position in pixels
                const endImgX = (action.endX / this.screenWidth) * imgRect.width;
                const endImgY = (action.endY / this.screenHeight) * imgRect.height;
                const endMarkerX = (imgRect.left - containerRect.left) + endImgX;
                const endMarkerY = (imgRect.top - containerRect.top) + endImgY;

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
                line.setAttribute('x1', `${markerX}`);
                line.setAttribute('y1', `${markerY}`);
                line.setAttribute('x2', `${endMarkerX}`);
                line.setAttribute('y2', `${endMarkerY}`);
                line.setAttribute('stroke', '#3b82f6');
                line.setAttribute('stroke-width', '3');
                line.setAttribute('marker-end', 'url(#arrowhead)');

                svg.appendChild(line);
                screenPreview.appendChild(svg);

                // End marker
                const endMarker = document.createElement('div');
                endMarker.className = 'action-marker';
                endMarker.style.left = `${endMarkerX}px`;
                endMarker.style.top = `${endMarkerY}px`;
                endMarker.style.width = '1.5rem';
                endMarker.style.height = '1.5rem';
                endMarker.style.marginLeft = '-0.75rem';
                endMarker.style.marginTop = '-0.75rem';
                endMarker.style.borderColor = 'var(--green-500)';
                endMarker.style.background = 'rgba(34, 197, 94, 0.2)';
                screenPreview.appendChild(endMarker);
            }
        }

        // Render image-match region marker
        if (action.type === 'image-match' && action.region) {
            const containerRect = screenPreview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Calculate region position and size
            const regionX = (action.region.x / this.screenWidth) * imgRect.width;
            const regionY = (action.region.y / this.screenHeight) * imgRect.height;
            const regionWidth = (action.region.width / this.screenWidth) * imgRect.width;
            const regionHeight = (action.region.height / this.screenHeight) * imgRect.height;

            // Convert to position relative to container
            const markerX = (imgRect.left - containerRect.left) + regionX;
            const markerY = (imgRect.top - containerRect.top) + regionY;

            // Create region rectangle
            const regionMarker = document.createElement('div');
            regionMarker.className = 'action-marker';
            regionMarker.style.left = `${markerX}px`;
            regionMarker.style.top = `${markerY}px`;
            regionMarker.style.width = `${regionWidth}px`;
            regionMarker.style.height = `${regionHeight}px`;
            regionMarker.style.border = '2px solid #6366f1';
            regionMarker.style.background = 'rgba(99, 102, 241, 0.2)';
            regionMarker.style.borderRadius = '4px';
            regionMarker.style.marginLeft = '0';
            regionMarker.style.marginTop = '0';
            regionMarker.style.transform = 'none';

            // Create size label
            const sizeLabel = document.createElement('div');
            sizeLabel.style.position = 'absolute';
            sizeLabel.style.top = '-24px';
            sizeLabel.style.left = '0';
            sizeLabel.style.background = '#6366f1';
            sizeLabel.style.color = 'white';
            sizeLabel.style.fontSize = '11px';
            sizeLabel.style.padding = '2px 8px';
            sizeLabel.style.borderRadius = '4px';
            sizeLabel.style.whiteSpace = 'nowrap';
            sizeLabel.textContent = `${action.region.width} × ${action.region.height}`;

            regionMarker.appendChild(sizeLabel);
            screenPreview.appendChild(regionMarker);
        }

        // Render live selection rectangle while dragging
        if (this.isSelectingRegion && this.selectionStart && this.selectionEnd) {
            const containerRect = screenPreview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Calculate selection region
            const selectionRegion = {
                x: Math.min(this.selectionStart.x, this.selectionEnd.x),
                y: Math.min(this.selectionStart.y, this.selectionEnd.y),
                width: Math.abs(this.selectionEnd.x - this.selectionStart.x),
                height: Math.abs(this.selectionEnd.y - this.selectionStart.y),
            };

            // Calculate position and size in pixels
            const regionX = (selectionRegion.x / this.screenWidth) * imgRect.width;
            const regionY = (selectionRegion.y / this.screenHeight) * imgRect.height;
            const regionWidth = (selectionRegion.width / this.screenWidth) * imgRect.width;
            const regionHeight = (selectionRegion.height / this.screenHeight) * imgRect.height;

            // Convert to position relative to container
            const markerX = (imgRect.left - containerRect.left) + regionX;
            const markerY = (imgRect.top - containerRect.top) + regionY;

            // Create selection rectangle
            const selectionMarker = document.createElement('div');
            selectionMarker.className = 'action-marker';
            selectionMarker.style.left = `${markerX}px`;
            selectionMarker.style.top = `${markerY}px`;
            selectionMarker.style.width = `${regionWidth}px`;
            selectionMarker.style.height = `${regionHeight}px`;
            selectionMarker.style.border = '2px solid #6366f1';
            selectionMarker.style.background = 'rgba(99, 102, 241, 0.2)';
            selectionMarker.style.borderRadius = '4px';
            selectionMarker.style.marginLeft = '0';
            selectionMarker.style.marginTop = '0';
            selectionMarker.style.transform = 'none';

            // Create size label
            const sizeLabel = document.createElement('div');
            sizeLabel.style.position = 'absolute';
            sizeLabel.style.top = '-24px';
            sizeLabel.style.left = '0';
            sizeLabel.style.background = '#6366f1';
            sizeLabel.style.color = 'white';
            sizeLabel.style.fontSize = '11px';
            sizeLabel.style.padding = '2px 8px';
            sizeLabel.style.borderRadius = '4px';
            sizeLabel.style.whiteSpace = 'nowrap';
            sizeLabel.textContent = `${selectionRegion.width} × ${selectionRegion.height}`;

            selectionMarker.appendChild(sizeLabel);
            screenPreview.appendChild(selectionMarker);
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
                { type: 'test', icon: this.getIconSVG('settings'), label: '테스트', description: 'UI 컴포넌트', color: 'bg-fuchsia-500' },
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
        // If already in coordinate picking mode, cancel it first (ESC effect)
        if (this.isPickingCoordinate) {
            this.cancelCoordinatePicking();
        }

        // Always deselect current action when starting to add new action
        // This ensures only one action is selected at a time (either in macro list or action list)
        this.selectedActionId = null;

        // Clear markers from screen
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (screenPreview) {
            const markers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
            markers.forEach(m => m.remove());
        }

        // Re-render to update selection state in macro list
        this.renderActionSequence();

        // For click, long-press, and drag, enter coordinate picking mode
        if (type === 'click' || type === 'long-press' || type === 'drag') {
            this.startCoordinatePicking(type);
            return;
        }

        const newAction = {
            id: `action-${Date.now()}`,
            type,
            ...(type === 'wait' && { duration: 1000 }),
            ...(type === 'keyboard' && { text: '' }),
            ...(type === 'screenshot' && { filename: 'screenshot.png' }),
            ...(type === 'log' && { message: 'Log message' }),
            ...(type === 'if' && { conditions: [] }),
            ...(type === 'else-if' && { conditions: [] }),
            ...(type === 'image-match' && { imagePath: 'image.png', threshold: 0.9 }),
            ...(type === 'loop' && { loopCount: 1 }),
            ...(type === 'while' && { conditions: [] }),
        };

        this.actions.push(newAction);
        this.selectedActionId = newAction.id;
        this.renderActionSequence();
    }

    renderActionSequence() {
        const container = document.getElementById('action-sequence-list');
        if (!container) return;

        // Save scroll position
        const scrollTop = container.scrollTop;

        if (this.actions.length === 0) {
            container.innerHTML = `
                <div id="empty-state" class="empty-state" style="display: flex;">
                    <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <p class="empty-title">매크로가 비어있습니다</p>
                    <p class="empty-description">오른쪽에서 액션을 선택하여 시작하세요</p>
                </div>
            `;
            return;
        }

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
                block.addEventListener('click', (e) => {
                    // Ignore click if dragging or clicked on drag handle
                    if (this.isDraggingAction || e.target.closest('.drag-handle')) {
                        return;
                    }
                    this.selectAction(action.id);
                });

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

        // Restore scroll position
        container.scrollTop = scrollTop;

        // Update marker for selected action (if any)
        if (this.selectedActionId) {
            const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
            if (selectedAction) {
                // Use requestAnimationFrame to ensure DOM is ready
                requestAnimationFrame(() => {
                    this.updateSelectedActionMarker(selectedAction);
                });
            }
        }

        // Render thumbnails for image-match actions
        requestAnimationFrame(() => {
            this.actions.forEach(action => {
                if (action.type === 'image-match' && action.region) {
                    this.renderImageThumbnail(action);
                }
            });
        });
    }

    captureRegionImage(action) {
        if (!action.region) return;

        const sourceImg = document.getElementById('screen-stream-image');
        if (!sourceImg || !sourceImg.complete) return;

        const region = action.region;

        // Create a temporary canvas to capture the region
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = region.width;
        tempCanvas.height = region.height;
        const ctx = tempCanvas.getContext('2d');

        try {
            // Draw the selected region from the source image
            ctx.drawImage(
                sourceImg,
                region.x, region.y, region.width, region.height,
                0, 0, region.width, region.height
            );

            // Store the captured image as a data URL
            action.regionImage = tempCanvas.toDataURL('image/png');
        } catch (e) {
            console.error('Failed to capture region image:', e);
        }
    }

    renderImageThumbnail(action) {
        const canvas = document.getElementById(`thumbnail-${action.id}`);
        if (!canvas || !action.region) return;

        // If we have a stored region image, use it
        if (action.regionImage) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                const region = action.region;

                // Set canvas size to region size (maintain aspect ratio)
                const maxHeight = 80; // max-height: 80px from CSS
                const aspectRatio = region.width / region.height;

                let displayWidth = region.width;
                let displayHeight = region.height;

                // Scale down if too tall
                if (displayHeight > maxHeight) {
                    displayHeight = maxHeight;
                    displayWidth = maxHeight * aspectRatio;
                }

                canvas.width = region.width;
                canvas.height = region.height;
                canvas.style.width = `${displayWidth}px`;
                canvas.style.height = `${displayHeight}px`;

                // Draw the stored image
                ctx.drawImage(img, 0, 0);
            };
            img.src = action.regionImage;
        }
    }

    // Drag and Drop handlers
    handleActionBlockDragStart(event, actionId) {
        this.isDraggingAction = true;
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;

        event.dataTransfer.setData('actionId', actionId);
        event.dataTransfer.setData('actionType', action.type);
        event.dataTransfer.effectAllowed = 'copy';

        // Set custom drag image to the action block itself
        const actionBlock = event.target.closest('[data-action-id]');
        if (actionBlock) {
            const dragImage = actionBlock.querySelector('.action-block');
            if (dragImage) {
                event.dataTransfer.setDragImage(dragImage, 20, 20);
            }
        }
    }

    handleActionDragEnd(event) {
        setTimeout(() => {
            this.isDraggingAction = false;
        }, 100);
    }

    handleConditionDrop(event, targetActionId) {
        const draggedActionId = event.dataTransfer.getData('actionId');
        if (!draggedActionId) return;

        const draggedAction = this.actions.find(a => a.id === draggedActionId);
        if (!draggedAction) return;

        // Only allow certain action types as conditions
        const allowedTypes = ['image-match', 'click', 'long-press', 'wait'];
        if (!allowedTypes.includes(draggedAction.type)) {
            this.addLog('warning', `${this.getActionTypeLabel(draggedAction.type)} 액션은 조건으로 사용할 수 없습니다. (image-match, click, long-press, wait만 가능)`);
            return;
        }

        // Copy action parameters to condition
        this.addConditionFromAction(targetActionId, draggedAction);
    }

    // Condition management functions
    addConditionFromAction(targetActionId, sourceAction) {
        const targetAction = this.actions.find(a => a.id === targetActionId);
        if (!targetAction || !targetAction.conditions) return;

        // Copy all params from source action (not just specific ones)
        const params = { ...sourceAction };
        delete params.id;
        delete params.type;

        const newCondition = {
            id: `cond-${Date.now()}`,
            actionType: sourceAction.type,
            params: params,
            operator: targetAction.conditions.length > 0 ? 'AND' : null
        };

        targetAction.conditions.push(newCondition);

        // Remove source action from scenario (MOVE, not COPY)
        const sourceIndex = this.actions.findIndex(a => a.id === sourceAction.id);
        if (sourceIndex !== -1) {
            this.actions.splice(sourceIndex, 1);
        }

        this.renderActionSequence();
        this.addLog('success', `조건 추가: ${this.getActionTypeLabel(sourceAction.type)}`);
    }

    removeCondition(actionId, conditionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const index = action.conditions.findIndex(c => c.id === conditionId);
        if (index === -1) return;

        action.conditions.splice(index, 1);

        // Update operator for last condition
        if (action.conditions.length > 0) {
            action.conditions[action.conditions.length - 1].operator = null;
        }

        this.renderActionSequence();
    }

    updateConditionType(actionId, conditionId, actionType) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.actionType = actionType;

        // Reset params based on action type
        switch (actionType) {
            case 'image-match':
                condition.params = { imagePath: 'image.png', threshold: 0.9 };
                break;
            case 'click':
            case 'long-press':
                condition.params = { x: 0, y: 0 };
                break;
            default:
                condition.params = {};
        }

        this.renderActionSequence();
    }

    updateConditionParam(actionId, conditionId, paramName, paramValue) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.params[paramName] = paramValue;
        this.renderActionSequence();
    }

    updateConditionOperator(actionId, conditionId, operator) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.operator = operator;
        this.renderActionSequence();
    }

    getActionTypeLabel(type) {
        const labels = {
            'image-match': '이미지 매칭',
            'click': '클릭',
            'long-press': '롱프레스',
            'wait': '대기'
        };
        return labels[type] || type;
    }

    renderConditionCard(actionId, condition, index, totalConditions) {
        const isLast = index === totalConditions - 1;
        const isFirst = index === 0;
        const config = this.getActionConfig(condition.actionType);

        // Create temporary action object for description
        const tempAction = {
            type: condition.actionType,
            ...condition.params
        };
        const description = this.getActionDescription(tempAction);

        const isExpanded = this.expandedConditionId === condition.id;

        return `
            <div>
                <!-- Condition Block -->
                <div class="bg-white border-2 border-slate-200 hover:border-slate-300 rounded-lg" onclick="event.stopPropagation()" style="transition: all 0.2s;">
                    <div class="p-3">
                        <div class="flex items-center gap-3">
                            <!-- Icon -->
                            <div class="${config.color} p-2 rounded-lg text-white flex-shrink-0 flex items-center justify-center" style="width: 2.5rem; height: 2.5rem;">
                                <div style="width: 1.25rem; height: 1.25rem;">
                                    ${config.icon}
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <h3 class="text-slate-900 mb-1 font-medium">${config.label}</h3>
                                ${description ? `<p class="text-sm text-slate-600 truncate">${description}</p>` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex gap-1 flex-shrink-0">
                                <button class="btn-ghost h-8 w-8 p-0" onclick="event.stopPropagation(); window.macroApp.toggleConditionSettings('${condition.id}')">
                                    ${this.getIconSVG('settings')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0" ${isFirst ? 'disabled' : ''} onclick="event.stopPropagation(); window.macroApp.moveCondition('${actionId}', '${condition.id}', 'up')">
                                    ${this.getIconSVG('chevron-up')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0" ${isLast ? 'disabled' : ''} onclick="event.stopPropagation(); window.macroApp.moveCondition('${actionId}', '${condition.id}', 'down')">
                                    ${this.getIconSVG('chevron-down')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onclick="event.stopPropagation(); window.macroApp.removeCondition('${actionId}', '${condition.id}')">
                                    ${this.getIconSVG('trash')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Settings -->
                    ${isExpanded ? this.renderConditionSettings(actionId, condition) : ''}
                </div>

                <!-- AND/OR Connector -->
                ${!isLast ? `
                    <div class="flex items-center justify-center my-2">
                        <select
                            class="px-3 py-1 border ${condition.operator === 'OR' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-blue-300 bg-blue-50 text-blue-700'} rounded-full text-xs font-medium shadow-sm"
                            value="${condition.operator || 'AND'}"
                            onclick="event.stopPropagation()"
                            onchange="window.macroApp.updateConditionOperator('${actionId}', '${condition.id}', this.value)"
                            style="cursor: pointer;"
                        >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                        </select>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderConditionSettings(actionId, condition) {
        // Create a temporary action object from condition
        const tempAction = {
            id: condition.id,
            type: condition.actionType,
            ...condition.params
        };

        // Get the same settings HTML as regular actions
        let settingsHTML = this.getSettingsHTML(tempAction);

        // Replace updateActionValue calls with updateConditionParam calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.updateActionValue\('([^']+)',\s*'([^']+)',/g,
            `window.macroApp.updateConditionParam('${actionId}', '${condition.id}', '$2',`
        );

        return `
            <div class="settings-panel border-t border-slate-200 bg-slate-50 px-8 py-5" style="border-bottom-left-radius: var(--radius); border-bottom-right-radius: var(--radius); overflow: hidden;">
                ${settingsHTML}
            </div>
        `;
    }

    renderConditionParams(actionId, condition) {
        switch (condition.actionType) {
            case 'image-match':
                return `
                    <div>
                        <label class="text-xs mb-1 block text-slate-600">이미지 이름</label>
                        <input type="text" value="${condition.params.imagePath || 'image.png'}"
                            class="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-7"
                            placeholder="이미지 이름"
                            onclick="event.stopPropagation()"
                            onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'imagePath', this.value)">
                    </div>
                    <div>
                        <label class="text-xs mb-1 block text-slate-600">매칭 정확도: ${Math.round((condition.params.threshold || 0.9) * 100)}%</label>
                        <input type="range"
                            value="${Math.round((condition.params.threshold || 0.9) * 100)}"
                            min="50"
                            max="100"
                            step="1"
                            class="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-emerald-500"
                            onclick="event.stopPropagation()"
                            oninput="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'threshold', parseFloat(this.value) / 100)"
                            onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'threshold', parseFloat(this.value) / 100)">
                    </div>
                `;
            case 'click':
            case 'long-press':
                return `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs mb-1 block text-slate-600">X</label>
                            <input type="number" value="${condition.params.x || 0}"
                                class="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-7"
                                onclick="event.stopPropagation()"
                                onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'x', parseInt(this.value))">
                        </div>
                        <div>
                            <label class="text-xs mb-1 block text-slate-600">Y</label>
                            <input type="number" value="${condition.params.y || 0}"
                                class="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-7"
                                onclick="event.stopPropagation()"
                                onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'y', parseInt(this.value))">
                        </div>
                    </div>
                `;
            case 'wait':
                return `
                    <div>
                        <label class="text-xs mb-1 block text-slate-600">대기 시간: ${condition.params.duration || 1000}ms</label>
                        <input type="range"
                            value="${condition.params.duration || 1000}"
                            min="100"
                            max="10000"
                            step="100"
                            class="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-emerald-500"
                            onclick="event.stopPropagation()"
                            oninput="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'duration', parseInt(this.value))"
                            onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'duration', parseInt(this.value))">
                    </div>
                `;
            default:
                return '';
        }
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
        const isExpanded = action.id === this.expandedActionId;

        // Border classes based on selection
        const borderClass = isSelected ? config.borderClass : 'border-slate-200 hover:border-slate-300';
        const ringClass = isRunning ? 'ring-4 ring-blue-400 ring-opacity-50 animate-pulse' : '';

        return `
            <div style="margin-left: ${depth * 24}px; position: relative;" data-action-id="${action.id}">
                ${depth > 0 ? '<div style="position: absolute; left: -12px; top: 0; bottom: 0; width: 2px; background-color: var(--slate-300);"></div>' : ''}
                ${!isLast ? `<div class="action-connector" style="left: ${24 + depth * 24}px;"></div>` : ''}

                <div class="action-block ${config.bgClass} border-2 ${borderClass} ${ringClass} ${isSelected ? 'shadow-lg' : ''} ${isExpanded ? 'expanded' : ''}" style="border-radius: var(--radius); cursor: pointer; transition: all 0.2s; position: relative;">
                    <div class="p-4">
                        <div class="flex items-center gap-3">
                            <!-- Drag Handle -->
                            <div class="drag-handle flex-shrink-0"
                                draggable="true"
                                onclick="event.stopPropagation()"
                                ondragstart="window.macroApp.handleActionBlockDragStart(event, '${action.id}')"
                                ondragend="window.macroApp.handleActionDragEnd(event)"
                                style="cursor: grab; padding: 0.25rem; opacity: 0.3; transition: opacity 0.2s;"
                                onmouseenter="this.style.opacity='0.6'"
                                onmouseleave="this.style.opacity='0.3'">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="9" cy="5" r="2"/>
                                    <circle cx="9" cy="12" r="2"/>
                                    <circle cx="9" cy="19" r="2"/>
                                    <circle cx="15" cy="5" r="2"/>
                                    <circle cx="15" cy="12" r="2"/>
                                    <circle cx="15" cy="19" r="2"/>
                                </svg>
                            </div>

                            <!-- Index Badge -->
                            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-sm text-slate-700">
                                ${index + 1}
                            </div>

                            <!-- Icon -->
                            <div class="${config.color} p-2 rounded-lg text-white flex-shrink-0 flex items-center justify-center" style="width: 2.5rem; height: 2.5rem;">
                                <div style="width: 1.25rem; height: 1.25rem;">
                                    ${config.icon}
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <h3 class="text-slate-900 mb-1">${config.label}</h3>
                                ${description ? `<p class="text-sm text-slate-600 truncate">${description}</p>` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex gap-1 flex-shrink-0">
                                ${!['end-if', 'end-loop', 'end-while', 'else'].includes(action.type) ? `
                                <button class="btn-ghost h-8 w-8 p-0" onclick="event.stopPropagation(); window.macroApp.toggleActionSettings('${action.id}')">
                                    ${this.getIconSVG('settings')}
                                </button>
                                ` : ''}
                                <button class="btn-ghost h-8 w-8 p-0 btn-move-up" ${isFirst ? 'disabled' : ''}>
                                    ${this.getIconSVG('chevron-up')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0 btn-move-down" ${isLast ? 'disabled' : ''}>
                                    ${this.getIconSVG('chevron-down')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 btn-delete">
                                    ${this.getIconSVG('trash')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Settings -->
                    ${isExpanded ? this.renderActionSettings(action) : ''}
                </div>
            </div>
        `;
    }

    renderActionSettings(action) {
        return `
            <div class="settings-panel border-t border-slate-200 bg-white px-8 py-5" onclick="event.stopPropagation()" style="border-bottom-left-radius: var(--radius); border-bottom-right-radius: var(--radius); overflow: hidden;">
                ${this.getSettingsHTML(action)}
            </div>
        `;
    }

    getSettingsHTML(action) {
        switch (action.type) {
            case 'click':
            case 'long-press':
                return `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs mb-2 block">X</label>
                            <input type="number" value="${action.x || 0}"
                                class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                                onchange="window.macroApp.updateActionValue('${action.id}', 'x', parseInt(this.value))">
                        </div>
                        <div>
                            <label class="text-xs mb-2 block">Y</label>
                            <input type="number" value="${action.y || 0}"
                                class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                                onchange="window.macroApp.updateActionValue('${action.id}', 'y', parseInt(this.value))">
                        </div>
                    </div>
                    ${action.type === 'long-press' ? `
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="text-xs">지속 시간</label>
                            <span class="text-xs text-slate-600">${action.duration || 1000}ms</span>
                        </div>
                        <input type="range"
                            value="${action.duration || 1000}"
                            min="100"
                            max="5000"
                            step="100"
                            class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            oninput="window.macroApp.updateActionValue('${action.id}', 'duration', parseInt(this.value))"
                            onchange="window.macroApp.updateActionValue('${action.id}', 'duration', parseInt(this.value))">
                    </div>
                    ` : ''}
                `;
            case 'drag':
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="text-xs text-slate-600 mb-2 block">시작점</label>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-xs mb-2 block">X</label>
                                    <input type="number" value="${action.x || 0}"
                                        class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                                        onchange="window.macroApp.updateActionValue('${action.id}', 'x', parseInt(this.value))">
                                </div>
                                <div>
                                    <label class="text-xs mb-2 block">Y</label>
                                    <input type="number" value="${action.y || 0}"
                                        class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                                        onchange="window.macroApp.updateActionValue('${action.id}', 'y', parseInt(this.value))">
                                </div>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs text-slate-600 mb-2 block">종료점</label>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-xs mb-2 block">X</label>
                                    <input type="number" value="${action.endX || 0}"
                                        class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                                        onchange="window.macroApp.updateActionValue('${action.id}', 'endX', parseInt(this.value))">
                                </div>
                                <div>
                                    <label class="text-xs mb-2 block">Y</label>
                                    <input type="number" value="${action.endY || 0}"
                                        class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                                        onchange="window.macroApp.updateActionValue('${action.id}', 'endY', parseInt(this.value))">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 'keyboard':
                return `
                    <div>
                        <label class="text-xs mb-2 block">입력 텍스트</label>
                        <input type="text" value="${action.text || ''}"
                            class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                            placeholder="입력할 텍스트를 입력하세요"
                            onchange="window.macroApp.updateActionValue('${action.id}', 'text', this.value)">
                    </div>
                `;
            case 'wait':
                return `
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="text-xs">대기 시간</label>
                            <span class="text-xs text-slate-600">${action.duration || 1000}ms</span>
                        </div>
                        <input type="range"
                            value="${action.duration || 1000}"
                            min="100"
                            max="10000"
                            step="100"
                            class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                            oninput="window.macroApp.updateActionValue('${action.id}', 'duration', parseInt(this.value))"
                            onchange="window.macroApp.updateActionValue('${action.id}', 'duration', parseInt(this.value))">
                    </div>
                `;
            case 'screenshot':
                return `
                    <div>
                        <label class="text-xs mb-2 block">파일 이름</label>
                        <input type="text" value="${action.filename || 'screenshot.png'}"
                            class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                            placeholder="스크린샷 파일 이름"
                            onchange="window.macroApp.updateActionValue('${action.id}', 'filename', this.value)">
                    </div>
                `;
            case 'image-match':
                return `
                    <div class="space-y-4">
                        ${action.region ? `
                            <div class="grid grid-cols-2 gap-3">
                                <!-- Left: Selected Region -->
                                <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                    <div class="flex items-center justify-between mb-2">
                                        <label class="text-xs text-purple-900 font-medium">선택된 영역</label>
                                        <button
                                            class="btn-ghost h-6 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                                            onclick="event.stopPropagation(); window.macroApp.updateActionValue('${action.id}', 'region', undefined)"
                                        >
                                            초기화
                                        </button>
                                    </div>

                                    <!-- Image Thumbnail -->
                                    <div class="mb-2 flex items-center justify-center bg-white rounded border border-purple-200 p-2">
                                        <canvas
                                            id="thumbnail-${action.id}"
                                            class="max-w-full"
                                            style="image-rendering: pixelated; max-height: 80px;"
                                        ></canvas>
                                    </div>

                                    <div class="text-xs text-slate-600">
                                        <div>위치: (${action.region.x}, ${action.region.y})</div>
                                        <div>크기: ${action.region.width} × ${action.region.height}</div>
                                    </div>
                                </div>

                                <!-- Right: Settings -->
                                <div class="space-y-3">
                                    <div>
                                        <label class="text-xs mb-2 block">이미지 이름</label>
                                        <input type="text" value="${action.imagePath || 'image.png'}"
                                            class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                                            placeholder="매칭할 이미지 이름"
                                            onchange="window.macroApp.updateActionValue('${action.id}', 'imagePath', this.value)">
                                    </div>

                                    <div>
                                        <div class="flex items-center justify-between mb-2">
                                            <label class="text-xs">매칭 정확도</label>
                                            <span class="text-xs font-semibold text-purple-600" id="threshold-value-${action.id}">${Math.round((action.threshold || 0.9) * 100)}%</span>
                                        </div>
                                        <div style="position: relative; height: 8px;">
                                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: #e2e8f0; border-radius: 9999px;"></div>
                                            <div
                                                id="threshold-bar-${action.id}"
                                                style="position: absolute; top: 0; left: 0; bottom: 0; width: ${((action.threshold || 0.9) * 100 - 50) * 2}%; background: linear-gradient(to right, #c084fc, #9333ea); border-radius: 9999px; transition: all 0.2s;"></div>
                                            <input type="range"
                                                value="${Math.round((action.threshold || 0.9) * 100)}"
                                                min="50"
                                                max="100"
                                                step="1"
                                                style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; opacity: 0; cursor: pointer; z-index: 10;"
                                                oninput="
                                                    const percent = (this.value - 50) * 2;
                                                    document.getElementById('threshold-bar-${action.id}').style.width = percent + '%';
                                                    document.getElementById('threshold-value-${action.id}').textContent = Math.round(this.value) + '%';
                                                "
                                                onchange="window.macroApp.updateActionValue('${action.id}', 'threshold', parseFloat(this.value) / 100)">
                                        </div>
                                        <div class="flex justify-between mt-1">
                                            <span class="text-xs text-slate-400">50%</span>
                                            <span class="text-xs text-slate-400">100%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div class="bg-slate-100 border border-slate-200 rounded-lg p-3 text-center">
                                <p class="text-xs text-slate-600">
                                    스크린 프리뷰에서 드래그하여<br />매칭 영역을 선택하세요
                                </p>
                            </div>
                        `}
                    </div>
                `;
            case 'if':
            case 'else-if':
            case 'while':
                return `
                    <div class="space-y-3">
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-xs font-medium text-slate-700">조건 목록</label>
                            <span class="text-xs text-slate-500">${action.conditions?.length || 0}개</span>
                        </div>

                        ${action.conditions && action.conditions.length > 0 ? `
                            <div class="space-y-2">
                                ${action.conditions.map((cond, index) => this.renderConditionCard(action.id, cond, index, action.conditions.length)).join('')}
                            </div>
                        ` : ''}

                        <!-- Drop Zone -->
                        <div
                            class="condition-drop-zone border border-dashed border-slate-300 bg-slate-50 rounded-md p-2.5 text-center transition-all hover:border-blue-400 hover:bg-blue-50"
                            ondragover="event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.add('border-blue-400', 'bg-blue-50')"
                            ondragleave="event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')"
                            ondrop="event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); window.macroApp.handleConditionDrop(event, '${action.id}')"
                            onclick="event.stopPropagation()"
                        >
                            <p class="text-xs text-slate-500">
                                <span style="opacity: 0.5;">+</span> 액션을 드래그하여 조건 추가
                            </p>
                        </div>
                    </div>
                `;
            case 'loop':
                return `
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="text-xs">반복 횟수</label>
                            <span class="text-xs text-slate-600">${action.loopCount || 1}회</span>
                        </div>
                        <input type="range"
                            value="${action.loopCount || 1}"
                            min="1"
                            max="100"
                            step="1"
                            class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                            oninput="window.macroApp.updateActionValue('${action.id}', 'loopCount', parseInt(this.value))"
                            onchange="window.macroApp.updateActionValue('${action.id}', 'loopCount', parseInt(this.value))">
                    </div>
                `;
            case 'log':
                return `
                    <div>
                        <label class="text-xs mb-2 block">로그 메시지</label>
                        <input type="text" value="${action.message || ''}"
                            class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-8"
                            placeholder="로그 메시지를 입력하세요"
                            onchange="window.macroApp.updateActionValue('${action.id}', 'message', this.value)">
                    </div>
                `;
            case 'test':
                return `
                    <!-- Design System Test - Simple Monochrome -->
                    <div class="bg-slate-50/50 px-4 py-4 space-y-4">
                        <!-- Text Input -->
                        <div>
                            <label class="text-xs mb-2 block">입력 텍스트</label>
                            <input
                                type="text"
                                value="Sample text"
                                onclick="event.stopPropagation()"
                                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                placeholder="입력할 텍스트를 입력하세요"
                            >
                        </div>

                        <!-- Coordinates -->
                        <div>
                            <label class="text-xs text-slate-600 mb-2 block">좌표</label>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-xs">X</label>
                                    <input
                                        type="number"
                                        value="100"
                                        onclick="event.stopPropagation()"
                                        class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                    >
                                </div>
                                <div>
                                    <label class="text-xs">Y</label>
                                    <input
                                        type="number"
                                        value="200"
                                        onclick="event.stopPropagation()"
                                        class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                    >
                                </div>
                            </div>
                        </div>

                        <!-- Start Point & End Point (Drag) -->
                        <div class="space-y-3">
                            <div>
                                <label class="text-xs text-slate-600 mb-2 block">시작점</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs">X</label>
                                        <input
                                            type="number"
                                            value="100"
                                            onclick="event.stopPropagation()"
                                            class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                        >
                                    </div>
                                    <div>
                                        <label class="text-xs">Y</label>
                                        <input
                                            type="number"
                                            value="200"
                                            onclick="event.stopPropagation()"
                                            class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                        >
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="text-xs text-slate-600 mb-2 block">종료점</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs">X</label>
                                        <input
                                            type="number"
                                            value="300"
                                            onclick="event.stopPropagation()"
                                            class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                        >
                                    </div>
                                    <div>
                                        <label class="text-xs">Y</label>
                                        <input
                                            type="number"
                                            value="400"
                                            onclick="event.stopPropagation()"
                                            class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300"
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Duration Slider -->
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <label class="text-xs">지속 시간</label>
                                <span class="text-xs text-slate-600">1000ms</span>
                            </div>
                            <input
                                type="range"
                                value="1000"
                                min="100"
                                max="5000"
                                step="100"
                                class="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-slate-500 shadow-inner"
                            >
                        </div>

                        <!-- Wait Duration -->
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <label class="text-xs">대기 시간</label>
                                <span class="text-xs text-slate-600">3000ms</span>
                            </div>
                            <input
                                type="range"
                                value="3000"
                                min="100"
                                max="10000"
                                step="100"
                                class="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-slate-500 shadow-inner"
                            >
                        </div>

                        <!-- Select Box -->
                        <div>
                            <label class="text-xs mb-2 block">선택 옵션</label>
                            <select
                                onclick="event.stopPropagation()"
                                class="w-full h-8 px-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 hover:border-slate-300 cursor-pointer"
                            >
                                <option>옵션 1</option>
                                <option selected>옵션 2</option>
                                <option>옵션 3</option>
                            </select>
                        </div>

                        <!-- Checkboxes -->
                        <div>
                            <label class="text-xs mb-2 block">체크박스</label>
                            <div class="space-y-2">
                                <label class="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" checked onclick="event.stopPropagation()" class="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-2 focus:ring-slate-400/20 transition-colors shadow-sm">
                                    <span class="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">옵션 1</span>
                                </label>
                                <label class="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" onclick="event.stopPropagation()" class="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-2 focus:ring-slate-400/20 transition-colors shadow-sm">
                                    <span class="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">옵션 2</span>
                                </label>
                            </div>
                        </div>

                        <!-- Radio Buttons -->
                        <div>
                            <label class="text-xs mb-2 block">라디오 버튼</label>
                            <div class="space-y-2">
                                <label class="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="radio" name="test-radio" checked onclick="event.stopPropagation()" class="w-4 h-4 border-slate-300 text-slate-600 focus:ring-2 focus:ring-slate-400/20 transition-colors shadow-sm">
                                    <span class="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">옵션 A</span>
                                </label>
                                <label class="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="radio" name="test-radio" onclick="event.stopPropagation()" class="w-4 h-4 border-slate-300 text-slate-600 focus:ring-2 focus:ring-slate-400/20 transition-colors shadow-sm">
                                    <span class="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">옵션 B</span>
                                </label>
                            </div>
                        </div>

                        <!-- Toggle Switch -->
                        <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                                <span class="text-sm text-slate-700">즉시 실행</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" checked onclick="event.stopPropagation()">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>

                        <!-- Progress Bar -->
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <label class="text-xs">프로그레스</label>
                                <span class="text-xs text-slate-600">75%</span>
                            </div>
                            <div class="relative h-4 bg-slate-200 rounded-lg overflow-hidden border border-slate-300" style="height: 16px;">
                                <div class="absolute top-0 bottom-0 left-0 bg-slate-700 transition-all duration-300" style="width: 75%; height: 100%;"></div>
                            </div>
                        </div>

                        <!-- Info Card -->
                        <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <p class="text-xs text-slate-700 leading-relaxed">
                                이것은 정보 메시지입니다. 사용자에게 추가 정보를 제공할 때 사용합니다.
                            </p>
                        </div>

                        <!-- Buttons -->
                        <div class="flex gap-2 flex-wrap">
                            <button class="btn-primary">Primary</button>
                            <button class="btn-secondary">Secondary</button>
                            <button class="btn-tertiary">Tertiary</button>
                        </div>
                    </div>
                `;
            case 'home':
            case 'back':
                return `<p class="text-xs text-slate-600 text-center py-2">이 액션은 별도 설정이 필요하지 않습니다.</p>`;
            default:
                return '';
        }
    }

    toggleActionSettings(id) {
        if (this.expandedActionId === id) {
            this.expandedActionId = null;
        } else {
            this.expandedActionId = id;
        }
        this.renderActionSequence();
    }

    toggleConditionSettings(conditionId) {
        if (this.expandedConditionId === conditionId) {
            this.expandedConditionId = null;
        } else {
            this.expandedConditionId = conditionId;
        }
        this.renderActionSequence();
    }

    moveCondition(actionId, conditionId, direction) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const index = action.conditions.findIndex(c => c.id === conditionId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= action.conditions.length) return;

        // Swap conditions
        [action.conditions[index], action.conditions[newIndex]] =
            [action.conditions[newIndex], action.conditions[index]];

        this.renderActionSequence();
    }

    updateActionValue(id, key, value) {
        const action = this.actions.find(a => a.id === id);
        if (action) {
            action[key] = value;
            // Don't re-render to avoid losing focus
        }
    }

    getActionConfig(type) {
        const configs = {
            'click': { label: '클릭', color: 'bg-blue-500', borderClass: 'border-blue-500', bgClass: 'bg-blue-50', icon: this.getIconSVG('click') },
            'long-press': { label: '롱프레스', color: 'bg-purple-500', borderClass: 'border-purple-500', bgClass: 'bg-purple-50', icon: this.getIconSVG('hand') },
            'drag': { label: '드래그', color: 'bg-green-500', borderClass: 'border-green-500', bgClass: 'bg-green-50', icon: this.getIconSVG('move') },
            'keyboard': { label: '키보드 입력', color: 'bg-orange-500', borderClass: 'border-orange-500', bgClass: 'bg-orange-50', icon: this.getIconSVG('keyboard') },
            'wait': { label: '대기', color: 'bg-slate-500', borderClass: 'border-slate-600', bgClass: 'bg-slate-50', icon: this.getIconSVG('clock') },
            'home': { label: '홈 버튼', color: 'bg-cyan-500', borderClass: 'border-cyan-500', bgClass: 'bg-cyan-50', icon: this.getIconSVG('home') },
            'back': { label: '뒤로가기', color: 'bg-pink-500', borderClass: 'border-pink-500', bgClass: 'bg-pink-50', icon: this.getIconSVG('arrow-left') },
            'screenshot': { label: '스크린샷', color: 'bg-violet-500', borderClass: 'border-violet-500', bgClass: 'bg-violet-50', icon: this.getIconSVG('camera') },
            'image-match': { label: '이미지 매칭', color: 'bg-indigo-500', borderClass: 'border-indigo-500', bgClass: 'bg-indigo-50', icon: this.getIconSVG('image') },
            'if': { label: 'If', color: 'bg-emerald-500', borderClass: 'border-emerald-500', bgClass: 'bg-emerald-50', icon: this.getIconSVG('git-branch') },
            'else-if': { label: 'Else If', color: 'bg-teal-500', borderClass: 'border-teal-500', bgClass: 'bg-teal-50', icon: this.getIconSVG('code') },
            'else': { label: 'Else', color: 'bg-sky-500', borderClass: 'border-sky-500', bgClass: 'bg-sky-50', icon: this.getIconSVG('code') },
            'log': { label: '로그', color: 'bg-amber-500', borderClass: 'border-amber-500', bgClass: 'bg-amber-50', icon: this.getIconSVG('file-text') },
            'loop': { label: 'Loop', color: 'bg-pink-500', borderClass: 'border-pink-500', bgClass: 'bg-pink-50', icon: this.getIconSVG('repeat') },
            'while': { label: 'While', color: 'bg-cyan-500', borderClass: 'border-cyan-500', bgClass: 'bg-cyan-50', icon: this.getIconSVG('rotate-cw') },
            'end-if': { label: 'End If', color: 'bg-red-500', borderClass: 'border-red-500', bgClass: 'bg-red-50', icon: this.getIconSVG('x') },
            'end-loop': { label: 'End Loop', color: 'bg-red-500', borderClass: 'border-red-500', bgClass: 'bg-red-50', icon: this.getIconSVG('x') },
            'end-while': { label: 'End While', color: 'bg-red-500', borderClass: 'border-red-500', bgClass: 'bg-red-50', icon: this.getIconSVG('x') },
            'test': { label: '테스트', color: 'bg-fuchsia-500', borderClass: 'border-fuchsia-500', bgClass: 'bg-fuchsia-50', icon: this.getIconSVG('settings') },
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
                if (action.region) {
                    return `영역: ${action.region.width}×${action.region.height} • ${Math.round((action.threshold || 0.9) * 100)}%`;
                }
                return `${action.imagePath || 'image.png'} • ${Math.round((action.threshold || 0.9) * 100)}%)`;
            case 'if':
            case 'else-if':
            case 'while':
                if (!action.conditions || action.conditions.length === 0) {
                    return '조건 없음';
                }
                // Show condition summary: "image-match, click"
                const conditionTypes = action.conditions.map(c => {
                    const config = this.getActionConfig(c.actionType);
                    return config.label;
                }).join(', ');
                return conditionTypes;
            case 'log':
                return action.message || '로그 메시지';
            case 'loop':
                return `${action.loopCount || 1}회 반복`;
            case 'home':
            case 'back':
                return '시스템 버튼';
            case 'test':
                return 'UI 컴포넌트 샘플';
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

        // If deleted action was selected, clear selection and markers
        if (this.selectedActionId === id) {
            this.selectedActionId = null;

            // Clear all markers from screen
            const screenPreview = document.getElementById('screen-preview-canvas');
            if (screenPreview) {
                const markers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
                markers.forEach(m => m.remove());
            }
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
        if (!this.isDeviceConnected) {
            this.addLog('error', '장치가 연결되지 않았습니다');
            return;
        }

        if (this.actions.length === 0) {
            this.addLog('warning', '실행할 액션이 없습니다');
            return;
        }

        this.isRunning = true;
        const runBtn = document.getElementById('btn-run-macro');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                실행 중...
            `;
        }

        this.addLog('info', `매크로 실행 시작: ${this.macroName}`);

        await this.executeActionsRange(0, this.actions.length);

        this.isRunning = false;
        this.selectedActionId = null;
        this.renderActionSequence();
        this.clearScreenMarkers();

        this.addLog('success', '매크로 실행 완료');

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

    async executeActionsRange(startIndex, endIndex) {
        let i = startIndex;

        while (i < endIndex) {
            const action = this.actions[i];

            // Highlight current action
            this.selectedActionId = action.id;
            this.renderActionSequence();
            this.updateSelectedActionMarker(action);

            try {
                // Handle control flow actions
                if (action.type === 'if' || action.type === 'else-if') {
                    const conditionResult = await this.evaluateConditions(action.conditions);

                    if (conditionResult) {
                        // Execute block until else-if/else/end-if
                        const blockEnd = this.findBlockEnd(i, ['else-if', 'else', 'end-if']);
                        await this.executeActionsRange(i + 1, blockEnd);
                        // Skip to end-if
                        i = this.findBlockEnd(i, ['end-if']) + 1;
                    } else {
                        // Skip to next else-if/else/end-if
                        i = this.findBlockEnd(i, ['else-if', 'else', 'end-if']);

                        // Don't execute the else-if/else block yet, let loop handle it
                        continue;
                    }
                } else if (action.type === 'else') {
                    // If we reach else, it means previous if/else-if were false
                    // Execute until end-if
                    const blockEnd = this.findBlockEnd(i, ['end-if']);
                    await this.executeActionsRange(i + 1, blockEnd);
                    i = blockEnd + 1;
                } else if (action.type === 'while') {
                    const whileStart = i;
                    const whileEnd = this.findBlockEnd(i, ['end-while']);

                    // Execute while loop
                    let iterations = 0;
                    const maxIterations = 1000; // Safety limit

                    while (iterations < maxIterations) {
                        const conditionResult = await this.evaluateConditions(action.conditions);

                        if (!conditionResult) break;

                        await this.executeActionsRange(whileStart + 1, whileEnd);
                        iterations++;
                    }

                    if (iterations >= maxIterations) {
                        this.addLog('warning', 'While loop reached maximum iterations (1000)');
                    }

                    i = whileEnd + 1;
                } else if (action.type === 'loop') {
                    const loopStart = i;
                    const loopEnd = this.findBlockEnd(i, ['end-loop']);
                    const loopCount = action.loopCount || 1;

                    for (let j = 0; j < loopCount; j++) {
                        await this.executeActionsRange(loopStart + 1, loopEnd);
                    }

                    i = loopEnd + 1;
                } else if (action.type === 'end-if' || action.type === 'end-loop' || action.type === 'end-while') {
                    // Skip end markers
                    i++;
                } else {
                    // Regular action - execute it
                    const result = await this.executeAction(action);

                    if (result.success) {
                        this.addLog('success', `${this.getActionTypeName(action.type)} 실행 완료`);
                    } else {
                        this.addLog('error', `${this.getActionTypeName(action.type)} 실행 실패: ${result.error}`);
                    }

                    // Get delay from option
                    const delay = parseInt(document.getElementById('option-delay')?.value || 300);
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    i++;
                }
            } catch (error) {
                this.addLog('error', `액션 실행 오류: ${error.message}`);
                break;
            }
        }
    }

    findBlockEnd(startIndex, endTypes) {
        let depth = 0;
        const blockStartTypes = ['if', 'else-if', 'loop', 'while'];
        const blockEndTypes = ['end-if', 'end-loop', 'end-while'];

        for (let i = startIndex; i < this.actions.length; i++) {
            const action = this.actions[i];

            if (i === startIndex) {
                // Start counting depth from the first action
                if (blockStartTypes.includes(action.type)) {
                    depth = 1;
                }
                continue;
            }

            // Increase depth for nested blocks
            if (blockStartTypes.includes(action.type) && !['else-if', 'else'].includes(action.type)) {
                depth++;
            }

            // Check if this is one of the end types we're looking for
            if (endTypes.includes(action.type) && depth === 1) {
                return i;
            }

            // Decrease depth for block end
            if (blockEndTypes.includes(action.type)) {
                depth--;
                if (depth === 0) return i;
            }
        }

        return this.actions.length;
    }

    async evaluateConditions(conditions) {
        if (!conditions || conditions.length === 0) {
            return false;
        }

        // Group conditions by AND operator
        const andGroups = [];
        let currentGroup = [];

        for (const condition of conditions) {
            currentGroup.push(condition);

            // If this is the last condition or next operator is OR, close the group
            if (!condition.operator || condition.operator === 'OR') {
                andGroups.push(currentGroup);
                currentGroup = [];
            }
        }

        // Evaluate each AND group
        const groupResults = [];
        for (const group of andGroups) {
            let groupResult = true;

            for (const condition of group) {
                // Create action object from condition
                const conditionAction = {
                    id: condition.id,
                    type: condition.actionType,
                    ...condition.params
                };

                // Execute condition action
                const result = await this.executeAction(conditionAction);

                this.addLog('info', `조건 평가: ${condition.actionType} = ${result.success ? 'true' : 'false'}`);

                // AND operation
                groupResult = groupResult && result.success;

                // Short-circuit: if any condition in AND group is false, skip rest
                if (!groupResult) break;
            }

            groupResults.push(groupResult);
        }

        // OR all groups together
        const finalResult = groupResults.some(r => r);
        this.addLog('info', `최종 조건 결과: ${finalResult ? 'true' : 'false'}`);

        return finalResult;
    }

    async executeAction(action) {
        try {
            // Map frontend action format to backend format
            const backendAction = this.mapActionToBackend(action);
            console.log('[executeAction] Original action:', action);
            console.log('[executeAction] Backend action:', backendAction);
            console.log('[executeAction] window.api:', window.api);
            console.log('[executeAction] window.api.action:', window.api?.action);

            const result = await window.api.action.execute(backendAction);
            console.log('[executeAction] Result:', result);
            return result;
        } catch (error) {
            console.error('[executeAction] Error:', error);
            return { success: false, error: error.message };
        }
    }

    mapActionToBackend(action) {
        const mapped = { type: action.type };

        switch (action.type) {
            case 'click':
                return { type: 'tap', x: action.x, y: action.y, duration: 100 };
            case 'long-press':
                return { type: 'tap', x: action.x, y: action.y, duration: action.duration || 1000 };
            case 'drag':
                return { type: 'swipe', x1: action.x, y1: action.y, x2: action.endX, y2: action.endY, duration: action.duration || 300 };
            case 'input':
                return { type: 'input', text: action.text };
            case 'wait':
                return { type: 'wait', delay: action.delay || 1000 };
            case 'home':
                return { type: 'key', keyCode: 3 }; // HOME
            case 'back':
                return { type: 'key', keyCode: 4 }; // BACK
            case 'scroll':
                return { type: 'scroll', direction: action.direction || 'down', amount: action.amount || 300 };
            default:
                return action;
        }
    }

    getActionTypeName(type) {
        const names = {
            'click': '클릭',
            'long-press': '롱프레스',
            'drag': '드래그',
            'input': '텍스트 입력',
            'wait': '대기',
            'home': '홈 버튼',
            'back': '뒤로 버튼',
            'scroll': '스크롤'
        };
        return names[type] || type;
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
            'settings': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
            'chevron-up': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>',
            'chevron-down': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>',
            'trash': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',
        };
        return icons[name] || icons['click'];
    }

    // Coordinate picking methods
    startCoordinatePicking(type) {
        this.isPickingCoordinate = true;
        this.pendingActionType = type;

        // Add visual feedback
        document.body.classList.add('picking-coordinate');

        // Add visual indicator to the action card
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            if (card.dataset.actionType === type) {
                card.classList.add('picking-active');
            }
        });

        // Create tooltip
        this.createPickingTooltip();
    }

    cancelCoordinatePicking() {
        this.isPickingCoordinate = false;
        this.pendingActionType = null;
        this.dragStartPoint = null; // Reset drag start point

        // Remove visual feedback
        document.body.classList.remove('picking-coordinate');

        // Remove visual indicator from action cards
        const actionCards = document.querySelectorAll('.action-card.picking-active');
        actionCards.forEach(card => card.classList.remove('picking-active'));

        // Remove tooltip
        const tooltip = document.getElementById('coordinate-picking-tooltip');
        if (tooltip) {
            tooltip.remove();
        }

        // Clear any screen markers left from coordinate picking
        this.clearScreenMarkers();
    }

    createPickingTooltip() {
        // Remove existing tooltip
        const existing = document.getElementById('coordinate-picking-tooltip');
        if (existing) {
            existing.remove();
        }

        // Create message based on action type
        let message = '화면을 클릭하여 좌표를 선택하세요';
        if (this.pendingActionType === 'drag') {
            message = '화면을 클릭하여 첫번째 지점을 선택하세요';
        }

        // Create new tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'coordinate-picking-tooltip';
        tooltip.innerHTML = `
            <div class="coordinate-tooltip">
                <p>${message}</p>
                <p class="coordinate-tooltip-hint">ESC 키로 취소</p>
            </div>
        `;
        document.body.appendChild(tooltip);
    }

    updatePickingTooltip(e) {
        const tooltip = document.getElementById('coordinate-picking-tooltip');
        if (tooltip) {
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        }
    }

    handleScreenPreviewClick(e) {
        // Get the actual img element bounds (not the container)
        const img = document.getElementById('screen-stream-image');
        if (!img) {
            console.warn('[handleScreenPreviewClick] screen-stream-image not found');
            return;
        }

        // Calculate coordinates relative to the actual image and convert to device coordinates
        const imgRect = img.getBoundingClientRect();
        const clickX = e.clientX - imgRect.left;
        const clickY = e.clientY - imgRect.top;

        // Check if click is within the actual image bounds
        if (clickX < 0 || clickX > imgRect.width || clickY < 0 || clickY > imgRect.height) {
            console.warn('[handleScreenPreviewClick] Click outside image bounds');
            return;
        }

        const x = Math.round((clickX / imgRect.width) * this.screenWidth);
        const y = Math.round((clickY / imgRect.height) * this.screenHeight);

        // Handle drag action (requires two clicks)
        if (this.pendingActionType === 'drag') {
            if (!this.dragStartPoint) {
                // First click - store start point and show marker
                this.dragStartPoint = { x, y };
                this.addLog('info', `드래그 시작점: (${x}, ${y})`);

                // Show start point marker on screen
                this.showDragStartMarker(x, y);

                // Update tooltip to ask for end point
                this.updatePickingTooltipMessage();
            } else {
                // Second click - create drag action with start and end points
                this.createDragAction(this.dragStartPoint.x, this.dragStartPoint.y, x, y);

                // Exit picking mode
                this.cancelCoordinatePicking();
            }
        } else {
            // Handle click and long-press (single click)
            this.createActionWithCoordinate(this.pendingActionType, x, y);

            // Exit picking mode
            this.cancelCoordinatePicking();
        }
    }

    createActionWithCoordinate(type, x, y) {
        const newAction = {
            id: `action-${Date.now()}`,
            type,
            x,
            y,
            ...(type === 'long-press' && { duration: 1000 }),
        };

        this.actions.push(newAction);
        this.selectedActionId = newAction.id;

        // renderActionSequence will automatically update marker for selected action
        this.renderActionSequence();

        // Log the action creation
        const actionName = type === 'click' ? '클릭' : '롱프레스';
        this.addLog('success', `${actionName} 액션 추가: (${x}, ${y})`);
    }

    createDragAction(startX, startY, endX, endY) {
        const newAction = {
            id: `action-${Date.now()}`,
            type: 'drag',
            x: startX,
            y: startY,
            endX: endX,
            endY: endY
        };

        this.actions.push(newAction);
        this.selectedActionId = newAction.id;

        // renderActionSequence will automatically update marker for selected action
        this.renderActionSequence();

        // Log the action creation
        this.addLog('success', `드래그 액션 추가: (${startX}, ${startY}) → (${endX}, ${endY})`);
    }

    updatePickingTooltipMessage() {
        const tooltip = document.getElementById('coordinate-picking-tooltip');
        if (tooltip) {
            tooltip.innerHTML = `
                <div class="coordinate-tooltip">
                    <p>두번째 지점을 선택하세요</p>
                    <p class="coordinate-tooltip-hint">ESC 키로 취소</p>
                </div>
            `;
        }
    }

    showDragStartMarker(x, y) {
        const screenPreview = document.getElementById('screen-preview-canvas');
        const img = document.getElementById('screen-stream-image');
        if (!screenPreview || !img) return;

        // Clear any existing markers
        const existingMarkers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
        existingMarkers.forEach(m => m.remove());

        // Calculate position in pixels relative to container
        const containerRect = screenPreview.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();

        const imgX = (x / this.screenWidth) * imgRect.width;
        const imgY = (y / this.screenHeight) * imgRect.height;
        const markerX = (imgRect.left - containerRect.left) + imgX;
        const markerY = (imgRect.top - containerRect.top) + imgY;

        // Create start point marker
        const marker = document.createElement('div');
        marker.className = 'action-marker';
        marker.style.left = `${markerX}px`;
        marker.style.top = `${markerY}px`;
        marker.innerHTML = '<div class="action-marker-pulse"></div>';
        screenPreview.appendChild(marker);
    }

    clearScreenMarkers() {
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (screenPreview) {
            const markers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
            markers.forEach(m => m.remove());
        }
    }

    // Log management methods
    addLog(level, message) {
        const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        const logEntry = {
            timestamp,
            level,
            message
        };

        this.logs.push(logEntry);

        // Keep only last 100 logs
        if (this.logs.length > 100) {
            this.logs.shift();
        }

        this.renderLogs();
    }

    clearLogs() {
        this.logs = [];
        this.renderLogs();
        this.addLog('info', '로그가 초기화되었습니다');
    }

    restoreDeviceCards() {
        // Remove all animation classes to restore original state
        const methodsContainer = document.querySelector('.device-connection-methods');
        const allCards = document.querySelectorAll('.device-method-card');

        if (methodsContainer) {
            methodsContainer.classList.remove('adb-active', 'isap-active');
        }

        allCards.forEach(card => {
            card.classList.remove('collapsed', 'expanded');
        });

        // Remove device lists and iSAP forms from both cards
        const deviceLists = document.querySelectorAll('.device-list');
        deviceLists.forEach(list => list.remove());

        const isapForms = document.querySelectorAll('.isap-connection-form');
        isapForms.forEach(form => form.remove());

        // Reset ADB button
        const adbButton = document.getElementById('btn-connect-adb');
        if (adbButton) {
            adbButton.classList.remove('loading');
            adbButton.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                ADB 연결
            `;
        }

        // Reset iSAP button
        const isapButton = document.getElementById('btn-connect-isap');
        if (isapButton) {
            isapButton.classList.remove('loading');
            isapButton.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                iSAP 연결
            `;
        }

        // Reset device connection state
        this.isDeviceConnected = false;
        this.deviceType = null;
        this.deviceName = null;
        this.adbDevices = null;

        this.addLog('warning', '장치 연결이 취소되었습니다');
    }

    async connectDevice(type) {
        const buttonId = type === 'adb' ? 'btn-connect-adb' : 'btn-connect-isap';
        const button = document.getElementById(buttonId);
        const card = button?.closest('.device-method-card');

        if (!button || !card) return;

        // Add card animation classes
        const methodsContainer = card.closest('.device-connection-methods');
        const oppositeCard = type === 'adb'
            ? document.getElementById('btn-connect-isap')?.closest('.device-method-card')
            : document.getElementById('btn-connect-adb')?.closest('.device-method-card');

        if (methodsContainer && oppositeCard) {
            // Add active class to container
            methodsContainer.classList.remove('adb-active', 'isap-active');
            methodsContainer.classList.add(type === 'adb' ? 'adb-active' : 'isap-active');

            // Collapse opposite card and expand current card
            oppositeCard.classList.add('collapsed');
            card.classList.add('expanded');
        }

        if (type === 'adb') {
            // Show loading state for ADB
            button.classList.add('loading');
            button.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                연결 중...
            `;

            this.addLog('info', 'ADB 장치를 검색 중...');
        }

        if (type === 'adb') {
            try {
                // Call real ADB devices API
                const result = await window.api.device.list();

                if (result.success && result.devices.length > 0) {
                    // Extract device names with serial numbers
                    const deviceNames = result.devices.map(d => {
                        // Show "Model (Serial)" or just serial if model is unknown
                        if (d.model && d.model !== 'Unknown') {
                            return `${d.model} (${d.id})`;
                        } else {
                            return d.id;
                        }
                    });

                    // Store full device info for later use
                    this.adbDevices = result.devices;

                    // Show device list in card
                    this.showDeviceList(card, deviceNames, type);

                    this.addLog('success', `${result.devices.length}개의 장치를 찾았습니다`);
                } else {
                    this.addLog('warning', 'ADB 장치를 찾을 수 없습니다');

                    // Reset button
                    button.classList.remove('loading');
                    button.innerHTML = `
                        <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        ADB 연결
                    `;
                }
            } catch (error) {
                this.addLog('error', `ADB 연결 실패: ${error.message}`);

                // Reset button
                button.classList.remove('loading');
                button.innerHTML = `
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    ADB 연결
                `;
            }
        } else {
            // iSAP - show SSH connection form
            button.classList.remove('loading');
            this.showISAPConnectionForm(card);
            this.addLog('info', 'iSAP 연결 정보를 입력하세요');
        }
    }

    showDeviceList(card, devices, type) {
        // Find or create device list container
        let deviceList = card.querySelector('.device-list');
        if (!deviceList) {
            deviceList = document.createElement('div');
            deviceList.className = 'device-list';
            card.appendChild(deviceList);
        }

        // Clear existing list
        deviceList.innerHTML = '';

        // Add devices with staggered animation
        devices.forEach((deviceName, index) => {
            const deviceItem = document.createElement('div');
            deviceItem.className = 'device-item';
            deviceItem.style.animationDelay = `${index * 0.1}s`;
            deviceItem.innerHTML = `
                <span class="device-item-name">${deviceName}</span>
                <span class="device-item-status">연결 가능</span>
            `;

            deviceItem.addEventListener('click', () => {
                this.selectDevice(deviceName, type);
            });

            deviceList.appendChild(deviceItem);
        });
    }

    showISAPConnectionForm(card) {
        // Find or create connection form container
        let formContainer = card.querySelector('.isap-connection-form');
        if (!formContainer) {
            formContainer = document.createElement('div');
            formContainer.className = 'isap-connection-form';
            card.appendChild(formContainer);
        }

        formContainer.innerHTML = `
            <div class="ssh-form">
                <div class="form-group">
                    <label class="form-label">호스트 IP</label>
                    <input type="text" id="isap-host" class="form-input" placeholder="10.0.3.0" value="10.0.3.0">
                </div>
                <div class="form-group">
                    <label class="form-label">포트</label>
                    <input type="number" id="isap-port" class="form-input" placeholder="20000" value="20000">
                </div>
                <div class="form-group">
                    <label class="form-label">사용자명</label>
                    <input type="text" id="isap-username" class="form-input" placeholder="root" value="root">
                </div>
                <div class="form-group">
                    <label class="form-label">패스워드</label>
                    <input type="password" id="isap-password" class="form-input" placeholder="패스워드 입력" value="">
                </div>

                <div class="form-divider"></div>

                <div class="form-group">
                    <label class="form-checkbox">
                        <input type="checkbox" id="isap-proxy-enabled">
                        <span>Proxy Jump 사용</span>
                    </label>
                </div>

                <div id="isap-proxy-fields" class="proxy-fields hidden">
                    <div class="form-group">
                        <label class="form-label">Proxy 호스트</label>
                        <input type="text" id="isap-proxy-host" class="form-input" placeholder="raspberry.local">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Proxy 포트</label>
                        <input type="number" id="isap-proxy-port" class="form-input" placeholder="22" value="22">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Proxy 사용자명</label>
                        <input type="text" id="isap-proxy-username" class="form-input" placeholder="pi" value="pi">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Proxy 패스워드</label>
                        <input type="password" id="isap-proxy-password" class="form-input" placeholder="패스워드 입력" value="">
                    </div>
                </div>

                <button class="btn-primary w-full mt-4" id="isap-connect-btn">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    연결
                </button>
            </div>
        `;

        // Toggle proxy fields
        const proxyCheckbox = formContainer.querySelector('#isap-proxy-enabled');
        const proxyFields = formContainer.querySelector('#isap-proxy-fields');

        proxyCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                proxyFields.classList.remove('hidden');
            } else {
                proxyFields.classList.add('hidden');
            }
        });

        // Connect button handler
        const connectBtn = formContainer.querySelector('#isap-connect-btn');
        connectBtn.addEventListener('click', () => this.connectISAP());
    }

    async connectISAP() {
        const host = document.getElementById('isap-host').value.trim();
        const port = document.getElementById('isap-port').value;
        const username = document.getElementById('isap-username').value.trim();
        const password = document.getElementById('isap-password').value;
        const proxyEnabled = document.getElementById('isap-proxy-enabled').checked;

        if (!host) {
            this.addLog('error', '호스트 IP를 입력하세요');
            return;
        }

        if (!password) {
            this.addLog('error', '패스워드를 입력하세요');
            return;
        }

        const connectionInfo = {
            host,
            port: parseInt(port) || 20000,
            username: username || 'root',
            password,
        };

        if (proxyEnabled) {
            const proxyHost = document.getElementById('isap-proxy-host').value.trim();
            const proxyPort = document.getElementById('isap-proxy-port').value;
            const proxyUsername = document.getElementById('isap-proxy-username').value.trim();
            const proxyPassword = document.getElementById('isap-proxy-password').value;

            if (!proxyHost) {
                this.addLog('error', 'Proxy 호스트를 입력하세요');
                return;
            }

            if (!proxyPassword) {
                this.addLog('error', 'Proxy 패스워드를 입력하세요');
                return;
            }

            connectionInfo.proxy = {
                host: proxyHost,
                port: parseInt(proxyPort) || 22,
                username: proxyUsername || 'pi',
                password: proxyPassword,
            };
        }

        this.addLog('info', `iSAP 장치에 연결 중... ${username}@${host}:${port}`);
        if (proxyEnabled) {
            this.addLog('info', `Proxy Jump: ${connectionInfo.proxy.username}@${connectionInfo.proxy.host}:${connectionInfo.proxy.port}`);
        }

        // TODO: Implement actual iSAP connection via backend
        // For now, just simulate connection
        await new Promise(resolve => setTimeout(resolve, 1500));

        this.isDeviceConnected = true;
        this.deviceType = 'isap';
        this.deviceName = `${username}@${host}`;
        this.fps = 30;

        this.renderScreenPreview();
        this.renderDeviceStatus();
        this.addLog('success', `iSAP 장치에 연결되었습니다`);
    }

    async selectDevice(deviceName, type) {
        this.deviceType = type;
        this.deviceName = deviceName;

        if (type === 'adb' && this.adbDevices) {
            try {
                // Extract serial number from "Model (Serial)" format
                const serialMatch = deviceName.match(/\(([^)]+)\)$/);
                const serial = serialMatch ? serialMatch[1] : deviceName;

                // Find the device by serial
                const device = this.adbDevices.find(d => d.id === serial);

                if (device) {
                    this.addLog('info', `${deviceName} 장치에 연결 중...`);

                    // Select device via API
                    const result = await window.api.device.select(device.id);

                    if (result) {
                        this.isDeviceConnected = true;
                        this.fps = 30;

                        // Store device screen resolution
                        // Result format: {success: true, info: {...}}
                        const deviceInfo = result.info || result;

                        if (deviceInfo.screen) {
                            this.screenWidth = deviceInfo.screen.width;
                            this.screenHeight = deviceInfo.screen.height;
                        }

                        // Hide device connection UI and show screen preview
                        const deviceConnectionUI = document.getElementById('device-connection-ui');
                        if (deviceConnectionUI) {
                            deviceConnectionUI.style.display = 'none';
                        }

                        // Render screen preview
                        this.renderScreenPreview();

                        // Render device status in header
                        this.renderDeviceStatus();

                        this.addLog('success', `${deviceName} 장치가 연결되었습니다`);

                        // Start screen stream
                        this.startScreenStream();
                    } else {
                        this.addLog('error', `장치 연결 실패: ${result.error || 'Unknown error'}`);
                    }
                }
            } catch (error) {
                this.addLog('error', `장치 선택 실패: ${error.message}`);
            }
        } else {
            // iSAP - keep original behavior for now
            this.isDeviceConnected = true;
            this.fps = 30;

            // Hide device connection UI and show screen preview
            const deviceConnectionUI = document.getElementById('device-connection-ui');
            if (deviceConnectionUI) {
                deviceConnectionUI.style.display = 'none';
            }

            // Render screen preview
            this.renderScreenPreview();

            // Render device status in header
            this.renderDeviceStatus();

            this.addLog('success', `${deviceName} 장치가 연결되었습니다`);
        }
    }

    async startScreenStream() {
        try {
            this.addLog('info', '화면 스트리밍을 시작합니다...');

            // Start stream with 30 FPS
            const result = await window.api.screen.startStream({ maxFps: 30 });

            if (result) {
                this.addLog('success', '화면 스트리밍이 시작되었습니다');

                // Listen for stream data
                window.api.screen.onStreamData((data) => {
                    const img = document.getElementById('screen-stream-image');
                    if (img && data.dataUrl) {
                        img.src = data.dataUrl;
                    }
                });
            }
        } catch (error) {
            this.addLog('error', `화면 스트리밍 실패: ${error.message}`);
        }
    }

    renderDeviceStatus() {
        const container = document.getElementById('device-status');
        if (!container) return;

        if (!this.isDeviceConnected) {
            container.innerHTML = `
                <div class="device-status-indicator">
                    <div class="status-light disconnected"></div>
                    <span class="device-status-value">장치 없음</span>
                </div>
                <div class="device-status-divider"></div>
                <div class="device-status-indicator">
                    <span class="device-status-label">FPS</span>
                    <span class="device-status-value">-</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="device-status-indicator">
                <div class="status-light connected"></div>
                <span class="device-status-value">${this.deviceName}</span>
            </div>
            <div class="device-status-divider"></div>
            <div class="device-status-indicator">
                <span class="device-status-label">FPS</span>
                <span class="device-status-value">${this.fps}</span>
            </div>
        `;
    }

    renderLogs() {
        const container = document.getElementById('log-output-content');
        if (!container) return;

        if (this.logs.length === 0) {
            container.innerHTML = `
                <div class="log-entry">
                    <span class="log-timestamp">00:00:00</span>
                    <span class="log-level log-level-info">[INFO]</span>
                    <span class="log-message">로그가 없습니다</span>
                </div>
            `;
            return;
        }

        const logsHtml = this.logs.map(log => {
            const levelClass = `log-level-${log.level}`;
            const levelText = {
                'info': '[INFO]',
                'success': '[SUCCESS]',
                'warning': '[WARNING]',
                'error': '[ERROR]'
            }[log.level] || '[INFO]';

            return `
                <div class="log-entry">
                    <span class="log-timestamp">${log.timestamp}</span>
                    <span class="log-level ${levelClass}">${levelText}</span>
                    <span class="log-message">${log.message}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = logsHtml;

        // Auto scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    clearLogs() {
        this.logs = [];
        this.renderLogs();
        this.addLog('info', '로그가 초기화되었습니다');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.macroApp = new MacroBuilderApp();
});
