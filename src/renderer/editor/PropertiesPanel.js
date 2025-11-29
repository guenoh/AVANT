/**
 * Properties Panel
 * 우측 속성 패널 - 선택된 액션의 속성 편집
 */

class PropertiesPanel {
  constructor(actionStore, editor) {
    this.actionStore = actionStore;
    this.editor = editor;
    this.log = window.logger.createScope('PropertiesPanel');

    this.container = null;
    this.currentAction = null;
    this.currentActionIndex = -1;
  }

  /**
   * Initialize panel
   */
  init() {
    this.container = document.getElementById('properties-content');

    // Listen to action selection events
    document.addEventListener('action-selected', (e) => {
      this.loadAction(e.detail.action, e.detail.index);
    });

    this.log.debug('Initialized');
  }

  /**
   * Load action for editing
   */
  loadAction(action, index) {
    this.currentAction = { ...action };
    this.currentActionIndex = index;

    this.log.debug('Loading action', { type: action.type });

    // Render properties form
    this.render();

    // Show action buttons
    document.getElementById('property-actions').style.display = 'flex';
  }

  /**
   * Render properties form
   */
  render() {
    if (!this.currentAction) {
      this._renderEmptyState();
      return;
    }

    const formHtml = this._generateForm(this.currentAction);
    this.container.innerHTML = formHtml;

    // Attach event listeners
    this._attachEventListeners();

    // Show preview if applicable
    this._updatePreview();
  }

  /**
   * Render empty state
   */
  _renderEmptyState() {
    this.container.innerHTML = `
      <div class="properties-empty">
        <div class="empty-icon">⚙️</div>
        <div class="empty-title">속성 없음</div>
        <div class="empty-description">
          액션을 선택하면<br>
          속성을 편집할 수 있습니다
        </div>
      </div>
    `;

    document.getElementById('property-actions').style.display = 'none';
    document.getElementById('preview-section').style.display = 'none';
  }

