/**
 * ScreenInteractionHandler
 * Handles mouse and touch interactions on screen canvas
 */

class ScreenInteractionHandler {
    constructor(canvas, coordinateService, markerRenderer, eventBus) {
        this.canvas = canvas;
        this.coordinateService = coordinateService;
        this.markerRenderer = markerRenderer;
        this.eventBus = eventBus;

        this.mode = 'view'; // 'view', 'click', 'drag', 'region'
        this.isDrawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.imgElement = null;

        this._boundHandlers = {
            mouseDown: this._handleMouseDown.bind(this),
            mouseMove: this._handleMouseMove.bind(this),
            mouseUp: this._handleMouseUp.bind(this),
            mouseLeave: this._handleMouseLeave.bind(this),
            contextMenu: this._handleContextMenu.bind(this)
        };

        this._attachListeners();
    }

    /**
     * Set interaction mode
     */
    setMode(mode) {
        if (!['view', 'click', 'drag', 'region'].includes(mode)) {
            throw new Error(`Invalid interaction mode: ${mode}`);
        }

        this.mode = mode;
        this._updateCursor();

        this.eventBus.emit('interaction:mode-changed', { mode });
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Set image element for coordinate conversion
     */
    setImageElement(imgElement) {
        this.imgElement = imgElement;
    }

    /**
     * Enable interactions
     */
    enable() {
        this._attachListeners();
        this.eventBus.emit('interaction:enabled');
    }

    /**
     * Disable interactions
     */
    disable() {
        this._detachListeners();
        this.eventBus.emit('interaction:disabled');
    }

    /**
     * Reset interaction state
     */
    reset() {
        this.isDrawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.markerRenderer.clearDragLine();
        this.markerRenderer.clearRegion();
    }

    /**
     * Attach event listeners
     */
    _attachListeners() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousedown', this._boundHandlers.mouseDown);
        this.canvas.addEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.addEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.addEventListener('mouseleave', this._boundHandlers.mouseLeave);
        this.canvas.addEventListener('contextmenu', this._boundHandlers.contextMenu);
    }

    /**
     * Detach event listeners
     */
    _detachListeners() {
        if (!this.canvas) return;

        this.canvas.removeEventListener('mousedown', this._boundHandlers.mouseDown);
        this.canvas.removeEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.removeEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.removeEventListener('mouseleave', this._boundHandlers.mouseLeave);
        this.canvas.removeEventListener('contextmenu', this._boundHandlers.contextMenu);
    }

    /**
     * Handle mouse down event
     */
    _handleMouseDown(event) {
        if (this.mode === 'view') return;

        const rect = this.canvas.getBoundingClientRect();
        const displayPos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        // Check if click is within image bounds
        if (!this.coordinateService.isWithinImageBounds(displayPos, this.imgElement)) {
            return;
        }

        this.isDrawing = true;
        this.startPoint = displayPos;
        this.currentPoint = displayPos;

        this.eventBus.emit('interaction:start', {
            mode: this.mode,
            displayPos,
            devicePos: this.coordinateService.displayToDevice(displayPos, this.imgElement)
        });

        // Handle click mode immediately
        if (this.mode === 'click') {
            this._handleClick(displayPos);
        }
    }

    /**
     * Handle mouse move event
     */
    _handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const displayPos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        // Update cursor position indicator
        this._updateCursorPosition(displayPos);

        if (!this.isDrawing) return;

        this.currentPoint = displayPos;

        // Handle drag mode
        if (this.mode === 'drag') {
            this.markerRenderer.setDragLine(this.startPoint, this.currentPoint);
        }

        // Handle region mode
        if (this.mode === 'region') {
            const region = this.coordinateService.calculateRegion(
                this.startPoint,
                this.currentPoint
            );
            this.markerRenderer.setRegion(region);
        }

