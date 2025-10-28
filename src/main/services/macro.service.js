/**
 * Macro Service - 매크로 저장/불러오기 및 실행 관리
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const { MACRO_STATE } = require('../../shared/constants');

class MacroService extends EventEmitter {
  constructor() {
    super();
    this.macrosDir = path.join(app.getPath('userData'), 'macros');
    this.currentMacro = null;
    this.executionState = MACRO_STATE.IDLE;
    this.recordingState = {
      isRecording: false,
      actions: [],
      startTime: null
    };
    this._initialized = false;
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // 매크로 디렉토리 생성
      await fs.mkdir(this.macrosDir, { recursive: true });

      // 기존 매크로 로드
      await this._loadMacrosMetadata();

      this._initialized = true;
      console.log('Macro service initialized');
    } catch (error) {
      console.error('Failed to initialize macro service:', error);
      throw error;
    }
  }

  /**
   * 서비스 정리
   */
  async cleanup() {
    this.currentMacro = null;
    this.executionState = MACRO_STATE.IDLE;
    this.recordingState = {
      isRecording: false,
      actions: [],
      startTime: null
    };
    this._initialized = false;
  }

  /**
   * 매크로 메타데이터 로드
   */
  async _loadMacrosMetadata() {
    try {
      const metadataPath = path.join(this.macrosDir, 'metadata.json');

      try {
        const data = await fs.readFile(metadataPath, 'utf8');
        this.macrosMetadata = JSON.parse(data);
      } catch {
        // 메타데이터 파일이 없으면 새로 생성
        this.macrosMetadata = {
          version: '2.0.0',
          macros: [],
          lastModified: new Date().toISOString()
        };
        await this._saveMetadata();
      }
    } catch (error) {
      console.error('Failed to load macros metadata:', error);
      this.macrosMetadata = {
        version: '2.0.0',
        macros: [],
        lastModified: new Date().toISOString()
      };
    }
  }

  /**
   * 메타데이터 저장
   */
  async _saveMetadata() {
    const metadataPath = path.join(this.macrosDir, 'metadata.json');
    this.macrosMetadata.lastModified = new Date().toISOString();

    await fs.writeFile(
      metadataPath,
      JSON.stringify(this.macrosMetadata, null, 2)
    );
  }

  /**
   * 매크로 목록 가져오기
   */
  async listMacros() {
    await this._loadMacrosMetadata();
    return this.macrosMetadata.macros || [];
  }

  /**
   * 매크로 생성
   */
  async createMacro(macroData) {
    try {
      const macro = {
        id: `macro_${Date.now()}`,
        name: macroData.name,
        description: macroData.description || '',
        tags: macroData.tags || [],
        actions: macroData.actions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executionCount: 0,
        lastExecuted: null,
        settings: {
          loop: false,
          loopCount: 1,
          actionDelay: 100,
          stopOnError: true,
          ...macroData.settings
        }
      };

      // 매크로 파일 저장
      const filePath = path.join(this.macrosDir, `${macro.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(macro, null, 2));

      // 메타데이터 업데이트
      this.macrosMetadata.macros.push({
        id: macro.id,
        name: macro.name,
        description: macro.description,
        tags: macro.tags,
        createdAt: macro.createdAt,
        updatedAt: macro.updatedAt,
        executionCount: macro.executionCount,
        actionCount: macro.actions.length
      });
      await this._saveMetadata();

      this.emit('macro-created', macro);

      return macro;
    } catch (error) {
      console.error('Failed to create macro:', error);
      throw error;
    }
  }

  /**
   * 매크로 로드
   */
  async loadMacro(macroId) {
    try {
      const filePath = path.join(this.macrosDir, `${macroId}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const macro = JSON.parse(data);

      this.currentMacro = macro;
      this.emit('macro-loaded', macro);

      return macro;
    } catch (error) {
      console.error('Failed to load macro:', error);
      throw error;
    }
  }

  /**
   * 매크로 저장
   */
  async saveMacro(macro) {
    try {
      macro.updatedAt = new Date().toISOString();

      // 매크로 파일 저장
      const filePath = path.join(this.macrosDir, `${macro.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(macro, null, 2));

      // 메타데이터 업데이트
      const index = this.macrosMetadata.macros.findIndex(m => m.id === macro.id);
      if (index >= 0) {
        this.macrosMetadata.macros[index] = {
          id: macro.id,
          name: macro.name,
          description: macro.description,
          tags: macro.tags,
          createdAt: macro.createdAt,
          updatedAt: macro.updatedAt,
          executionCount: macro.executionCount,
          actionCount: macro.actions.length
        };
      } else {
        // 새 매크로 추가
        this.macrosMetadata.macros.push({
          id: macro.id,
          name: macro.name,
          description: macro.description,
          tags: macro.tags,
          createdAt: macro.createdAt,
          updatedAt: macro.updatedAt,
          executionCount: macro.executionCount || 0,
          actionCount: macro.actions.length
        });
      }
      await this._saveMetadata();

      this.emit('macro-saved', macro);

      return macro;
    } catch (error) {
      console.error('Failed to save macro:', error);
      throw error;
    }
  }

  /**
   * 매크로 삭제
   */
  async deleteMacro(macroId) {
    try {
      // 파일 삭제
      const filePath = path.join(this.macrosDir, `${macroId}.json`);
      await fs.unlink(filePath);

      // 메타데이터에서 제거
      this.macrosMetadata.macros = this.macrosMetadata.macros.filter(
        m => m.id !== macroId
      );
      await this._saveMetadata();

      if (this.currentMacro && this.currentMacro.id === macroId) {
        this.currentMacro = null;
      }

      this.emit('macro-deleted', macroId);

      return true;
    } catch (error) {
      console.error('Failed to delete macro:', error);
      throw error;
    }
  }

  /**
   * 매크로 복제
   */
  async duplicateMacro(macroId) {
    try {
      const original = await this.loadMacro(macroId);

      const duplicated = {
        ...original,
        id: `macro_${Date.now()}`,
        name: `${original.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executionCount: 0,
        lastExecuted: null
      };

      return await this.createMacro(duplicated);
    } catch (error) {
      console.error('Failed to duplicate macro:', error);
      throw error;
    }
  }

  /**
   * 매크로 가져오기
   */
  async importMacro(importPath) {
    try {
      const data = await fs.readFile(importPath, 'utf8');
      const importedData = JSON.parse(data);

      // 버전 확인
      if (!importedData.version || !importedData.macro) {
        throw new Error('Invalid macro file format');
      }

      const macro = {
        ...importedData.macro,
        id: `macro_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executionCount: 0,
        lastExecuted: null
      };

      return await this.createMacro(macro);
    } catch (error) {
      console.error('Failed to import macro:', error);
      throw error;
    }
  }

  /**
   * 매크로 내보내기
   */
  async exportMacro(macroId, exportPath) {
    try {
      const macro = await this.loadMacro(macroId);

      const exportData = {
        version: '2.0.0',
        exported: new Date().toISOString(),
        macro: {
          ...macro,
          id: undefined // ID 제거
        }
      };

      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

      return exportPath;
    } catch (error) {
      console.error('Failed to export macro:', error);
      throw error;
    }
  }

  /**
   * 실행 상태 설정
   */
  setExecutionState(state) {
    if (!Object.values(MACRO_STATE).includes(state)) {
      throw new Error(`Invalid execution state: ${state}`);
    }

    this.executionState = state;
    this.emit('state-changed', state);
  }

  /**
   * 실행 상태 가져오기
   */
  getExecutionState() {
    return this.executionState;
  }

  /**
   * 녹화 시작
   */
  async startRecording() {
    if (this.recordingState.isRecording) {
      throw new Error('Recording already in progress');
    }

    this.recordingState = {
      isRecording: true,
      actions: [],
      startTime: Date.now()
    };

    this.emit('recording-started');

    return true;
  }

  /**
   * 녹화 중지
   */
  async stopRecording() {
    if (!this.recordingState.isRecording) {
      throw new Error('No recording in progress');
    }

    const actions = [...this.recordingState.actions];
    const duration = Date.now() - this.recordingState.startTime;

    this.recordingState = {
      isRecording: false,
      actions: [],
      startTime: null
    };

    this.emit('recording-stopped', { actions, duration });

    return actions;
  }

  /**
   * 녹화된 액션 추가
   */
  addRecordedAction(action) {
    if (!this.recordingState.isRecording) {
      return false;
    }

    const recordedAction = {
      ...action,
      timestamp: Date.now(),
      relativeTime: Date.now() - this.recordingState.startTime
    };

    this.recordingState.actions.push(recordedAction);
    this.emit('action-recorded', recordedAction);

    return true;
  }

  /**
   * 매크로 검색
   */
  async searchMacros(query) {
    const macros = await this.listMacros();

    if (!query) {
      return macros;
    }

    const lowerQuery = query.toLowerCase();

    return macros.filter(macro =>
      macro.name.toLowerCase().includes(lowerQuery) ||
      macro.description?.toLowerCase().includes(lowerQuery) ||
      macro.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 태그별 매크로 가져오기
   */
  async getMacrosByTag(tag) {
    const macros = await this.listMacros();
    return macros.filter(macro => macro.tags?.includes(tag));
  }

  /**
   * 매크로 통계
   */
  async getMacroStats(macroId) {
    try {
      const macro = await this.loadMacro(macroId);

      return {
        id: macro.id,
        name: macro.name,
        actionCount: macro.actions.length,
        executionCount: macro.executionCount || 0,
        lastExecuted: macro.lastExecuted,
        createdAt: macro.createdAt,
        updatedAt: macro.updatedAt,
        estimatedDuration: this._estimateDuration(macro.actions)
      };
    } catch (error) {
      console.error('Failed to get macro stats:', error);
      return null;
    }
  }

  /**
   * 실행 시간 추정
   */
  _estimateDuration(actions) {
    let totalDuration = 0;

    for (const action of actions) {
      if (!action.enabled) continue;

      switch (action.type) {
        case 'tap':
          totalDuration += action.params?.duration || 100;
          break;
        case 'swipe':
          totalDuration += action.params?.duration || 300;
          break;
        case 'wait':
          totalDuration += action.params?.duration || 1000;
          break;
        case 'input':
          totalDuration += (action.params?.text?.length || 0) * 50;
          break;
        default:
          totalDuration += 100; // 기본 지연
      }
    }

    return totalDuration;
  }

  /**
   * 매크로 실행 기록 업데이트
   */
  async updateExecutionRecord(macroId) {
    try {
      const macro = await this.loadMacro(macroId);

      macro.executionCount = (macro.executionCount || 0) + 1;
      macro.lastExecuted = new Date().toISOString();

      await this.saveMacro(macro);
    } catch (error) {
      console.error('Failed to update execution record:', error);
    }
  }

  /**
   * 캐시 클리어
   */
  async clearCache() {
    this.macrosMetadata = null;
    await this._loadMacrosMetadata();
    return true;
  }

  /**
   * 백업 생성
   */
  async createBackup() {
    try {
      const backupDir = path.join(app.getPath('documents'), 'VisionAuto', 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `backup_${timestamp}`);

      await fs.mkdir(backupPath);

      // 모든 매크로 복사
      const files = await fs.readdir(this.macrosDir);

      for (const file of files) {
        const sourcePath = path.join(this.macrosDir, file);
        const destPath = path.join(backupPath, file);

        const data = await fs.readFile(sourcePath);
        await fs.writeFile(destPath, data);
      }

      return backupPath;
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * 백업 복원
   */
  async restoreBackup(backupPath) {
    try {
      // 기존 매크로 백업
      await this.createBackup();

      // 백업에서 복원
      const files = await fs.readdir(backupPath);

      for (const file of files) {
        const sourcePath = path.join(backupPath, file);
        const destPath = path.join(this.macrosDir, file);

        const data = await fs.readFile(sourcePath);
        await fs.writeFile(destPath, data);
      }

      // 메타데이터 다시 로드
      await this._loadMacrosMetadata();

      return true;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * 디버깅용 상태 반환
   */
  getState() {
    return {
      initialized: this._initialized,
      currentMacroId: this.currentMacro?.id || null,
      executionState: this.executionState,
      isRecording: this.recordingState.isRecording,
      recordedActions: this.recordingState.actions.length,
      macroCount: this.macrosMetadata?.macros?.length || 0
    };
  }
}

// 싱글톤 인스턴스 내보내기
module.exports = new MacroService();