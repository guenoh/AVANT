/**
 * Timeline Editor
 * 중앙 타임라인 에디터 - 액션 시퀀스 관리
 */

class TimelineEditor {
  constructor(actionStore, editor) {
    this.actionStore = actionStore;
    this.editor = editor;

    this.container = null;
    this.selectedActionIndex = -1;
    this.executingActionIndex = -1;

    // Action type metadata
    this.actionTypes = {
      tap: { icon: '🖱️', label: '탭', color: '#2563eb' },
      swipe: { icon: '👆', label: '스와이프', color: '#8b5cf6' },
      scroll: { icon: '📜', label: '스크롤', color: '#3b82f6' },
      input: { icon: '⌨️', label: '입력', color: '#10b981' },
      wait: { icon: '⏱️', label: '대기', color: '#f59e0b' },
      image: { icon: '🖼️', label: '이미지 매칭', color: '#ec4899' },
      key: { icon: '🔑', label: '키', color: '#6b7280' },
      screenshot: { icon: '📸', label: '스크린샷', color: '#14b8a6' },
    };
  }

  /**
   * Initialize editor
   */
  init() {
    this.container = document.getElementById('timeline-container');

    // Subscribe to action store changes
    this.actionStore.subscribe((event) => {
      if (event.type === 'state-change') {
        this.render();

        // Update executing index
        if (event.changes.executingActionIndex !== undefined) {
          this.executingActionIndex = event.changes.executingActionIndex;
          this._highlightExecutingAction();
        }
      }
    });

    console.log('[TimelineEditor] Initialized');
  }

  /**
   * Render timeline
   */
  render() {
    const actions = this.actionStore.get('actions');

    if (actions.length === 0) {
      this._renderEmptyState();
      return;
    }

    this.container.innerHTML = actions.map((action, index) =>
      this._renderActionCard(action, index)
    ).join('');

    // Attach event listeners
    this._attachEventListeners();

    // Highlight selected action
    if (this.selectedActionIndex >= 0) {
      this._highlightSelectedAction();
    }
  }

  /**
   * Render empty state
   */
  _renderEmptyState() {
    this.container.innerHTML = `
      <div class="timeline-empty">
        <div class="empty-icon">🎬</div>
        <div class="empty-title">액션이 없습니다</div>
        <div class="empty-description">
          아래 버튼을 클릭하거나<br>
          화면을 클릭하여 액션을 추가하세요
        </div>
        <button class="toolbar-btn btn-primary" onclick="timelineEditor.showAddActionModal()" style="margin-top: 16px;">
          <span class="btn-icon">➕</span>
          <span>액션 추가</span>
        </button>
      </div>
    `;
  }