        this.eventBus.emit('interaction:move', {
            mode: this.mode,
            displayPos,
            devicePos: this.coordinateService.displayToDevice(displayPos, this.imgElement)
        });
    }

    /**
     * Handle mouse up event
     */
    _handleMouseUp(event) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const displayPos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        this.currentPoint = displayPos;

        // Handle drag mode
        if (this.mode === 'drag') {
            this._handleDrag(this.startPoint, this.currentPoint);
        }

        // Handle region mode
        if (this.mode === 'region') {
            this._handleRegion(this.startPoint, this.currentPoint);
        }

        this.isDrawing = false;
        this.startPoint = null;
        this.currentPoint = null;

        this.eventBus.emit('interaction:end', {
            mode: this.mode,
            displayPos,
            devicePos: this.coordinateService.displayToDevice(displayPos, this.imgElement)
        });
    }

    /**
     * Handle mouse leave event
     */
    _handleMouseLeave(event) {
        if (this.isDrawing) {
            this._handleMouseUp(event);
        }

        this.eventBus.emit('interaction:leave');
    }

    /**
     * Handle context menu event
     */
    _handleContextMenu(event) {
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const displayPos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        this.eventBus.emit('interaction:context-menu', {
            displayPos,
            devicePos: this.coordinateService.displayToDevice(displayPos, this.imgElement),
            clientX: event.clientX,
            clientY: event.clientY
        });
    }

    /**
     * Handle click interaction
     */
    _handleClick(displayPos) {
        const devicePos = this.coordinateService.displayToDevice(displayPos, this.imgElement);

        if (!devicePos) {
            this.eventBus.emit('interaction:error', {
                message: 'Click position outside device bounds'
            });
            return;
        }

        // Add visual marker
        this.markerRenderer.addMarker(displayPos, {
            type: 'click',
            color: '#2563eb',
            label: 'Click'
        });

        this.eventBus.emit('interaction:click', {
            displayPos,
            devicePos
        });

        // Auto-clear marker after delay
        setTimeout(() => {
            this.markerRenderer.clear();
        }, 1500);
    }

    /**
     * Handle drag interaction
     */
    _handleDrag(startDisplay, endDisplay) {
        const startDevice = this.coordinateService.displayToDevice(startDisplay, this.imgElement);
        const endDevice = this.coordinateService.displayToDevice(endDisplay, this.imgElement);

        if (!startDevice || !endDevice) {
            this.eventBus.emit('interaction:error', {
                message: 'Drag position outside device bounds'
            });
            return;
        }

        // Calculate drag distance
        const distance = Math.sqrt(
            Math.pow(endDevice.x - startDevice.x, 2) +
            Math.pow(endDevice.y - startDevice.y, 2)
        );

        // Ignore if drag is too short
        if (distance < 10) {
            this.markerRenderer.clearDragLine();
            return;
        }

        this.eventBus.emit('interaction:drag', {
            startDisplay,
            endDisplay,
            startDevice,
            endDevice,
            distance
        });

        // Auto-clear drag line after delay
        setTimeout(() => {
            this.markerRenderer.clearDragLine();
        }, 1500);
    }

    /**
     * Handle region selection
     */
    _handleRegion(startDisplay, endDisplay) {
        const region = this.coordinateService.calculateRegion(startDisplay, endDisplay);

        // Ignore if region is too small
        if (region.width < 10 || region.height < 10) {
            this.markerRenderer.clearRegion();
            return;
        }

        const deviceRegion = this.coordinateService.regionDisplayToDevice(
            region,
            this.imgElement
        );

        if (!deviceRegion) {
            this.eventBus.emit('interaction:error', {
                message: 'Region outside device bounds'
            });
            return;
        }

        this.eventBus.emit('interaction:region', {
            displayRegion: region,
            deviceRegion
        });

        // Keep region visible for user confirmation
    }

    /**
     * Update cursor based on mode
     */
    _updateCursor() {
        if (!this.canvas) return;

        const cursors = {
            view: 'default',
            click: 'crosshair',
            drag: 'move',
            region: 'crosshair'
        };

        this.canvas.style.cursor = cursors[this.mode] || 'default';
    }

    /**
     * Update cursor position indicator
     */
    _updateCursorPosition(displayPos) {
        if (!this.coordinateService.isWithinImageBounds(displayPos, this.imgElement)) {
            this.eventBus.emit('interaction:cursor-position', null);
            return;
        }

        const devicePos = this.coordinateService.displayToDevice(displayPos, this.imgElement);

        this.eventBus.emit('interaction:cursor-position', {
            displayPos,
            devicePos
        });
    }

    /**
     * Simulate click at device coordinates
     */
    simulateClick(devicePos) {
        const displayPos = this.coordinateService.deviceToDisplay(devicePos, this.imgElement);

        this.markerRenderer.addMarker(displayPos, {
            type: 'click',
            color: '#16a34a',
            label: 'Simulated'
        });

        this.markerRenderer.flashMarker(
            this.markerRenderer.markers[this.markerRenderer.markers.length - 1].id
        );

        setTimeout(() => {
            this.markerRenderer.clear();
        }, 2000);
    }

    /**
     * Simulate drag at device coordinates
     */
    simulateDrag(startDevice, endDevice) {
        const startDisplay = this.coordinateService.deviceToDisplay(startDevice, this.imgElement);
        const endDisplay = this.coordinateService.deviceToDisplay(endDevice, this.imgElement);

        this.markerRenderer.setDragLine(startDisplay, endDisplay, {
            color: '#16a34a'
        });

        setTimeout(() => {
            this.markerRenderer.clearDragLine();
        }, 2000);
    }

    /**
     * Get interaction state
     */
    getState() {
        return {
            mode: this.mode,
            isDrawing: this.isDrawing,
            startPoint: this.startPoint,
            currentPoint: this.currentPoint
        };
    }

    /**
     * Cleanup
     */
    cleanup() {
        this._detachListeners();
        this.reset();
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenInteractionHandler;
}

if (typeof window !== 'undefined') {
    window.ScreenInteractionHandler = ScreenInteractionHandler;
}
