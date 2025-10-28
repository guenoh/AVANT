/**
 * 추적 오버레이 시스템
 * 매크로 액션들을 시각적으로 표시하는 기능
 */

class TrackingOverlay {
  constructor() {
    this.isActive = false;
    this.trackingData = [];
    this.markers = [];
    this.overlay = null;
    this.stats = {
      taps: 0,
      swipes: 0,
      imageSearches: 0,
      inputs: 0
    };

    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.overlay = document.getElementById('tracking-overlay');

    // IPC 이벤트 리스너 설정
    if (window.visionAuto) {
      // 액션 실행 이벤트 수신
      window.visionAuto.onMacroAction((action) => {
        if (this.isActive) {
          this.trackAction(action);
        }
      });
    }

    // Window resize 이벤트 리스너 추가
    window.addEventListener('resize', () => {
      if (this.isActive) {
        this.refreshMarkers();
      }
    });

    // Canvas 크기 변화 감지
    const canvas = document.getElementById('screen-canvas');
    if (canvas) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.isActive) {
          this.refreshMarkers();
        }
      });
      this.resizeObserver.observe(canvas);
    }
  }

  /**
   * 추적 모드 토글
   */
  toggle() {
    this.isActive = !this.isActive;

    if (this.isActive) {
      this.show();
    } else {
      this.hide();
    }

    return this.isActive;
  }

  /**
   * 오버레이 표시
   */
  show() {
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
      console.log('Tracking overlay activated');
    }
  }

  /**
   * 오버레이 숨기기
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
      this.clear();
    }
  }

  /**
   * 모든 마커 제거
   */
  clear() {
    if (this.overlay) {
      this.overlay.innerHTML = '';
    }
    this.markers = [];
    this.trackingData = [];
    this.resetStats();
  }

  /**
   * 캔버스 크기 변경 시 마커 재배치
   */
  refreshMarkers() {
    // 기존 마커들 제거
    if (this.overlay) {
      this.overlay.innerHTML = '';
    }
    this.markers = [];

    console.log('Refreshing markers, total:', this.trackingData.length);

    // 저장된 추적 데이터를 기반으로 마커 다시 그리기
    this.trackingData.forEach(data => {
      switch (data.type) {
        case 'TAP':
          this.addTapMarker(data.x, data.y, data.label);
          break;
        case 'SWIPE':
          this.addSwipeMarker(data.startX, data.startY, data.endX, data.endY);
          break;
        case 'IF_IMAGE':
        case 'WAIT_IMAGE':
        case 'FIND_AND_TAP':
          this.addImageSearchMarker(data);
          break;
        case 'INPUT_TEXT':
          this.addInputMarker(data.x, data.y, data.text);
          break;
      }
    });
  }

  /**
   * 통계 초기화
   */
  resetStats() {
    this.stats = {
      taps: 0,
      swipes: 0,
      imageSearches: 0,
      inputs: 0
    };
  }

  /**
   * 액션 추적
   */
  trackAction(action) {
    const timestamp = Date.now();
    const trackingInfo = {
      ...action,
      timestamp
    };

    this.trackingData.push(trackingInfo);

    switch (action.type) {
      case 'TAP':
        this.addTapMarker(action.x, action.y, action.label);
        this.stats.taps++;
        break;

      case 'SWIPE':
        this.addSwipeMarker(action.startX, action.startY, action.endX, action.endY);
        this.stats.swipes++;
        break;

      case 'IF_IMAGE':
      case 'WAIT_IMAGE':
      case 'FIND_AND_TAP':
        this.addImageSearchMarker(action);
        this.stats.imageSearches++;
        break;

      case 'INPUT_TEXT':
        this.addInputMarker(action.x, action.y, action.text);
        this.stats.inputs++;
        break;
    }

    this.updateStats();
  }

  /**
   * 탭 마커 추가
   */
  addTapMarker(x, y, label = '') {
    const canvas = document.getElementById('screen-canvas');
    if (!canvas) return;

    // 캔버스의 표시 크기와 내부 해상도 가져오기
    const rect = canvas.getBoundingClientRect();

    // 오버레이의 위치 가져오기
    const overlayRect = this.overlay.getBoundingClientRect();

    // Debug logging
    console.log('=== Tap Marker Debug ===');
    console.log('Input coordinates:', { x, y });
    console.log('Canvas rect:', { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    console.log('Overlay rect:', { left: overlayRect.left, top: overlayRect.top });
    console.log('Canvas dimensions:', {
      width: canvas.width,
      height: canvas.height,
      displayWidth: rect.width,
      displayHeight: rect.height
    });

    // 좌표를 화면 비율로 변환 (canvas.width 기준)
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    // Canvas 좌표를 overlay 기준 좌표로 변환
    const relativeX = (x * scaleX) + (rect.left - overlayRect.left);
    const relativeY = (y * scaleY) + (rect.top - overlayRect.top);

    console.log('Scale:', { scaleX, scaleY });
    console.log('Offset:', { x: rect.left - overlayRect.left, y: rect.top - overlayRect.top });
    console.log('Marker position:', { relativeX, relativeY });
    console.log('=======================');

    const marker = document.createElement('div');
    marker.className = 'tap-marker';
    marker.style.left = `${relativeX}px`;
    marker.style.top = `${relativeY}px`;

    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'action-label';
      labelEl.textContent = label;
      labelEl.style.left = `${relativeX}px`;
      labelEl.style.top = `${relativeY}px`;
      this.overlay.appendChild(labelEl);
    }

    this.overlay.appendChild(marker);
    this.markers.push(marker);

    // 일정 시간 후 페이드 아웃
    setTimeout(() => {
      marker.style.opacity = '0.3';
    }, 3000);
  }

  /**
   * 스와이프 마커 추가
   */
  addSwipeMarker(startX, startY, endX, endY) {
    const canvas = document.getElementById('screen-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();

    // 좌표를 화면 비율로 변환 (canvas.width 기준)
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    // 오프셋 계산
    const offsetX = rect.left - overlayRect.left;
    const offsetY = rect.top - overlayRect.top;

    // SVG로 화살표 그리기
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'swipe-path';
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const x1 = (startX * scaleX) + offsetX;
    const y1 = (startY * scaleY) + offsetY;
    const x2 = (endX * scaleX) + offsetX;
    const y2 = (endY * scaleY) + offsetY;

    // 화살표 경로 생성
    const d = `M ${x1} ${y1} L ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.className = 'swipe-arrow';

    // 화살표 머리 추가
    const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;

    const points = [
      [x2, y2],
      [
        x2 - arrowLength * Math.cos(angle - arrowAngle),
        y2 - arrowLength * Math.sin(angle - arrowAngle)
      ],
      [
        x2 - arrowLength * Math.cos(angle + arrowAngle),
        y2 - arrowLength * Math.sin(angle + arrowAngle)
      ]
    ].map(p => p.join(',')).join(' ');

    arrowHead.setAttribute('points', points);
    arrowHead.setAttribute('fill', '#5f27cd');
    arrowHead.setAttribute('opacity', '0.8');

    svg.appendChild(path);
    svg.appendChild(arrowHead);
    this.overlay.appendChild(svg);
    this.markers.push(svg);

    setTimeout(() => {
      svg.style.opacity = '0.3';
    }, 3000);
  }

  /**
   * 이미지 검색 마커 추가
   */
  addImageSearchMarker(data) {
    const canvas = document.getElementById('screen-canvas');
    if (!canvas || !data || !data.region) return;

    const region = data.region;
    const searchArea = data.searchArea || 'full';
    const screenWidth = data.screenWidth || canvas.width;
    const screenHeight = data.screenHeight || canvas.height;

    const rect = canvas.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();

    // 좌표를 화면 비율로 변환 (canvas.width 기준)
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    // 오프셋 계산
    const offsetX = rect.left - overlayRect.left;
    const offsetY = rect.top - overlayRect.top;

    // Add the crop box only (search area visualization removed)
    const box = document.createElement('div');
    box.className = 'image-search-box';

    if (region.x !== undefined && region.y !== undefined) {
      const left = (region.x * scaleX) + offsetX;
      const top = (region.y * scaleY) + offsetY;
      const width = (region.width || 100) * scaleX;
      const height = (region.height || 100) * scaleY;

      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
    } else if (region.centerX !== undefined) {
      // 중심점 기준
      const width = (region.width || 100) * scaleX;
      const height = (region.height || 100) * scaleY;
      const left = (region.centerX * scaleX) + offsetX - width / 2;
      const top = (region.centerY * scaleY) + offsetY - height / 2;

      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
    }

    this.overlay.appendChild(box);
    this.markers.push(box);

    setTimeout(() => {
      box.style.opacity = '0.3';
    }, 3000);
  }

  /**
   * 입력 마커 추가
   */
  addInputMarker(x, y, text) {
    const canvas = document.getElementById('screen-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();

    // 좌표를 화면 비율로 변환 (canvas.width 기준)
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    // 오프셋 계산
    const offsetX = rect.left - overlayRect.left;
    const offsetY = rect.top - overlayRect.top;

    const marker = document.createElement('div');
    marker.className = 'action-label';
    marker.style.left = `${((x || 100) * scaleX) + offsetX}px`;
    marker.style.top = `${((y || 100) * scaleY) + offsetY}px`;
    marker.style.background = 'rgba(46, 125, 50, 0.9)';
    marker.textContent = `📝 "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`;

    this.overlay.appendChild(marker);
    this.markers.push(marker);

    setTimeout(() => {
      marker.style.opacity = '0.3';
    }, 3000);
  }


  /**
   * 통계 업데이트 (콘솔에 로그)
   */
  updateStats() {
    console.log('Tracking stats:', {
      taps: this.stats.taps,
      swipes: this.stats.swipes,
      imageSearches: this.stats.imageSearches,
      inputs: this.stats.inputs
    });
  }

  /**
   * 추적 데이터 내보내기
   */
  exportData() {
    return {
      data: this.trackingData,
      stats: this.stats,
      timestamp: Date.now()
    };
  }

  /**
   * 테스트용 샘플 액션 생성
   */
  addSampleActions() {
    // 샘플 탭
    this.trackAction({
      type: 'TAP',
      x: 200,
      y: 300,
      label: 'Button Tap'
    });

    // 샘플 스와이프
    setTimeout(() => {
      this.trackAction({
        type: 'SWIPE',
        startX: 300,
        startY: 500,
        endX: 300,
        endY: 200
      });
    }, 500);

    // 샘플 이미지 검색
    setTimeout(() => {
      this.trackAction({
        type: 'IF_IMAGE',
        region: {
          x: 100,
          y: 100,
          width: 200,
          height: 100
        }
      });
    }, 1000);

    // 샘플 텍스트 입력
    setTimeout(() => {
      this.trackAction({
        type: 'INPUT_TEXT',
        x: 250,
        y: 400,
        text: 'Sample text input'
      });
    }, 1500);
  }
}

// 전역 인스턴스 생성
window.trackingOverlay = new TrackingOverlay();