  /**
   * Render action card
   */
  _renderActionCard(action, index) {
    const meta = this.actionTypes[action.type] || { icon: '❓', label: action.type, color: '#666' };
    const isSelected = this.selectedActionIndex === index;
    const isExecuting = this.executingActionIndex === index;

    // Build description based on action type
    const description = this._getActionDescription(action);

    // Build parameters display
    const params = this._getActionParams(action);

    return `
      <div class="action-card ${isSelected ? 'selected' : ''} ${isExecuting ? 'executing' : ''}"
           data-index="${index}"
           data-type="${action.type}">
        <div class="action-drag-handle">⋮⋮</div>

        <div class="action-index">${index + 1}</div>

        <div class="action-icon type-${action.type}">
          ${meta.icon}
        </div>

        <div class="action-content">
          <div class="action-title">
            <span>${meta.label}</span>
            <span class="action-type-badge">${action.type}</span>
          </div>
          <div class="action-description">${description}</div>
          ${params.length > 0 ? `
            <div class="action-params">
              ${params.map(p => `
                <div class="action-param">
                  <span class="param-key">${p.key}:</span>
                  <span class="param-value">${p.value}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="action-actions">
          <button class="action-action-btn" data-action="edit" title="편집">
            ✏️
          </button>
          <button class="action-action-btn btn-danger" data-action="delete" title="삭제">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get action description
   */
  _getActionDescription(action) {
    switch (action.type) {
      case 'tap':
        return `좌표 (${action.x}, ${action.y})를 터치`;
      case 'swipe':
        return `(${action.x1}, ${action.y1})에서 (${action.x2}, ${action.y2})로 스와이프`;
      case 'scroll':
        return `${action.direction || 'down'} 방향으로 ${action.distance || 600}px 스크롤`;
      case 'input':
        return `"${action.text}" 입력`;
      case 'wait':
        return `${action.duration}ms 대기`;
      case 'image':
        return action.imagePath ? `이미지 매칭: ${action.imagePath.split('/').pop()}` : '이미지 매칭';
      case 'key':
        return `${action.keyCode || 'BACK'} 키 입력`;
      case 'screenshot':
        return '스크린샷 캡처';
      default:
        return action.type;
    }
  }

  /**
   * Get action parameters for display
   */
  _getActionParams(action) {
    const params = [];

    switch (action.type) {
      case 'tap':
        params.push({ key: 'x', value: action.x });
        params.push({ key: 'y', value: action.y });
        break;
      case 'swipe':
        params.push({ key: '시작', value: `(${action.x1}, ${action.y1})` });
        params.push({ key: '끝', value: `(${action.x2}, ${action.y2})` });
        if (action.duration) params.push({ key: '시간', value: `${action.duration}ms` });
        break;
      case 'scroll':
        params.push({ key: '방향', value: action.direction || 'down' });
        params.push({ key: '거리', value: `${action.distance || 600}px` });
        break;
      case 'input':
        params.push({ key: '텍스트', value: action.text });
        break;
      case 'wait':
        params.push({ key: '시간', value: `${action.duration}ms` });
        break;
      case 'image':
        if (action.threshold) params.push({ key: '임계값', value: action.threshold });
        break;
      case 'key':
        params.push({ key: '키', value: action.keyCode || 'BACK' });
        break;
    }

    return params;
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    this.container.querySelectorAll('.action-card').forEach(card => {
      // Click to select
      card.addEventListener('click', (e) => {
        if (e.target.closest('.action-action-btn')) return;

        const index = parseInt(card.dataset.index);
        this.selectAction(index);
      });

      // Action buttons
      card.querySelectorAll('.action-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();

          const index = parseInt(card.dataset.index);
          const action = btn.dataset.action;

          switch (action) {
            case 'edit':
              this.editAction(index);
              break;
            case 'delete':
              this.deleteAction(index);
              break;
          }
        });
      });
    });
  }

  /**
   * Select an action
   */
  selectAction(index) {
    this.selectedActionIndex = index;
    const action = this.actionStore.getAction(index);

    if (action) {
      console.log('[TimelineEditor] Selected action:', index, action.type);

      // Dispatch event to properties panel
      document.dispatchEvent(new CustomEvent('action-selected', {
        detail: { action, index }
      }));

      // Re-render to update selection
      this.render();
    }
  }

  /**
   * Edit an action
   */
  editAction(index) {
    console.log('[TimelineEditor] Editing action:', index);
    this.selectAction(index);
  }

  /**
   * Delete an action
   */
  deleteAction(index) {
    if (!confirm('이 액션을 삭제하시겠습니까?')) return;

    console.log('[TimelineEditor] Deleting action:', index);
    this.actionStore.removeAction(index);

    // Clear selection if deleted action was selected
    if (this.selectedActionIndex === index) {
      this.selectedActionIndex = -1;
    } else if (this.selectedActionIndex > index) {
      this.selectedActionIndex--;
    }

    this.render();
  }

  /**
   * Delete selected action
   */
  deleteSelectedAction() {
    if (this.selectedActionIndex >= 0) {
      this.deleteAction(this.selectedActionIndex);
    }
  }

  /**
   * Clear all actions
   */
  clearAll() {
    if (this.actionStore.get('actions').length === 0) return;

    if (!confirm('모든 액션을 삭제하시겠습니까?')) return;

    console.log('[TimelineEditor] Clearing all actions');
    this.actionStore.clearActions();
    this.selectedActionIndex = -1;
    this.render();
  }

  /**
   * Highlight selected action
   */
  _highlightSelectedAction() {
    const cards = this.container.querySelectorAll('.action-card');
    cards.forEach(card => card.classList.remove('selected'));

    if (this.selectedActionIndex >= 0 && this.selectedActionIndex < cards.length) {
      const card = cards[this.selectedActionIndex];
      card.classList.add('selected');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Highlight executing action
   */
  _highlightExecutingAction() {
    const cards = this.container.querySelectorAll('.action-card');
    cards.forEach(card => card.classList.remove('executing'));

    if (this.executingActionIndex >= 0 && this.executingActionIndex < cards.length) {
      const card = cards[this.executingActionIndex];
      card.classList.add('executing');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Show add action modal
   */
  showAddActionModal() {
    // For now, show a simple menu
    const actionType = prompt(
      '액션 타입을 입력하세요:\n\n' +
      'tap - 터치\n' +
      'swipe - 스와이프\n' +
      'scroll - 스크롤\n' +
      'input - 입력\n' +
      'wait - 대기\n' +
      'image - 이미지 매칭\n' +
      'key - 키 입력',
      'tap'
    );

    if (!actionType) return;

    // Use existing ActionPanel to add action
    this.editor.actionPanel.addAction(actionType);
    this.render();
  }

  /**
   * Reorder action (for drag and drop)
   */
  reorderAction(fromIndex, toIndex) {
    const actions = this.actionStore.get('actions');
    const [movedAction] = actions.splice(fromIndex, 1);
    actions.splice(toIndex, 0, movedAction);

    this.actionStore.setActions(actions);
    console.log('[TimelineEditor] Reordered action from', fromIndex, 'to', toIndex);
  }
}

// Expose globally
window.TimelineEditor = TimelineEditor;
