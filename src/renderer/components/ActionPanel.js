/**
 * Action Panel Component - Handles action list UI and execution
 */

class ActionPanel {
  constructor(api, actionStore, screenPanel) {
    this.api = api;
    this.actionStore = actionStore;
    this.screenPanel = screenPanel;
    this.unsubscribe = null;
  }

  /**
   * Initialize component
   */
  init() {
    this._subscribeToStore();
  }

  /**
   * Subscribe to store changes
   */
  _subscribeToStore() {
    this.unsubscribe = this.actionStore.subscribe((event) => {
      this._handleStateChange(event);
    });
  }

  /**
   * Handle state changes
   */
  _handleStateChange(event) {
    const { changes } = event;

    if ('actions' in changes) {
      this._renderActionList();
    }

    if ('isExecuting' in changes) {
      this._updateExecutingUI(changes.isExecuting);
    }

    if ('executingActionIndex' in changes) {
      this._highlightCurrentAction(changes.executingActionIndex);
    }

    if ('isRecording' in changes) {
      this._updateRecordingUI(changes.isRecording);
    }
  }

  /**
   * Add action to list
   */
  addAction(type, params = {}) {
    const action = {
      type,
      ...params,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Set default parameters based on type
    switch (type) {
      case 'tap':
        action.x = params.x || 0;
        action.y = params.y || 0;
        break;
      case 'swipe':
        action.x1 = params.x1 || 0;
        action.y1 = params.y1 || 0;
        action.x2 = params.x2 || 0;
        action.y2 = params.y2 || 0;
        action.duration = params.duration || 300;
        break;
      case 'scroll':
        action.direction = params.direction || 'down';
        action.distance = params.distance || 300;
        break;
      case 'input':
        action.text = params.text || '';
        break;
      case 'wait':
        action.duration = params.duration || 1000;
        break;
      case 'screenshot':
        action.savePath = params.savePath || null;
        break;
    }

    this.actionStore.addAction(action);
    this._emitEvent('action-added', { action });
  }

  /**
   * Add scroll action with direction
   */
  addScrollAction(direction) {
    this.addAction('scroll', { direction, distance: 600 });
  }

  /**
   * Remove action by index
   */
  removeAction(index) {
    this.actionStore.removeAction(index);
    this._emitEvent('action-removed', { index });
  }

  /**
   * Clear all actions
   */
  clearActions() {
    this.actionStore.clearActions();
    this._emitEvent('actions-cleared');
  }

  /**
   * Update action parameters
   */
  updateAction(index, updates) {
    this.actionStore.updateAction(index, updates);
    this._emitEvent('action-updated', { index, updates });
  }

  /**
   * Execute all actions
   */
  async runActions() {
    try {
      const actions = this.actionStore.get('actions');

      if (actions.length === 0) {
        this._emitEvent('run-error', { error: '실행할 액션이 없습니다' });
        return { success: false };
      }

      this.actionStore.setExecuting(true, 0);
      this._emitEvent('run-start', { count: actions.length });

      const results = [];

      for (let i = 0; i < actions.length; i++) {
        this.actionStore.setExecutingActionIndex(i);

        const action = actions[i];
        const result = await this._executeAction(action);
        results.push(result);

        if (!result.success) {
          this._emitEvent('action-error', { index: i, error: result.error });
          // Continue execution even if one action fails
        }

        this._emitEvent('action-executed', { index: i, result });
      }

      this.actionStore.setExecuting(false, -1);
      this._emitEvent('run-complete', { results });

      return { success: true, results };
    } catch (error) {
      console.error('Failed to run actions:', error);
      this.actionStore.setExecuting(false, -1);
      this._emitEvent('run-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute single action
   */
  async _executeAction(action) {
    try {
      const result = await this.api.action.execute(action);
      return result;
    } catch (error) {
      console.error('Action execution error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start action recording
   */
  startRecording() {
    this.actionStore.setRecording(true);
    this._emitEvent('recording-started');
  }

  /**
   * Stop action recording
   */
  stopRecording() {
    this.actionStore.setRecording(false);
    this._emitEvent('recording-stopped');
  }

  /**
   * Toggle recording
   */
  toggleRecording() {
    const isRecording = this.actionStore.get('isRecording');
    if (isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  /**
   * Enter click mode for interactive action creation
   */
  enterClickMode(type) {
    this.actionStore.setClickMode(true, type);
    this._emitEvent('click-mode-entered', { type });
  }

  /**
   * Exit click mode
   */
  exitClickMode() {
    this.actionStore.setClickMode(false);
    this._emitEvent('click-mode-exited');
  }

  /**
   * Handle canvas click in click mode
   */
  handleCanvasClick(x, y) {
    const isClickMode = this.actionStore.get('isClickMode');
    const clickModeType = this.actionStore.get('clickModeType');

    if (!isClickMode) return;

    this.actionStore.addClickModePoint({ x, y });

    switch (clickModeType) {
      case 'tap':
        // Single click completes tap
        this.addAction('tap', { x, y });
        this.exitClickMode();
        break;

      case 'swipe':
        // Two clicks complete swipe
        const points = this.actionStore.get('clickModePoints');
        if (points.length === 2) {
          this.addAction('swipe', {
            x1: points[0].x,
            y1: points[0].y,
            x2: points[1].x,
            y2: points[1].y,
            duration: 300
          });
          this.exitClickMode();
        }
        break;
    }
  }

  /**
   * Render action list in UI
   */
  _renderActionList() {
    const actionListEl = document.getElementById('action-list');
    if (!actionListEl) return;

    const actions = this.actionStore.get('actions');

    if (actions.length === 0) {
      actionListEl.innerHTML = '<div class="empty-state">액션을 추가하세요</div>';
      return;
    }

    actionListEl.innerHTML = actions.map((action, index) => `
      <div class="action-item" data-action-index="${index}">
        <div class="action-header">
          <span class="action-number">${index + 1}</span>
          <span class="action-type">${this._getActionTypeLabel(action.type)}</span>
          <span class="action-params">${this._getActionParamsLabel(action)}</span>
        </div>
        <div class="action-controls">
          <button class="btn btn-xs btn-danger" onclick="ui.removeAction(${index})">삭제</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Get action type label for display
   */
  _getActionTypeLabel(type) {
    const labels = {
      tap: '탭',
      swipe: '스와이프',
      scroll: '스크롤',
      input: '입력',
      wait: '대기',
      screenshot: '스크린샷',
      key: '키 입력'
    };
    return labels[type] || type;
  }

  /**
   * Get action parameters label for display
   */
  _getActionParamsLabel(action) {
    switch (action.type) {
      case 'tap':
        return `(${action.x}, ${action.y})`;
      case 'swipe':
        return `(${action.x1}, ${action.y1}) → (${action.x2}, ${action.y2})`;
      case 'scroll':
        return `${action.direction} ${action.distance}px`;
      case 'input':
        return `"${action.text}"`;
      case 'wait':
        return `${action.duration}ms`;
      default:
        return '';
    }
  }

  /**
   * Update executing UI
   */
  _updateExecutingUI(isExecuting) {
    const runBtn = document.getElementById('run-actions-btn');
    if (runBtn) {
      runBtn.disabled = isExecuting;
      runBtn.textContent = isExecuting ? '실행 중...' : '액션 실행';
    }
  }

  /**
   * Highlight current executing action
   */
  _highlightCurrentAction(index) {
    // Remove highlight from all actions
    document.querySelectorAll('.action-item.executing').forEach(el => {
      el.classList.remove('executing');
    });

    // Add highlight to current action
    if (index >= 0) {
      const actionItem = document.querySelector(`[data-action-index="${index}"]`);
      if (actionItem) {
        actionItem.classList.add('executing');
        actionItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  /**
   * Update recording UI
   */
  _updateRecordingUI(isRecording) {
    const recordBtn = document.getElementById('record-actions-btn');
    if (recordBtn) {
      recordBtn.classList.toggle('recording', isRecording);
      recordBtn.textContent = isRecording ? '녹화 중지' : '액션 녹화';
    }
  }

  /**
   * Emit custom event
   */
  _emitEvent(eventName, detail = {}) {
    const event = new CustomEvent(`action-panel:${eventName}`, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Cleanup component
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Expose class globally
window.ActionPanel = ActionPanel;
