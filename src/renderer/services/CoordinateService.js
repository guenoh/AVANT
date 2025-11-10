/**
 * CoordinateService
 * Handles coordinate transformations between display and device space
 */

class CoordinateService {
    constructor(coordinateSystem) {
        this.system = coordinateSystem;
    }

    /**
     * Update coordinate system with device dimensions
     */
    updateSystem(deviceWidth, deviceHeight, displayWidth, displayHeight) {
        this.system.updateDevice(deviceWidth, deviceHeight);
        this.system.updateDisplay(displayWidth, displayHeight);
    }

    /**
     * Convert mouse event to device coordinates
     */
    eventToDevice(event, imgElement) {
        const imgRect = imgElement.getBoundingClientRect();
        const clickPos = {
            x: event.clientX - imgRect.left,
            y: event.clientY - imgRect.top
        };

        return this.displayToDevice(clickPos, imgElement);
    }

    /**
     * Convert display position to device coordinates
     */
    displayToDevice(displayPos, imgElement) {
        const displayInfo = this.getDisplayInfo(imgElement);

        if (!displayInfo) {
            return { x: 0, y: 0 };
        }

        const { offsetX, offsetY, actualImgWidth, actualImgHeight } = displayInfo;

        // Adjust for letterboxing/pillarboxing
        const adjustedX = displayPos.x - offsetX;
        const adjustedY = displayPos.y - offsetY;

        // Check if click is outside the actual image area
        if (adjustedX < 0 || adjustedY < 0 ||
            adjustedX > actualImgWidth || adjustedY > actualImgHeight) {
            return null; // Outside image bounds
        }

        // Convert to device coordinates
        const deviceX = Math.round((adjustedX / actualImgWidth) * this.system.device.width);
        const deviceY = Math.round((adjustedY / actualImgHeight) * this.system.device.height);

        return {
            x: Math.max(0, Math.min(deviceX, this.system.device.width)),
            y: Math.max(0, Math.min(deviceY, this.system.device.height))
        };
    }

    /**
     * Convert device coordinates to display position
     */
    deviceToDisplay(devicePos, imgElement) {
        const displayInfo = this.getDisplayInfo(imgElement);

        if (!displayInfo) {
            return { x: 0, y: 0 };
        }

        const { offsetX, offsetY, actualImgWidth, actualImgHeight } = displayInfo;

        // Convert device to display space
        const displayX = (devicePos.x / this.system.device.width) * actualImgWidth;
        const displayY = (devicePos.y / this.system.device.height) * actualImgHeight;

        return {
            x: displayX + offsetX,
            y: displayY + offsetY
        };
    }

    /**
     * Convert device region to display region
     */
    regionDeviceToDisplay(deviceRegion, imgElement) {
        const topLeft = this.deviceToDisplay(
            { x: deviceRegion.x, y: deviceRegion.y },
            imgElement
        );

        const bottomRight = this.deviceToDisplay(
            { x: deviceRegion.x + deviceRegion.width, y: deviceRegion.y + deviceRegion.height },
            imgElement
        );

        return {
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    /**
     * Convert display region to device region
     */
    regionDisplayToDevice(displayRegion, imgElement) {
        const topLeft = this.displayToDevice(
            { x: displayRegion.x, y: displayRegion.y },
            imgElement
        );

        const bottomRight = this.displayToDevice(
            { x: displayRegion.x + displayRegion.width, y: displayRegion.y + displayRegion.height },
            imgElement
        );

        if (!topLeft || !bottomRight) {
            return null;
        }

        return {
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    /**
     * Get display information for image element
     */
    getDisplayInfo(imgElement) {
        if (!imgElement || !imgElement.complete) {
            return null;
        }

        const imgRect = imgElement.getBoundingClientRect();
        const containerWidth = imgRect.width;
        const containerHeight = imgRect.height;

        const naturalWidth = imgElement.naturalWidth;
        const naturalHeight = imgElement.naturalHeight;

        if (!naturalWidth || !naturalHeight) {
            return null;
        }

        const naturalAspect = naturalWidth / naturalHeight;
        const containerAspect = containerWidth / containerHeight;

        let actualImgWidth, actualImgHeight, offsetX, offsetY;

        if (naturalAspect > containerAspect) {
            // Image is wider - letterboxing (black bars top/bottom)
            actualImgWidth = containerWidth;
            actualImgHeight = containerWidth / naturalAspect;
            offsetX = 0;
            offsetY = (containerHeight - actualImgHeight) / 2;
        } else {
            // Image is taller - pillarboxing (black bars left/right)
            actualImgHeight = containerHeight;
            actualImgWidth = containerHeight * naturalAspect;
            offsetY = 0;
            offsetX = (containerWidth - actualImgWidth) / 2;
        }

        return {
            containerWidth,
            containerHeight,
            actualImgWidth,
            actualImgHeight,
            offsetX,
            offsetY,
            naturalWidth,
            naturalHeight,
            scale: actualImgWidth / naturalWidth
        };
    }

    /**
     * Check if display position is within image bounds
     */
    isWithinImageBounds(displayPos, imgElement) {
        const displayInfo = this.getDisplayInfo(imgElement);

        if (!displayInfo) {
            return false;
        }

        const { offsetX, offsetY, actualImgWidth, actualImgHeight } = displayInfo;

        const relativeX = displayPos.x - offsetX;
        const relativeY = displayPos.y - offsetY;

        return relativeX >= 0 && relativeX <= actualImgWidth &&
               relativeY >= 0 && relativeY <= actualImgHeight;
    }

    /**
     * Get scaled coordinates for action based on device size
     */
    getScaledCoordinates(action) {
        if (!action.x || !action.y) {
            return action;
        }

        // If action already has correct device coordinates, return as-is
        return {
            ...action,
            x: Math.round(action.x),
            y: Math.round(action.y)
        };
    }

    /**
     * Calculate region from two points
     */
    calculateRegion(startPoint, endPoint) {
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);

        return { x, y, width, height };
    }

    /**
     * Get center point of a region
     */
    getRegionCenter(region) {
        return {
            x: region.x + region.width / 2,
            y: region.y + region.height / 2
        };
    }

    /**
     * Check if point is inside region
     */
    isPointInRegion(point, region) {
        return point.x >= region.x &&
               point.x <= region.x + region.width &&
               point.y >= region.y &&
               point.y <= region.y + region.height;
    }

    /**
     * Get device orientation
     */
    getOrientation() {
        if (!this.system.device.width || !this.system.device.height) {
            return 'unknown';
        }

        return this.system.device.width > this.system.device.height
            ? 'landscape'
            : 'portrait';
    }

    /**
     * Format coordinates for display
     */
    formatCoordinates(coords) {
        return `(${coords.x}, ${coords.y})`;
    }

    /**
     * Format region for display
     */
    formatRegion(region) {
        return `x:${region.x}, y:${region.y}, w:${region.width}, h:${region.height}`;
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoordinateService;
}

if (typeof window !== 'undefined') {
    window.CoordinateService = CoordinateService;
}
