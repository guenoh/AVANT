/**
 * Pure JavaScript Image Matching System
 * Simple vertical search from crop location
 * Using Normalized Cross-Correlation algorithm
 */

class ImageMatcher {
  constructor() {
    // Image location cache
    this.locationCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Performance statistics
    this.stats = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageSearchTime: 0
    };

    console.log('[ImageMatcher] Initialized with pure JavaScript algorithm');
  }

  /**
   * Convert ImageData to grayscale using luminosity method
   * Formula: 0.299*R + 0.587*G + 0.114*B
   */
  toGrayscale(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Uint8Array(width * height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Luminosity method for accurate grayscale conversion
      gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return {
      data: gray,
      width: width,
      height: height
    };
  }

  /**
   * Extract edges using Sobel operator
   * This makes matching color-invariant (only structure matters)
   */
  toEdges(grayImage) {
    const width = grayImage.width;
    const height = grayImage.height;
    const gray = grayImage.data;
    const edges = new Uint8Array(width * height);

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    // Apply Sobel operator (skip borders)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        // 3x3 convolution
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            const pixel = gray[idx];

            gx += pixel * sobelX[kernelIdx];
            gy += pixel * sobelY[kernelIdx];
          }
        }

        // Gradient magnitude
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = Math.min(255, Math.round(magnitude));
      }
    }

    return {
      data: edges,
      width: width,
      height: height
    };
  }

  /**
   * Calculate image hash for caching
   */
  calculateImageHash(imageData) {
    const data = imageData.data;
    let hash = 0;

    const step = Math.floor(data.length / 1000);
    for (let i = 0; i < data.length; i += step) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }

    return hash.toString(36);
  }

  /**
   * Get cached location
   */
  getCachedLocation(imageHash) {
    const cached = this.locationCache.get(imageHash);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.locationCache.delete(imageHash);
      return null;
    }

    return cached;
  }

  /**
   * Save location to cache
   */
  cacheLocation(imageHash, location) {
    this.locationCache.set(imageHash, {
      ...location,
      timestamp: Date.now()
    });

    if (this.locationCache.size > 100) {
      const firstKey = this.locationCache.keys().next().value;
      this.locationCache.delete(firstKey);
    }
  }

  /**
   * Main template matching method - simple vertical search from crop Y
   */
  async findTemplate(sourceImageData, templateImageData, options = {}) {
    console.log('[ImageMatcher] findTemplate called');

    const {
      threshold = 0.95,
      timeout = 10000,
      useCache = true,
      cropLocation = null,
      colorInvariant = false  // Use edge-based matching for color changes
    } = options;

    const startTime = Date.now();
    console.log('[ImageMatcher] Calculating image hash...');
    const imageHash = this.calculateImageHash(templateImageData);

    this.stats.totalSearches++;

    console.log('[ImageMatcher] Converting to grayscale...');
    // Convert to grayscale using pure JavaScript
    let srcGray = this.toGrayscale(sourceImageData);
    console.log('[ImageMatcher] Source grayscale created');
    let tmpGray = this.toGrayscale(templateImageData);
    console.log('[ImageMatcher] Template grayscale created');

    // If color-invariant mode, use edge detection
    if (colorInvariant) {
      console.log('[ImageMatcher] Applying edge detection for color-invariant matching');
      srcGray = this.toEdges(srcGray);
      tmpGray = this.toEdges(tmpGray);
      console.log('[ImageMatcher] Edge detection completed');
    }

    // Check cache first
    if (useCache) {
      const cachedLocation = this.getCachedLocation(imageHash);
      if (cachedLocation) {
        const score = this.matchTemplateAt(srcGray, tmpGray, cachedLocation.x, cachedLocation.y);
        if (score >= threshold) {
          this.stats.cacheHits++;
          return {
            found: true,
            x: cachedLocation.x,
            y: cachedLocation.y,
            width: tmpGray.width,
            height: tmpGray.height,
            score: score,
            searchPhase: 'cache',
            totalTime: Date.now() - startTime
          };
        }
      }
    }

    // Simple vertical search from crop location
    let result;
    if (cropLocation) {
      result = this.searchVerticalFromCrop(
        srcGray,
        tmpGray,
        cropLocation,
        threshold,
        startTime,
        timeout
      );
    } else {
      // No crop location - search full screen
      result = this.searchFullScreen(
        srcGray,
        tmpGray,
        threshold,
        startTime,
        timeout
      );
    }

    if (result.found) {
      this.cacheLocation(imageHash, result);
    } else {
      this.stats.cacheMisses++;
    }

    result.totalTime = Date.now() - startTime;
    return result;
  }

  /**
   * Search vertically from crop location with horizontal tolerance
   */
  searchVerticalFromCrop(srcGray, tmpGray, cropLocation, threshold, startTime, timeout) {
    const centerX = cropLocation.x;
    const centerY = cropLocation.y;
    const stepY = 4; // Pixel step for vertical search
    const stepX = 8; // Pixel step for horizontal search
    const xTolerance = 50; // Search ±50 pixels horizontally

    const minY = 0;
    const maxY = srcGray.height - tmpGray.height;
    const minX = Math.max(0, centerX - xTolerance);
    const maxX = Math.min(srcGray.width - tmpGray.width, centerX + xTolerance);

    let bestMatch = {
      found: false,
      x: centerX,
      y: centerY,
      width: tmpGray.width,
      height: tmpGray.height,
      score: 0
    };

    console.log(`[ImageMatcher] Starting search from crop location (${centerX}, ${centerY})`);
    console.log(`[ImageMatcher] Search range: X ${minX}-${maxX}, Y ${minY}-${maxY}`);

    // Phase 1: Vertical search with center X, expanding up and down
    const maxDistanceY = Math.max(centerY - minY, maxY - centerY);
    let searchCount = 0;

    console.log(`[ImageMatcher] Phase 1: Vertical search at X=${centerX}`);

    for (let dy = 0; dy <= maxDistanceY; dy += stepY) {
      if (Date.now() - startTime > timeout) {
        console.log(`[ImageMatcher] Search timeout after ${searchCount} attempts`);
        break;
      }

      // Try center first (dy = 0), then down, then up
      const yPositions = dy === 0 ? [centerY] : [centerY + dy, centerY - dy];

      for (const y of yPositions) {
        if (y < minY || y > maxY) continue;

        searchCount++;
        const score = this.matchTemplateAt(srcGray, tmpGray, centerX, y);

        if (searchCount <= 10 || searchCount % 50 === 0) {
          console.log(`[ImageMatcher] #${searchCount} Checking (${centerX}, ${y}) - Score: ${(score * 100).toFixed(1)}%`);
        }

        if (score > bestMatch.score) {
          bestMatch.score = score;
          bestMatch.x = centerX;
          bestMatch.y = y;

          if (score >= threshold) {
            bestMatch.found = true;
            console.log(`[ImageMatcher] Match found! Position: (${centerX}, ${y}), Score: ${(score * 100).toFixed(1)}%`);
            return bestMatch;
          }
        }
      }
    }

    console.log(`[ImageMatcher] Phase 1 completed. Best score: ${(bestMatch.score * 100).toFixed(1)}% at (${bestMatch.x}, ${bestMatch.y})`);

    // Phase 2: If no good match found, search horizontally around best Y
    if (bestMatch.score < threshold && bestMatch.score > 0) {
      console.log(`[ImageMatcher] Phase 2: Horizontal search at Y=${bestMatch.y}`);

      for (let x = minX; x <= maxX; x += stepX) {
        if (Date.now() - startTime > timeout) break;

        searchCount++;
        const score = this.matchTemplateAt(srcGray, tmpGray, x, bestMatch.y);

        if (score > bestMatch.score) {
          bestMatch.score = score;
          bestMatch.x = x;
          console.log(`[ImageMatcher] Improved score at (${x}, ${bestMatch.y}) - Score: ${(score * 100).toFixed(1)}%`);

          if (score >= threshold) {
            bestMatch.found = true;
            console.log(`[ImageMatcher] Match found! Position: (${x}, ${bestMatch.y}), Score: ${(score * 100).toFixed(1)}%`);
            return bestMatch;
          }
        }
      }
    }

    console.log(`[ImageMatcher] Phase 2 completed. Total attempts: ${searchCount}, Best score: ${(bestMatch.score * 100).toFixed(1)}%`);

    // Phase 3: Refine search around best match with 1px step
    if (bestMatch.score > 0 && bestMatch.score < threshold) {
      console.log(`[ImageMatcher] Phase 3: Refinement around (${bestMatch.x}, ${bestMatch.y})`);
      const refineRange = 8;
      const refineMinY = Math.max(minY, bestMatch.y - refineRange);
      const refineMaxY = Math.min(maxY, bestMatch.y + refineRange);
      const refineMinX = Math.max(minX, bestMatch.x - refineRange);
      const refineMaxX = Math.min(maxX, bestMatch.x + refineRange);

      for (let y = refineMinY; y <= refineMaxY; y++) {
        for (let x = refineMinX; x <= refineMaxX; x++) {
          if (Date.now() - startTime > timeout) {
            console.log(`[ImageMatcher] Refinement timeout`);
            break;
          }

          searchCount++;
          const score = this.matchTemplateAt(srcGray, tmpGray, x, y);

          if (score > bestMatch.score) {
            bestMatch.score = score;
            bestMatch.x = x;
            bestMatch.y = y;
            console.log(`[ImageMatcher] Refinement improved: (${x}, ${y}) - Score: ${(score * 100).toFixed(1)}%`);

            if (score >= threshold) {
              bestMatch.found = true;
              console.log(`[ImageMatcher] Match found in refinement!`);
              return bestMatch;
            }
          }
        }
      }
    }

    console.log(`[ImageMatcher] Search completed. Total: ${searchCount} attempts, Best: ${(bestMatch.score * 100).toFixed(1)}% at (${bestMatch.x}, ${bestMatch.y})`);
    return bestMatch;
  }

  /**
   * Full screen grid search (fallback when no crop location)
   */
  searchFullScreen(srcGray, tmpGray, threshold, startTime, timeout) {
    const step = 8;

    let bestMatch = {
      found: false,
      x: 0,
      y: 0,
      width: tmpGray.width,
      height: tmpGray.height,
      score: 0
    };

    // Grid search entire screen
    for (let y = 0; y <= srcGray.height - tmpGray.height; y += step) {
      for (let x = 0; x <= srcGray.width - tmpGray.width; x += step) {
        if (Date.now() - startTime > timeout) {
          return bestMatch;
        }

        const score = this.matchTemplateAt(srcGray, tmpGray, x, y);

        if (score > bestMatch.score) {
          bestMatch.score = score;
          bestMatch.x = x;
          bestMatch.y = y;

          if (score >= threshold) {
            bestMatch.found = true;
            return bestMatch;
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Simple pixel difference matching
   * Returns a score between 0 and 1, where 1 is a perfect match
   * This is much faster and simpler than NCC
   */
  matchTemplateAt(srcGray, tmpGray, x, y) {
    try {
      const tmpWidth = tmpGray.width;
      const tmpHeight = tmpGray.height;
      const srcWidth = srcGray.width;

      // Check bounds
      if (x + tmpWidth > srcWidth || y + tmpHeight > srcGray.height) {
        return 0;
      }

      const tmpData = tmpGray.data;
      const srcData = srcGray.data;
      const numPixels = tmpWidth * tmpHeight;

      // Calculate average pixel difference
      let totalDiff = 0;

      for (let ty = 0; ty < tmpHeight; ty++) {
        for (let tx = 0; tx < tmpWidth; tx++) {
          const tmpIdx = (ty * tmpWidth) + tx;
          const srcIdx = ((y + ty) * srcWidth) + (x + tx);

          // Absolute difference between pixels
          const diff = Math.abs(tmpData[tmpIdx] - srcData[srcIdx]);
          totalDiff += diff;
        }
      }

      // Calculate average difference per pixel
      const avgDiff = totalDiff / numPixels;

      // Convert to similarity score (0-1, where 1 is perfect match)
      // Max difference per pixel is 255 (white vs black)
      // We use a threshold to be more lenient with small differences
      const similarity = 1.0 - (avgDiff / 255.0);

      // Apply threshold curve to make matching less strict
      // Small differences should still result in high scores
      const score = Math.pow(similarity, 0.5); // Square root makes it more lenient

      return Math.max(0, Math.min(1, score));

    } catch (error) {
      console.error('[ImageMatcher] Error in matchTemplateAt:', error);
      return 0;
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageSearchTime: 0
    };
  }

  /**
   * Clear location cache
   */
  clearCache() {
    this.locationCache.clear();
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.locationCache.size,
      hitRate: this.stats.totalSearches > 0
        ? (this.stats.cacheHits / this.stats.totalSearches * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// Create global instance
window.imageMatcher = new ImageMatcher();