  /**
   * Generate form based on action type
   */
  _generateForm(action) {
    const fields = this._getFieldsForActionType(action.type);

    return `
      <div class="property-form">
        <div class="property-section">
          <div class="property-section-title">액션 타입</div>
          <div class="property-group">
            <div class="property-label">
              ${this._getActionTypeLabel(action.type)}
            </div>
          </div>
        </div>

        <div class="property-section">
          <div class="property-section-title">속성</div>
          ${fields.map(field => this._renderField(field, action)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Get fields configuration for action type
   */
  _getFieldsForActionType(type) {
    const fieldMap = {
      tap: [
        { name: 'x', type: 'number', label: 'X 좌표', min: 0, required: true },
        { name: 'y', type: 'number', label: 'Y 좌표', min: 0, required: true }
      ],
      swipe: [
        { name: 'x1', type: 'number', label: '시작 X', min: 0, required: true },
        { name: 'y1', type: 'number', label: '시작 Y', min: 0, required: true },
        { name: 'x2', type: 'number', label: '끝 X', min: 0, required: true },
        { name: 'y2', type: 'number', label: '끝 Y', min: 0, required: true },
        { name: 'duration', type: 'number', label: '시간 (ms)', min: 100, value: 300 }
      ],
      scroll: [
        { name: 'direction', type: 'select', label: '방향', options: [
          { value: 'up', label: '위' },
          { value: 'down', label: '아래' },
          { value: 'left', label: '왼쪽' },
          { value: 'right', label: '오른쪽' }
        ], required: true },
        { name: 'distance', type: 'number', label: '거리 (px)', min: 100, value: 600 }
      ],
      input: [
        { name: 'text', type: 'text', label: '입력 텍스트', required: true }
      ],
      wait: [
        { name: 'duration', type: 'number', label: '대기 시간 (ms)', min: 0, required: true }
      ],
      image: [
        { name: 'imagePath', type: 'file', label: '이미지 파일', required: true },
        { name: 'threshold', type: 'number', label: '매칭 임계값', min: 0, max: 1, step: 0.01, value: 0.8 }
      ],
      key: [
        { name: 'keyCode', type: 'select', label: '키', options: [
          { value: 'BACK', label: 'Back' },
          { value: 'HOME', label: 'Home' },
          { value: 'MENU', label: 'Menu' },
          { value: 'POWER', label: 'Power' },
          { value: 'VOLUME_UP', label: 'Volume Up' },
          { value: 'VOLUME_DOWN', label: 'Volume Down' }
        ], required: true }
      ],
      screenshot: []
    };

    return fieldMap[type] || [];
  }

  /**
   * Render a single field
   */
  _renderField(field, action) {
    const value = action[field.name] !== undefined ? action[field.name] : (field.value || '');

    switch (field.type) {
      case 'number':
        return `
          <div class="property-group">
            <label class="property-label">
              ${field.label}
              ${field.required ? '<span class="label-required">*</span>' : ''}
            </label>
            <input
              type="number"
              class="property-input property-input-number"
              name="${field.name}"
              value="${value}"
              ${field.min !== undefined ? `min="${field.min}"` : ''}
              ${field.max !== undefined ? `max="${field.max}"` : ''}
              ${field.step !== undefined ? `step="${field.step}"` : ''}
              ${field.required ? 'required' : ''}
            >
          </div>
        `;

      case 'text':
      case 'textarea':
        const inputTag = field.type === 'textarea' ? 'textarea' : 'input';
        const typeAttr = field.type === 'textarea' ? '' : 'type="text"';
        const className = field.type === 'textarea' ? 'property-textarea' : 'property-input';

        return `
          <div class="property-group">
            <label class="property-label">
              ${field.label}
              ${field.required ? '<span class="label-required">*</span>' : ''}
            </label>
            <${inputTag}
              ${typeAttr}
              class="${className}"
              name="${field.name}"
              ${field.required ? 'required' : ''}
            >${value}</${inputTag}>
          </div>
        `;

      case 'select':
        return `
          <div class="property-group">
            <label class="property-label">
              ${field.label}
              ${field.required ? '<span class="label-required">*</span>' : ''}
            </label>
            <select
              class="property-select"
              name="${field.name}"
              ${field.required ? 'required' : ''}
            >
              ${field.options.map(opt => `
                <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                  ${opt.label}
                </option>
              `).join('')}
            </select>
          </div>
        `;

      case 'file':
        return `
          <div class="property-group">
            <label class="property-label">
              ${field.label}
              ${field.required ? '<span class="label-required">*</span>' : ''}
            </label>
            <div class="property-file-upload">
              <input
                type="file"
                class="property-file-input"
                id="file-${field.name}"
                accept="image/*"
              >
              <button class="property-file-btn" data-file-input="file-${field.name}">
                파일 선택
              </button>
              <span class="property-file-name" id="filename-${field.name}">
                ${value ? value.split('/').pop() : '선택된 파일 없음'}
              </span>
            </div>
          </div>
        `;

      default:
        return '';
    }
  }

  /**
   * Get action type label
   */
  _getActionTypeLabel(type) {
    const labels = {
      tap: '🖱️ 탭 (터치)',
      swipe: '👆 스와이프',
      scroll: '📜 스크롤',
      input: '⌨️ 입력',
      wait: '⏱️ 대기',
      image: '🖼️ 이미지 매칭',
      key: '🔑 키 입력',
      screenshot: '📸 스크린샷'
    };
    return labels[type] || type;
  }

  /**
   * Attach event listeners to form inputs
   */
  _attachEventListeners() {
    const inputs = this.container.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      input.addEventListener('change', () => {
        const name = input.getAttribute('name');
        let value = input.value;

        // Parse number inputs
        if (input.type === 'number') {
          value = parseFloat(value);
        }

        // Update current action
        this.currentAction[name] = value;

        // Update preview
        this._updatePreview();
      });
    });

    // File button click handling
    const fileButtons = this.container.querySelectorAll('.property-file-btn');
    fileButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.fileInput;
        const fileInput = document.getElementById(inputId);
        if (fileInput) {
          fileInput.click();
        }
      });
    });

    // File input change handling
    const fileInputs = this.container.querySelectorAll('.property-file-input');
    fileInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const name = input.id.replace('file-', '');
          this.currentAction[name] = file.path || file.name;

          // Update filename display
          const filenameEl = document.getElementById(`filename-${name}`);
          if (filenameEl) {
            filenameEl.textContent = file.name;
          }
        }
      });
    });
  }

  /**
   * Update preview canvas
   */
  _updatePreview() {
    const previewSection = document.getElementById('preview-section');
    const previewOverlay = document.getElementById('preview-overlay');

    // Only show preview for tap/swipe actions
    if (!this.currentAction || !['tap', 'swipe'].includes(this.currentAction.type)) {
      previewSection.style.display = 'none';
      return;
    }

    previewSection.style.display = 'block';

    // Clear previous markers
    previewOverlay.innerHTML = '';

    // Add markers based on action type
    if (this.currentAction.type === 'tap') {
      const marker = this._createMarker(this.currentAction.x, this.currentAction.y, 'tap');
      previewOverlay.appendChild(marker);
    } else if (this.currentAction.type === 'swipe') {
      const line = this._createLine(
        this.currentAction.x1,
        this.currentAction.y1,
        this.currentAction.x2,
        this.currentAction.y2
      );
      previewOverlay.appendChild(line);
    }
  }

  /**
   * Create marker element for preview
   */
  _createMarker(x, y, type) {
    const marker = document.createElement('div');
    marker.className = `preview-marker type-${type}`;
    marker.style.left = `${x}%`;
    marker.style.top = `${y}%`;
    return marker;
  }

  /**
   * Create line element for swipe preview
   */
  _createLine(x1, y1, x2, y2) {
    const line = document.createElement('div');
    line.className = 'preview-line';

    // Calculate line position and rotation
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    line.style.left = `${x1}%`;
    line.style.top = `${y1}%`;
    line.style.width = `${length}%`;
    line.style.transform = `rotate(${angle}deg)`;

    return line;
  }

  /**
   * Apply changes to action
   */
  applyChanges() {
    if (this.currentActionIndex === -1 || !this.currentAction) return;

    this.log.info('Applying changes', { type: this.currentAction.type });

    // Update action in store
    this.actionStore.updateAction(this.currentActionIndex, this.currentAction);

    // Clear selection
    this.currentAction = null;
    this.currentActionIndex = -1;

    // Render empty state
    this._renderEmptyState();

    alert('변경사항이 적용되었습니다.');
  }

  /**
   * Cancel editing
   */
  cancelEdit() {
    this.log.debug('Canceling edit');

    this.currentAction = null;
    this.currentActionIndex = -1;

    this._renderEmptyState();
  }

  /**
   * Test action (execute individually)
   */
  async testAction() {
    if (!this.currentAction) return;

    this.log.info('Testing action', { type: this.currentAction.type });

    try {
      // Execute via ActionPanel
      const result = await this.editor.actionPanel._executeAction(this.currentAction);

      if (result.success) {
        this.log.success('Action test succeeded');
        alert('액션 테스트 성공!');
      } else {
        this.log.warning('Action test failed', { error: result.error });
        alert('액션 테스트 실패: ' + result.error);
      }
    } catch (error) {
      this.log.error('Test action error', { error: error.message });
      alert('액션 테스트 중 오류가 발생했습니다.');
    }
  }
}

// Expose globally
window.PropertiesPanel = PropertiesPanel;
