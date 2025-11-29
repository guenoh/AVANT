/**
 * CoordinatePickerUI - Handles coordinate picking mode and region selection
 * ES6 Module version
 */

export class CoordinatePickerUI {
    constructor(app) {
        this.app = app;

        // Picking state
        this.isPickingCoordinate = false;
        this.pendingActionType = null;
        this.dragStartPoint = null;

        // Region selection state
        this.isSelectingRegion = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        // Callback for when picking is complete
        this.onCoordinatePicked = null;
        this.onRegionSelected = null;
    }

    // ==================== Coordinate Picking ====================

    /**
     * Start coordinate picking mode
     */
    startPicking(actionType, callback) {
        this.isPickingCoordinate = true;
        this.pendingActionType = actionType;
        this.onCoordinatePicked = callback;
        this.dragStartPoint = null;

        // Update cursor
        const screenPreview = document.getElementById('screen-preview');
        if (screenPreview) {
            screenPreview.style.cursor = 'crosshair';
        }

        // Show picking indicator
        this.showPickingIndicator(actionType);

        this.app.logger.info(`Coordinate picking started for: ${actionType}`);
    }

    /**
     * Cancel coordinate picking mode
     */
    cancelPicking() {
        this.isPickingCoordinate = false;
        this.pendingActionType = null;
        this.onCoordinatePicked = null;
        this.dragStartPoint = null;

        // Reset cursor
        const screenPreview = document.getElementById('screen-preview');
        if (screenPreview) {
            screenPreview.style.cursor = '';
        }

        // Hide picking indicator
        this.hidePickingIndicator();

        this.app.logger.info('Coordinate picking cancelled');
    }

    /**
     * Handle click during picking mode
     */
    handlePickClick(deviceCoords) {
        if (!this.isPickingCoordinate) return;

        const actionType = this.pendingActionType;

        // Handle drag action (needs two points)
        if (actionType === 'drag') {
            if (!this.dragStartPoint) {
                // First click - store start point
                this.dragStartPoint = { x: deviceCoords.x, y: deviceCoords.y };
                this.updatePickingIndicator('Click end point');
                this.app.logger.info(`Drag start: (${deviceCoords.x}, ${deviceCoords.y})`);
                return;
            } else {
                // Second click - complete drag
                const startPoint = this.dragStartPoint;
                const endPoint = { x: deviceCoords.x, y: deviceCoords.y };

                this.completePicking({
                    startX: startPoint.x,
                    startY: startPoint.y,
                    endX: endPoint.x,
                    endY: endPoint.y
                });
                return;
            }
        }

        // Single point actions (click, long-press, etc.)
        this.completePicking({
            x: deviceCoords.x,
            y: deviceCoords.y
        });
    }

    /**
     * Complete picking and create action
     */
    completePicking(coords) {
        const actionType = this.pendingActionType;
        const callback = this.onCoordinatePicked;

        // Reset state
        this.isPickingCoordinate = false;
        this.pendingActionType = null;
        this.dragStartPoint = null;
        this.onCoordinatePicked = null;

        // Reset cursor
        const screenPreview = document.getElementById('screen-preview');
        if (screenPreview) {
            screenPreview.style.cursor = '';
        }

        // Hide indicator
        this.hidePickingIndicator();

        // Call callback or create action
        if (callback) {
            callback(coords, actionType);
        } else {
            this.createActionFromCoords(coords, actionType);
        }

        this.app.logger.success(`Coordinates picked for ${actionType}`);
    }

    /**
     * Create action from picked coordinates
     */
    createActionFromCoords(coords, actionType) {
        const action = {
            id: `action-${Date.now()}`,
            type: actionType
        };

        if (actionType === 'drag') {
            action.startX = coords.startX;
            action.startY = coords.startY;
            action.endX = coords.endX;
            action.endY = coords.endY;
            action.duration = 300;
        } else {
            action.x = coords.x;
            action.y = coords.y;

            if (actionType === 'long-press') {
                action.duration = 1000;
            }
        }

        this.app.actions.push(action);
        this.app.renderActionSequence();
        this.app.saveToLocalStorage();
        this.app.markAsUnsaved();
    }

    // ==================== Region Selection ====================

    /**
     * Start region selection mode
     */
    startRegionSelection(callback) {
        this.isSelectingRegion = true;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.onRegionSelected = callback;

        // Update cursor
        const screenPreview = document.getElementById('screen-preview');
        if (screenPreview) {
            screenPreview.style.cursor = 'crosshair';
        }

        this.app.logger.info('Region selection started');
    }

    /**
     * Cancel region selection
     */
    cancelRegionSelection() {
        this.isSelectingRegion = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.onRegionSelected = null;

        // Reset cursor
        const screenPreview = document.getElementById('screen-preview');
        if (screenPreview) {
            screenPreview.style.cursor = '';
        }

        // Clear selection overlay
        this.clearSelectionOverlay();

        this.app.logger.info('Region selection cancelled');
    }

    /**
     * Handle mouse down for region selection
     */
    handleMouseDown(deviceCoords, isImageMatch = false) {
        if (!isImageMatch) return;

        this.isSelectingRegion = true;
        this.selectionStart = { x: deviceCoords.x, y: deviceCoords.y };
        this.selectionEnd = null;
    }

