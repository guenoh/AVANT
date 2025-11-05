/**
 * Unified Coordinate System for handling transformations between different coordinate spaces
 *
 * Coordinate Spaces:
 * 1. Device Space: The actual Android device resolution (portrait: 1080x2400)
 * 2. Image Space: How the image is stored (may be rotated)
 * 3. Display Space: How the image is shown in UI (landscape orientation)
 * 4. Viewport Space: The actual pixels on screen including letterbox
 */
class CoordinateSystem {
    constructor() {
        // Device properties (actual Android screen)
        this.deviceWidth = 1080;   // Portrait width
        this.deviceHeight = 2400;  // Portrait height
        this.deviceRotation = 0;   // 0 = portrait, 90 = landscape

        // Display properties (how we show it in UI)
        this.displayRotation = 0; // No rotation - display as is

        // Image properties (will be updated when image loads)
        this.imageNaturalWidth = 0;
        this.imageNaturalHeight = 0;

        // Viewport properties (actual display area)
        this.viewportWidth = 0;
        this.viewportHeight = 0;

        // Calculated properties
        this.letterbox = { top: 0, left: 0, right: 0, bottom: 0 };
        this.scale = { x: 1, y: 1 };

        // Debug mode
        this.debug = true;
    }

    /**
     * Initialize the coordinate system with device information
     */
    init(deviceWidth, deviceHeight, rotation = 0) {
        this.deviceWidth = deviceWidth;
        this.deviceHeight = deviceHeight;
        this.deviceRotation = rotation;

        this.log('Initialized', {
            device: { width: deviceWidth, height: deviceHeight, rotation },
            display: { rotation: this.displayRotation }
        });
    }

    /**
     * Update image properties when a new image loads
     */
    updateImage(img) {
        if (!img) return;

        this.imageNaturalWidth = img.naturalWidth;
        this.imageNaturalHeight = img.naturalHeight;

        this.log('Image updated', {
            natural: { width: img.naturalWidth, height: img.naturalHeight }
        });
    }

    /**
     * Update viewport when image element changes or resizes
     */
    updateViewport(imgElement) {
        if (!imgElement) return;

        const imgRect = imgElement.getBoundingClientRect();
        this.viewportWidth = imgRect.width;
        this.viewportHeight = imgRect.height;

        // Calculate letterbox and scale
        this.calculateDisplayMetrics(imgElement, imgRect);

        this.log('Viewport updated', {
            viewport: { width: this.viewportWidth, height: this.viewportHeight },
            letterbox: this.letterbox,
            scale: this.scale
        });
    }

    /**
     * Calculate display metrics (letterbox, scale) based on current state
     */
    calculateDisplayMetrics(img, imgRect) {
        // Determine effective dimensions considering rotation
        // Device is portrait (1080x2400) but we display it as landscape
        let effectiveDeviceWidth, effectiveDeviceHeight;

        if (this.displayRotation === 90 || this.displayRotation === 270) {
            // Display is rotated - swap dimensions
            effectiveDeviceWidth = this.deviceHeight;  // 2400
            effectiveDeviceHeight = this.deviceWidth;  // 1080
        } else {
            effectiveDeviceWidth = this.deviceWidth;
            effectiveDeviceHeight = this.deviceHeight;
        }

        // Calculate aspect ratios
        const deviceAspect = effectiveDeviceWidth / effectiveDeviceHeight;
        const viewportAspect = imgRect.width / imgRect.height;

        let actualWidth, actualHeight;

        if (viewportAspect > deviceAspect) {
            // Viewport is wider - vertical letterbox (black bars on sides)
            actualHeight = imgRect.height;
            actualWidth = imgRect.height * deviceAspect;
            this.letterbox.left = (imgRect.width - actualWidth) / 2;
            this.letterbox.right = this.letterbox.left;
            this.letterbox.top = 0;
            this.letterbox.bottom = 0;
        } else {
            // Viewport is taller - horizontal letterbox (black bars on top/bottom)
            actualWidth = imgRect.width;
            actualHeight = imgRect.width / deviceAspect;
            this.letterbox.top = (imgRect.height - actualHeight) / 2;
            this.letterbox.bottom = this.letterbox.top;
            this.letterbox.left = 0;
            this.letterbox.right = 0;
        }

        // Calculate scale factors
        this.scale.x = actualWidth / effectiveDeviceWidth;
        this.scale.y = actualHeight / effectiveDeviceHeight;

        this.log('Display metrics calculated', {
            effectiveDevice: { width: effectiveDeviceWidth, height: effectiveDeviceHeight },
            deviceAspect,
            viewportAspect,
            actual: { width: actualWidth, height: actualHeight },
            letterbox: this.letterbox,
            scale: this.scale
        });
    }

