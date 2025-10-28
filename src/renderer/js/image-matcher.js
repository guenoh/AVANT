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
   * Search vertically from crop location (fix X, vary Y)
   */
  searchVerticalFromCrop(srcGray, tmpGray, cropLocation, threshold, startTime, timeout) {
    const fixedX = cropLocation.x; // X is fixed at crop location
    const centerY = cropLocation.y; // Center Y from crop location
    const step = 4; // Pixel step for search

    const minY = 0;
    const maxY = srcGray.height - tmpGray.height;

    let bestMatch = {
      found: false,
      x: fixedX,
      y: centerY,
      width: tmpGray.width,
      height: tmpGray.height,
      score: 0
    };

    console.log(`[ImageMatcher] Starting vertical search from crop location (${fixedX}, ${centerY})`);
    console.log(`[ImageMatcher] Search range: Y ${minY} to ${maxY}, step: ${step}px`);

    // Search from center Y, expanding up and down
    const maxDistance = Math.max(centerY - minY, maxY - centerY);
    let searchCount = 0;

    for (let dy = 0; dy <= maxDistance; dy += step) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        console.log(`[ImageMatcher] Search timeout after ${searchCount} attempts`);
        break;
      }

      // Try center first (dy = 0)
      if (dy === 0) {
        const y = centerY;
        if (y >= minY && y <= maxY) {
          searchCount++;
          const score = this.matchTemplateAt(srcGray, tmpGray, fixedX, y);
          console.log(`[ImageMatcher] #${searchCount} Checking (${fixedX}, ${y}) - Score: ${(score * 100).toFixed(1)}%`);

          if (score > bestMatch.score) {
            bestMatch.score = score;
            bestMatch.y = y;

            if (score >= threshold) {
              bestMatch.found = true;
              console.log(`[ImageMatcher] Match found! Position: (${fixedX}, ${y}), Score: ${(score * 100).toFixed(1)}%`);
              return bestMatch;
            }
          }
        }
        continue;
      }

      // Try down (centerY + dy)
      const yDown = centerY + dy;
      if (yDown >= minY && yDown <= maxY) {
        searchCount++;
        const score = this.matchTemplateAt(srcGray, tmpGray, fixedX, yDown);
        console.log(`[ImageMatcher] #${searchCount} Checking (${fixedX}, ${yDown}) - Score: ${(score * 100).toFixed(1)}% | Best: ${(bestMatch.score * 100).toFixed(1)}%`);

        if (score > bestMatch.score) {
          bestMatch.score = score;
          bestMatch.y = yDown;

          if (score >= threshold) {
            bestMatch.found = true;
            console.log(`[ImageMatcher] Match found! Position: (${fixedX}, ${yDown}), Score: ${(score * 100).toFixed(1)}%`);
            return bestMatch;
          }
        }
      }

      // Try up (centerY - dy)
      const yUp = centerY - dy;
      if (yUp >= minY && yUp <= maxY) {
        searchCount++;
        const score = this.matchTemplateAt(srcGray, tmpGray, fixedX, yUp);
        console.log(`[ImageMatcher] #${searchCount} Checking (${fixedX}, ${yUp}) - Score: ${(score * 100).toFixed(1)}% | Best: ${(bestMatch.score * 100).toFixed(1)}%`);

        if (score > bestMatch.score) {
          bestMatch.score = score;
          bestMatch.y = yUp;

          if (score >= threshold) {
            bestMatch.found = true;
            console.log(`[ImageMatcher] Match found! Position: (${fixedX}, ${yUp}), Score: ${(score * 100).toFixed(1)}%`);
            return bestMatch;
          }
        }
      }
    }

    console.log(`[ImageMatcher] Phase 1 completed. Total attempts: ${searchCount}, Best score: ${(bestMatch.score * 100).toFixed(1)}%`);

    // Phase 2: Refine search around best match with 1px step
    if (bestMatch.score > 0 && bestMatch.score < threshold) {
      console.log(`[ImageMatcher] Starting Phase 2: Refining search around Y=${bestMatch.y} with 1px step`);
      const refineRange = 8; // Search ±8px around best match
      const refineMinY = Math.max(minY, bestMatch.y - refineRange);
      const refineMaxY = Math.min(maxY, bestMatch.y + refineRange);

      for (let y = refineMinY; y <= refineMaxY; y++) {
        if (Date.now() - startTime > timeout) {
          console.log(`[ImageMatcher] Refinement timeout after ${searchCount} total attempts`);
          break;
        }

        searchCount++;
        const score = this.matchTemplateAt(srcGray, tmpGray, fixedX, y);

        if (score > bestMatch.score) {
          bestMatch.score = score;
          bestMatch.y = y;
          console.log(`[ImageMatcher] Refinement improved score at (${fixedX}, ${y}) - Score: ${(score * 100).toFixed(1)}%`);

          if (score >= threshold) {
            bestMatch.found = true;
            console.log(`[ImageMatcher] Match found in refinement! Position: (${fixedX}, ${y}), Score: ${(score * 100).toFixed(1)}%`);
            return bestMatch;
          }
        }
      }

      console.log(`[ImageMatcher] Phase 2 completed. Final score: ${(bestMatch.score * 100).toFixed(1)}%`);
    }

    console.log(`[ImageMatcher] Search completed. Total attempts: ${searchCount}, Best score: ${(bestMatch.score * 100).toFixed(1)}%`);
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
   * Calculate match score using Normalized Cross-Correlation (NCC)
   * This is the standard algorithm used by OpenCV's TM_CCOEFF_NORMED
   * Returns a score between 0 and 1, where 1 is a perfect match
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

      // Calculate means
      let tmpSum = 0;
      let roiSum = 0;

      for (let ty = 0; ty < tmpHeight; ty++) {
        for (let tx = 0; tx < tmpWidth; tx++) {
          const tmpIdx = (ty * tmpWidth) + tx;
          const srcIdx = ((y + ty) * srcWidth) + (x + tx);
          tmpSum += tmpData[tmpIdx];
          roiSum += srcData[srcIdx];
        }
      }

      const tmpMean = tmpSum / numPixels;
      const roiMean = roiSum / numPixels;

      // Calculate correlation and standard deviations
      let correlation = 0;
      let tmpStdDev = 0;
      let roiStdDev = 0;

      for (let ty = 0; ty < tmpHeight; ty++) {
        for (let tx = 0; tx < tmpWidth; tx++) {
          const tmpIdx = (ty * tmpWidth) + tx;
          const srcIdx = ((y + ty) * srcWidth) + (x + tx);

          const tmpDiff = tmpData[tmpIdx] - tmpMean;
          const roiDiff = srcData[srcIdx] - roiMean;

          correlation += tmpDiff * roiDiff;
          tmpStdDev += tmpDiff * tmpDiff;
          roiStdDev += roiDiff * roiDiff;
        }
      }

      // Normalize correlation
      const denominator = Math.sqrt(tmpStdDev * roiStdDev);

      if (denominator < 1e-5) {
        // Flat regions - if both are flat and similar, consider it a good match
        const avgDiff = Math.abs(tmpMean - roiMean);
        return avgDiff < 5 ? 1.0 : 0;
      }

      const ncc = correlation / denominator;

      // NCC ranges from -1 to 1, where 1 is perfect match
      // We only care about positive correlation
      const patternScore = Math.max(0, ncc);

      // Calculate brightness difference penalty
      // NCC is brightness-invariant, so we need to check actual brightness
      const brightnessDiff = Math.abs(tmpMean - roiMean) / 255.0; // Normalize to 0-1
      const brightnessSimilarity = 1.0 - brightnessDiff;

      // Combine pattern matching with brightness matching
      // 60% pattern, 40% brightness - less sensitive to animation/scroll artifacts
      // Exact match: 100%, animation frame: 96%, gray overlay: 94%
      const finalScore = (patternScore * 0.6) + (brightnessSimilarity * 0.4);

      return finalScore;

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
