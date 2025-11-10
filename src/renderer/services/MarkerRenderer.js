/**
 * MarkerRenderer
 * Handles visual marker rendering on screen canvas
 */

class MarkerRenderer {
    constructor(canvas, coordinateService) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.coordinateService = coordinateService;

        this.markers = [];
        this.dragLine = null;
        this.region = null;
    }

    /**
     * Clear all markers and overlays
     */
    clear() {
        this.markers = [];
        this.dragLine = null;
        this.region = null;
        this._render();
    }

    /**
     * Add a coordinate marker
     */
    addMarker(coords, options = {}) {
        const marker = {
            id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            coords,
            type: options.type || 'point',
            color: options.color || '#2563eb',
            label: options.label || '',
            timestamp: Date.now()
        };

        this.markers.push(marker);
        this._render();

        return marker.id;
    }

    /**
     * Remove marker by ID
     */
    removeMarker(markerId) {
        this.markers = this.markers.filter(m => m.id !== markerId);
        this._render();
    }

    /**
     * Update marker position
     */
    updateMarker(markerId, coords) {
        const marker = this.markers.find(m => m.id === markerId);
        if (marker) {
            marker.coords = coords;
            this._render();
        }
    }

    /**
     * Set drag line (for drag action visualization)
     */
    setDragLine(startCoords, endCoords, options = {}) {
        this.dragLine = {
            start: startCoords,
            end: endCoords,
            color: options.color || '#2563eb',
            lineWidth: options.lineWidth || 2
        };
        this._render();
    }

    /**
     * Clear drag line
     */
    clearDragLine() {
        this.dragLine = null;
        this._render();
    }

    /**
     * Set region overlay (for image matching region)
     */
    setRegion(region, options = {}) {
        this.region = {
            ...region,
            color: options.color || '#2563eb',
            fillOpacity: options.fillOpacity || 0.1,
            strokeWidth: options.strokeWidth || 2,
            label: options.label || ''
        };
        this._render();
    }

    /**
     * Clear region overlay
     */
    clearRegion() {
        this.region = null;
        this._render();
    }

    /**
     * Draw action preview on canvas
     */
    drawActionPreview(action, imgElement) {
        if (!imgElement) return;

        switch (action.type) {
            case 'click':
            case 'long-press':
                this._drawClickPreview(action, imgElement);
                break;

            case 'drag':
                this._drawDragPreview(action, imgElement);
                break;

            case 'image-match':
                this._drawImageMatchPreview(action, imgElement);
                break;
        }
    }

    /**
     * Draw click preview
     */
    _drawClickPreview(action, imgElement) {
        const displayCoords = this.coordinateService.deviceToDisplay(
            { x: action.x, y: action.y },
            imgElement
        );

        this.addMarker(displayCoords, {
            type: 'click',
            color: action.type === 'long-press' ? '#ca8a04' : '#2563eb',
            label: action.type === 'long-press' ? 'Long Press' : 'Click'
        });
    }

    /**
     * Draw drag preview
     */
    _drawDragPreview(action, imgElement) {
        const startDisplay = this.coordinateService.deviceToDisplay(
            { x: action.x, y: action.y },
            imgElement
        );

        const endDisplay = this.coordinateService.deviceToDisplay(
            { x: action.endX, y: action.endY },
            imgElement
        );

        this.addMarker(startDisplay, {
            type: 'drag-start',
            color: '#2563eb',
            label: 'Start'
        });

        this.addMarker(endDisplay, {
            type: 'drag-end',
            color: '#16a34a',
            label: 'End'
        });

        this.setDragLine(startDisplay, endDisplay, {
            color: '#2563eb'
        });
    }

    /**
     * Draw image match preview
     */
    _drawImageMatchPreview(action, imgElement) {
        if (action.region) {
            const displayRegion = this.coordinateService.regionDeviceToDisplay(
                action.region,
                imgElement
            );

            this.setRegion(displayRegion, {
                color: '#ca8a04',
                label: 'Search Region'
            });
        }

        // If match result is available, show match location
        if (action.matchResult && action.matchResult.found) {
            const matchDisplay = this.coordinateService.deviceToDisplay(
                action.matchResult.location,
                imgElement
            );

            this.addMarker(matchDisplay, {
                type: 'match',
                color: '#16a34a',
                label: `Match (${(action.matchResult.confidence * 100).toFixed(0)}%)`
            });
        }
    }

    /**
     * Render all markers and overlays
     */
    _render() {
        if (!this.canvas || !this.ctx) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw region overlay
        if (this.region) {
            this._drawRegion(this.region);
        }

        // Draw drag line
        if (this.dragLine) {
            this._drawDragLine(this.dragLine);
        }

        // Draw markers
        this.markers.forEach(marker => {
            this._drawMarker(marker);
        });
    }

    /**
     * Draw a single marker
     */
    _drawMarker(marker) {
        const { coords, type, color, label } = marker;

        this.ctx.save();

        // Draw marker circle
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.arc(coords.x, coords.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw inner dot
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(coords.x, coords.y, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw crosshair lines
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);

        this.ctx.beginPath();
        this.ctx.moveTo(coords.x - 15, coords.y);
        this.ctx.lineTo(coords.x + 15, coords.y);
        this.ctx.moveTo(coords.x, coords.y - 15);
        this.ctx.lineTo(coords.x, coords.y + 15);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Draw label if provided
        if (label) {
            this._drawLabel(coords.x, coords.y - 20, label, color);
        }

        // Draw type-specific decorations
        if (type === 'drag-start') {
            this._drawArrowhead(coords.x, coords.y, 'start');
        } else if (type === 'drag-end') {
            this._drawArrowhead(coords.x, coords.y, 'end');
        }

        this.ctx.restore();
    }

    /**
     * Draw drag line
     */
    _drawDragLine(dragLine) {
        const { start, end, color, lineWidth } = dragLine;

        this.ctx.save();

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.setLineDash([8, 4]);

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Draw arrowhead at end
        this._drawArrow(start.x, start.y, end.x, end.y, color);

        this.ctx.restore();
    }

    /**
     * Draw region overlay
     */
    _drawRegion(region) {
        const { x, y, width, height, color, fillOpacity, strokeWidth, label } = region;

        this.ctx.save();

        // Draw filled rectangle
        this.ctx.fillStyle = this._hexToRgba(color, fillOpacity);
        this.ctx.fillRect(x, y, width, height);

        // Draw border
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.setLineDash([8, 4]);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);

        // Draw corner handles
        this._drawCornerHandles(x, y, width, height, color);

        // Draw label
        if (label) {
            this._drawLabel(x + width / 2, y - 10, label, color);
        }

        // Draw dimensions
        this._drawDimensions(x, y, width, height, color);

        this.ctx.restore();
    }

    /**
     * Draw corner handles for region
     */
    _drawCornerHandles(x, y, width, height, color) {
        const handleSize = 8;
        const corners = [
            { x, y },
            { x: x + width, y },
            { x, y: y + height },
            { x: x + width, y: y + height }
        ];

        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;

        corners.forEach(corner => {
            this.ctx.fillRect(
                corner.x - handleSize / 2,
                corner.y - handleSize / 2,
                handleSize,
                handleSize
            );

            this.ctx.strokeRect(
                corner.x - handleSize / 2,
                corner.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });
    }

    /**
     * Draw dimension labels for region
     */
    _drawDimensions(x, y, width, height, color) {
        this.ctx.fillStyle = color;
        this.ctx.font = '12px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Width label
        this.ctx.fillText(`${Math.round(width)}px`, x + width / 2, y + height + 20);

        // Height label
        this.ctx.save();
        this.ctx.translate(x - 20, y + height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillText(`${Math.round(height)}px`, 0, 0);
        this.ctx.restore();
    }

    /**
     * Draw label with background
     */
    _drawLabel(x, y, text, color) {
        this.ctx.font = '12px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';

        const metrics = this.ctx.measureText(text);
        const padding = 4;

        // Draw background
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            x - metrics.width / 2 - padding,
            y - 16,
            metrics.width + padding * 2,
            16
        );

        // Draw text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(text, x, y - 4);
    }

    /**
     * Draw arrow from start to end
     */
    _drawArrow(x1, y1, x2, y2, color) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 12;

        this.ctx.save();
        this.ctx.translate(x2, y2);
        this.ctx.rotate(angle);

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-arrowSize, -arrowSize / 2);
        this.ctx.lineTo(-arrowSize, arrowSize / 2);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * Draw arrowhead decoration
     */
    _drawArrowhead(x, y, type) {
        const size = 6;

        this.ctx.save();

        if (type === 'start') {
            this.ctx.fillStyle = '#2563eb';
        } else {
            this.ctx.fillStyle = '#16a34a';
        }

        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x - size, y + size);
        this.ctx.lineTo(x + size, y + size);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * Convert hex color to rgba
     */
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Get marker at position
     */
    getMarkerAt(x, y, tolerance = 10) {
        return this.markers.find(marker => {
            const dx = marker.coords.x - x;
            const dy = marker.coords.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= tolerance;
        });
    }

    /**
     * Highlight marker
     */
    highlightMarker(markerId, duration = 1000) {
        const marker = this.markers.find(m => m.id === markerId);
        if (!marker) return;

        const originalColor = marker.color;
        marker.color = '#16a34a';
        this._render();

        setTimeout(() => {
            marker.color = originalColor;
            this._render();
        }, duration);
    }

    /**
     * Flash marker animation
     */
    flashMarker(markerId, times = 3) {
        const marker = this.markers.find(m => m.id === markerId);
        if (!marker) return;

        const originalColor = marker.color;
        let count = 0;

        const interval = setInterval(() => {
            marker.color = count % 2 === 0 ? '#16a34a' : originalColor;
            this._render();
            count++;

            if (count >= times * 2) {
                clearInterval(interval);
                marker.color = originalColor;
                this._render();
            }
        }, 300);
    }

    /**
     * Get all markers
     */
    getMarkers() {
        return [...this.markers];
    }

    /**
     * Update canvas size
     */
    updateCanvasSize(width, height) {
        if (this.canvas) {
            this.canvas.width = width;
            this.canvas.height = height;
            this._render();
        }
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkerRenderer;
}

if (typeof window !== 'undefined') {
    window.MarkerRenderer = MarkerRenderer;
}