    /**
     * Convert viewport coordinates (click position) to device coordinates
     * @param {number} viewX - X position in viewport
     * @param {number} viewY - Y position in viewport
     * @returns {{x: number, y: number}} Device coordinates
     */
    viewportToDevice(viewX, viewY) {
        // Step 1: Remove letterbox offset
        const displayX = viewX - this.letterbox.left;
        const displayY = viewY - this.letterbox.top;

        // Step 2: Calculate effective display dimensions
        const effectiveWidth = this.viewportWidth - this.letterbox.left - this.letterbox.right;
        const effectiveHeight = this.viewportHeight - this.letterbox.top - this.letterbox.bottom;

        // Step 3: Clamp to display bounds
        const clampedX = Math.max(0, Math.min(effectiveWidth, displayX));
        const clampedY = Math.max(0, Math.min(effectiveHeight, displayY));

        // Step 4: Normalize to 0-1 range
        const normalizedX = clampedX / effectiveWidth;
        const normalizedY = clampedY / effectiveHeight;

        // Step 5: Convert to device coordinates considering rotation
        let deviceX, deviceY;

        if (this.displayRotation === 90) {
            // Display is rotated 90° clockwise
            // Display X (left-right) maps to Device Y (top-bottom)
            // Display Y (top-bottom) maps to Device X (left-right, inverted)
            deviceX = (1 - normalizedY) * this.deviceWidth;
            deviceY = normalizedX * this.deviceHeight;
        } else if (this.displayRotation === 270) {
            // Display is rotated 270° clockwise (90° counter-clockwise)
            deviceX = (1 - normalizedY) * this.deviceWidth;
            deviceY = (1 - normalizedX) * this.deviceHeight;
        } else if (this.displayRotation === 180) {
            // Display is rotated 180°
            deviceX = (1 - normalizedX) * this.deviceWidth;
            deviceY = (1 - normalizedY) * this.deviceHeight;
        } else {
            // No rotation
            deviceX = normalizedX * this.deviceWidth;
            deviceY = normalizedY * this.deviceHeight;
        }

        // Round to integers
        deviceX = Math.round(deviceX);
        deviceY = Math.round(deviceY);

        // Final clamp to device bounds
        deviceX = Math.max(0, Math.min(this.deviceWidth - 1, deviceX));
        deviceY = Math.max(0, Math.min(this.deviceHeight - 1, deviceY));

        this.log('Viewport to Device', {
            input: { viewX, viewY },
            display: { x: displayX, y: displayY },
            normalized: { x: normalizedX, y: normalizedY },
            output: { x: deviceX, y: deviceY }
        });

        return { x: deviceX, y: deviceY };
    }

    /**
     * Convert device coordinates to viewport coordinates (for marker positioning)
     * @param {number} deviceX - X position in device space
     * @param {number} deviceY - Y position in device space
     * @returns {{x: number, y: number}} Viewport coordinates
     */
    deviceToViewport(deviceX, deviceY) {
        // Step 1: Normalize device coordinates to 0-1 range
        const normalizedDeviceX = deviceX / this.deviceWidth;
        const normalizedDeviceY = deviceY / this.deviceHeight;

        // Step 2: Apply rotation transformation
        let normalizedDisplayX, normalizedDisplayY;

        if (this.displayRotation === 90) {
            // Device coordinates need to be rotated for display
            // Portrait device (1080x2400) displayed as landscape
            // Device X (0-1080, left-right) maps to Display Y (top-bottom, inverted)
            // Device Y (0-2400, top-bottom) maps to Display X (left-right)
            normalizedDisplayX = normalizedDeviceY;
            normalizedDisplayY = 1 - normalizedDeviceX;
        } else if (this.displayRotation === 270) {
            normalizedDisplayX = 1 - normalizedDeviceY;
            normalizedDisplayY = 1 - normalizedDeviceX;
        } else if (this.displayRotation === 180) {
            normalizedDisplayX = 1 - normalizedDeviceX;
            normalizedDisplayY = 1 - normalizedDeviceY;
        } else {
            normalizedDisplayX = normalizedDeviceX;
            normalizedDisplayY = normalizedDeviceY;
        }

        // Step 3: Calculate effective display dimensions
        const effectiveWidth = this.viewportWidth - this.letterbox.left - this.letterbox.right;
        const effectiveHeight = this.viewportHeight - this.letterbox.top - this.letterbox.bottom;

        // Step 4: Scale to display coordinates
        const displayX = normalizedDisplayX * effectiveWidth;
        const displayY = normalizedDisplayY * effectiveHeight;

        // Step 5: Add letterbox offset
        const viewX = displayX + this.letterbox.left;
        const viewY = displayY + this.letterbox.top;

        this.log('Device to Viewport', {
            input: { deviceX, deviceY },
            normalizedDevice: { x: normalizedDeviceX, y: normalizedDeviceY },
            normalizedDisplay: { x: normalizedDisplayX, y: normalizedDisplayY },
            display: { x: displayX, y: displayY },
            output: { x: viewX, y: viewY }
        });

        return { x: viewX, y: viewY };
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            device: {
                width: this.deviceWidth,
                height: this.deviceHeight,
                rotation: this.deviceRotation
            },
            display: {
                rotation: this.displayRotation
            },
            image: {
                naturalWidth: this.imageNaturalWidth,
                naturalHeight: this.imageNaturalHeight
            },
            viewport: {
                width: this.viewportWidth,
                height: this.viewportHeight
            },
            letterbox: this.letterbox,
            scale: this.scale
        };
    }

    /**
     * Debug logging
     */
    log(operation, data) {
        if (this.debug) {
            console.log(`[CoordinateSystem] ${operation}:`, data);
        }
    }
}

// Export for use in other modules
window.CoordinateSystem = CoordinateSystem;