    /**
     * Handle mouse move for region selection
     */
    handleMouseMove(deviceCoords) {
        if (!this.isSelectingRegion || !this.selectionStart) return;

        this.selectionEnd = { x: deviceCoords.x, y: deviceCoords.y };
        this.renderSelectionOverlay();
    }

    /**
     * Handle mouse up for region selection
     */
    handleMouseUp(deviceCoords) {
        if (!this.isSelectingRegion || !this.selectionStart) return;

        this.selectionEnd = { x: deviceCoords.x, y: deviceCoords.y };

        // Calculate region
        const region = {
            x: Math.min(this.selectionStart.x, this.selectionEnd.x),
            y: Math.min(this.selectionStart.y, this.selectionEnd.y),
            width: Math.abs(this.selectionEnd.x - this.selectionStart.x),
            height: Math.abs(this.selectionEnd.y - this.selectionStart.y)
        };

        // Validate minimum size
        if (region.width >= 10 && region.height >= 10) {
            this.completeRegionSelection(region);
        } else {
            this.app.logger.warn('Region too small (min 10x10)');
        }

        // Clear selection state
        this.isSelectingRegion = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.clearSelectionOverlay();
    }

    /**
     * Complete region selection
     */
    completeRegionSelection(region) {
        const callback = this.onRegionSelected;

        // Reset state
        this.isSelectingRegion = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.onRegionSelected = null;

        // Reset cursor
        const screenPreview = document.getElementById('screen-preview');
        if (screenPreview) {
            screenPreview.style.cursor = '';
        }

        if (callback) {
            callback(region);
        }

        this.app.logger.success(`Region selected: ${region.width}x${region.height} at (${region.x}, ${region.y})`);
    }

    // ==================== UI Helpers ====================

    /**
     * Show picking indicator
     */
    showPickingIndicator(actionType) {
        let existingIndicator = document.getElementById('picking-indicator');
        if (!existingIndicator) {
            existingIndicator = document.createElement('div');
            existingIndicator.id = 'picking-indicator';
            existingIndicator.style.cssText = `
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(37, 99, 235, 0.95);
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            document.body.appendChild(existingIndicator);
        }

        let message = 'Click to pick coordinates';
        if (actionType === 'drag') {
            message = 'Click start point';
        } else if (actionType === 'click') {
            message = 'Click to set tap position';
        } else if (actionType === 'long-press') {
            message = 'Click to set long-press position';
        }

        existingIndicator.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z"/>
                <circle cx="8" cy="8" r="3"/>
            </svg>
            ${message}
            <span style="opacity: 0.7; margin-left: 8px;">(ESC to cancel)</span>
        `;
        existingIndicator.style.display = 'flex';
    }

    /**
     * Update picking indicator message
     */
    updatePickingIndicator(message) {
        const indicator = document.getElementById('picking-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z"/>
                    <circle cx="8" cy="8" r="3"/>
                </svg>
                ${message}
                <span style="opacity: 0.7; margin-left: 8px;">(ESC to cancel)</span>
            `;
        }
    }

    /**
     * Hide picking indicator
     */
    hidePickingIndicator() {
        const indicator = document.getElementById('picking-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Render selection overlay during region selection
     */
    renderSelectionOverlay() {
        if (!this.selectionStart || !this.selectionEnd) return;

        const screenPreview = document.getElementById('screen-preview');
        const img = screenPreview?.querySelector('img');
        if (!img) return;

        // Get or create overlay
        let overlay = document.getElementById('selection-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'selection-overlay';
            overlay.style.cssText = `
                position: absolute;
                pointer-events: none;
                border: 2px dashed #3b82f6;
                background: rgba(59, 130, 246, 0.1);
                z-index: 100;
            `;
            screenPreview.appendChild(overlay);
        }

        // Calculate display coordinates
        const imgRect = img.getBoundingClientRect();
        const containerRect = screenPreview.getBoundingClientRect();
        const coordinateService = this.app.controller.getService('coordinateService');

        const startDisplay = coordinateService.deviceToDisplay(
            this.selectionStart.x,
            this.selectionStart.y,
            imgRect
        );
        const endDisplay = coordinateService.deviceToDisplay(
            this.selectionEnd.x,
            this.selectionEnd.y,
            imgRect
        );

        const left = Math.min(startDisplay.x, endDisplay.x) + (imgRect.left - containerRect.left);
        const top = Math.min(startDisplay.y, endDisplay.y) + (imgRect.top - containerRect.top);
        const width = Math.abs(endDisplay.x - startDisplay.x);
        const height = Math.abs(endDisplay.y - startDisplay.y);

        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        overlay.style.display = 'block';
    }

    /**
     * Clear selection overlay
     */
    clearSelectionOverlay() {
        const overlay = document.getElementById('selection-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // ==================== State Queries ====================

    /**
     * Check if in picking mode
     */
    isPicking() {
        return this.isPickingCoordinate;
    }

    /**
     * Check if selecting region
     */
    isSelecting() {
        return this.isSelectingRegion;
    }

    /**
     * Get pending action type
     */
    getPendingActionType() {
        return this.pendingActionType;
    }
}

export default CoordinatePickerUI;
