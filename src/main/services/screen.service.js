/**
 * Screen Service - 화면 캡처 및 스트리밍
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

const execAsync = promisify(exec);

class ScreenService extends EventEmitter {
  constructor() {
    super();
    this.deviceService = null;
    this.currentStream = null;
    this.frameBuffer = null;
    this.isRecording = false;
    this.recordingProcess = null;
    this._initialized = false;
    this.tempDir = path.join(app.getPath('temp'), 'vision-auto');
  }

  /**
   * 서비스 초기화
   */
  async initialize(deviceService) {
    if (this._initialized) return;

    this.deviceService = deviceService;

    // 임시 디렉토리 생성
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }

    this._initialized = true;
    console.log('Screen service initialized');
  }

  /**
   * 서비스 정리
   */
  async cleanup() {
    if (this.currentStream) {
      await this.stopStream();
    }

    if (this.isRecording) {
      await this.stopRecording();
    }

    // 임시 파일 정리 (디렉토리는 유지, 파일만 삭제)
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }
    } catch (error) {
      // 디렉토리가 없거나 파일이 없는 경우는 무시
      if (error.code !== 'ENOENT') {
        console.error('Failed to clean temp files:', error);
      }
    }

    this._initialized = false;
  }

  /**
   * ADB 명령 실행
   */
  async _execAdb(command) {
    if (!this.deviceService || !this.deviceService.currentDevice) {
      throw new Error('No device connected');
    }

    const adbPath = this.deviceService.adbPath;
    const deviceId = this.deviceService.currentDevice;
    const fullCommand = `${adbPath} -s ${deviceId} ${command}`;

    const { stdout } = await execAsync(fullCommand);
    return stdout;
  }

  /**
   * 화면 정보 가져오기
   */
  async getScreenInfo() {
    try {
      const [sizeOutput, densityOutput] = await Promise.all([
        this._execAdb('shell wm size'),
        this._execAdb('shell wm density')
      ]);

      const sizeMatch = sizeOutput.match(/Physical size: (\d+)x(\d+)/);
      const densityMatch = densityOutput.match(/Physical density: (\d+)/);

      const width = sizeMatch ? parseInt(sizeMatch[1]) : 1080;
      const height = sizeMatch ? parseInt(sizeMatch[2]) : 1920;
      const density = densityMatch ? parseInt(densityMatch[1]) : 420;

      // 화면 방향 확인
      const orientation = width > height ? 'landscape' : 'portrait';

      // 리프레시 레이트 가져오기 (Android 7.0+)
      let refreshRate = 60;
      try {
        const refreshOutput = await this._execAdb('shell dumpsys display | grep mRefreshRate');
        const refreshMatch = refreshOutput.match(/mRefreshRate=([\d.]+)/);
        if (refreshMatch) {
          refreshRate = parseFloat(refreshMatch[1]);
        }
      } catch {
        // 리프레시 레이트를 가져올 수 없으면 기본값 사용
      }

      return {
        width,
        height,
        density,
        orientation,
        refreshRate
      };
    } catch (error) {
      console.error('Failed to get screen info:', error);
      throw error;
    }
  }

  /**
   * 스크린샷 캡처
   */
  async takeScreenshot(options = {}) {
    try {
      const timestamp = Date.now();
      const tempPath = `/sdcard/screenshot_${timestamp}.png`;

      // 스크린샷 캡처
      await this._execAdb(`shell screencap -p ${tempPath}`);

      // 로컬로 복사
      const localPath = path.join(this.tempDir, `screenshot_${timestamp}.png`);
      await this._execAdb(`pull ${tempPath} "${localPath}"`);

      // 디바이스에서 임시 파일 삭제
      await this._execAdb(`shell rm ${tempPath}`);

      // 파일 읽기
      const buffer = await fs.readFile(localPath);

      // 옵션에 따라 저장 또는 삭제
      if (options.savePath) {
        await fs.copyFile(localPath, options.savePath);
      } else {
        await fs.unlink(localPath);
      }

      // 이미지 정보 가져오기
      const screenInfo = await this.getScreenInfo();

      return {
        buffer,
        width: screenInfo.width,
        height: screenInfo.height,
        path: options.savePath || null
      };
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      throw error;
    }
  }

  /**
   * 스트리밍 시작
   */
  async startStream(options = {}) {
    if (this.currentStream) {
      throw new Error('Stream already active');
    }

    try {
      const { quality = 'high', maxFps = 30, maxSize = 1280 } = options;

      // 품질 설정
      const bitrate = quality === 'high' ? 8000000 : quality === 'medium' ? 4000000 : 2000000;

      // scrcpy 또는 미러링 도구 사용
      // 여기서는 ADB의 screenrecord를 스트리밍으로 활용
      const streamId = `stream_${Date.now()}`;

      this.currentStream = {
        id: streamId,
        process: null,
        width: 0,
        height: 0,
        options: { quality, maxFps, maxSize, bitrate }
      };

      // 화면 정보 가져오기
      const screenInfo = await this.getScreenInfo();
      this.currentStream.width = screenInfo.width;
      this.currentStream.height = screenInfo.height;

      // 프레임 캡처 루프 시작 (실시간 스트리밍 대신 폴링 방식)
      this._startFrameCapture(maxFps);

      this.emit('stream-started', {
        id: streamId,
        width: screenInfo.width,
        height: screenInfo.height
      });

      return this.currentStream;
    } catch (error) {
      console.error('Failed to start stream:', error);
      this.currentStream = null;
      throw error;
    }
  }

  /**
   * 프레임 캡처 시작
   */
  _startFrameCapture(fps) {
    const interval = 1000 / fps;
    const { BrowserWindow } = require('electron');

    const captureFrame = async () => {
      if (!this.currentStream) return;

      try {
        // 매번 현재 활성 윈도우를 가져옴
        const mainWindow = BrowserWindow.getAllWindows()[0];

        // 윈도우가 없거나 파괴되었으면 중지
        if (!mainWindow || mainWindow.isDestroyed()) {
          console.log('Window destroyed, stopping stream');
          this.currentStream = null;
          return;
        }

        // 빠른 스크린샷 캡처
        const timestamp = Date.now();
        const tempPath = `/sdcard/frame_temp.png`;

        // PNG 포맷으로 캡처 (압축이 되어 있어서 전송이 빠름)
        await this._execAdb(`shell screencap -p ${tempPath}`);

        // 로컬로 복사
        const localPath = path.join(this.tempDir, `frame_${timestamp}.png`);
        await this._execAdb(`pull ${tempPath} "${localPath}"`);

        // 파일 읽기
        const buffer = await fs.readFile(localPath);

        // Base64로 인코딩하여 렌더러로 전송
        const base64Image = buffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        // 프레임 이벤트 발생 - 렌더러 프로세스로 전송
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('screen:stream:data', {
            dataUrl,
            width: this.currentStream.width,
            height: this.currentStream.height,
            timestamp
          });
        }

        // 프레임 버퍼 업데이트
        this.frameBuffer = {
          buffer,
          dataUrl,
          width: this.currentStream.width,
          height: this.currentStream.height,
          timestamp
        };

        this.emit('frame', this.frameBuffer);

        // 임시 파일 삭제
        await fs.unlink(localPath);
        await this._execAdb(`shell rm ${tempPath}`);

        // 메트릭 업데이트
        this.emit('metrics', {
          fps: fps,
          latency: Date.now() - timestamp,
          frameSize: buffer.length
        });
      } catch (error) {
        console.error('Frame capture error:', error);
        // 에러 발생시 스트림 중지
        if (error.message && error.message.includes('destroyed')) {
          this.currentStream = null;
        }
      }

      // 다음 프레임
      if (this.currentStream) {
        setTimeout(captureFrame, interval);
      }
    };

    // 첫 프레임 캡처 시작
    captureFrame();
  }

  /**
   * 스트리밍 중지
   */
  async stopStream() {
    if (!this.currentStream) {
      return false;
    }

    if (this.currentStream.process) {
      this.currentStream.process.kill();
    }

    this.currentStream = null;
    this.frameBuffer = null;

    this.emit('stream-stopped');

    return true;
  }

  /**
   * 현재 프레임 가져오기
   */
  async getCurrentFrame() {
    return this.frameBuffer;
  }

  /**
   * 화면 회전
   */
  async rotate(direction = 'right') {
    try {
      // 현재 방향 가져오기
      const rotationOutput = await this._execAdb('shell settings get system user_rotation');
      const currentRotation = parseInt(rotationOutput) || 0;

      // 새 방향 계산
      let newRotation;
      if (direction === 'right') {
        newRotation = (currentRotation + 1) % 4;
      } else if (direction === 'left') {
        newRotation = (currentRotation - 1 + 4) % 4;
      } else {
        newRotation = 0; // reset
      }

      // 화면 회전 설정
      await this._execAdb(`shell settings put system user_rotation ${newRotation}`);

      // 가속도계 비활성화 (수동 회전 유지)
      await this._execAdb('shell settings put system accelerometer_rotation 0');

      return true;
    } catch (error) {
      console.error('Failed to rotate screen:', error);
      throw error;
    }
  }

  /**
   * 화면 녹화 시작
   */
  async startRecording(options = {}) {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    try {
      const {
        outputPath = path.join(this.tempDir, `recording_${Date.now()}.mp4`),
        bitrate = 8000000,
        timeLimit = 180,
        size
      } = options;

      const devicePath = `/sdcard/recording_${Date.now()}.mp4`;

      // screenrecord 명령 구성
      let command = `shell screenrecord --bit-rate ${bitrate} --time-limit ${timeLimit}`;

      if (size) {
        command += ` --size ${size}`;
      }

      command += ` ${devicePath}`;

      // 녹화 시작 (백그라운드)
      const adbPath = this.deviceService.adbPath;
      const deviceId = this.deviceService.currentDevice;

      this.recordingProcess = spawn(adbPath, ['-s', deviceId, ...command.split(' ')]);

      this.isRecording = true;
      this.recordingInfo = {
        id: `recording_${Date.now()}`,
        devicePath,
        outputPath,
        startTime: Date.now()
      };

      // 프로세스 에러 처리
      this.recordingProcess.on('error', (error) => {
        console.error('Recording process error:', error);
        this.isRecording = false;
      });

      this.recordingProcess.on('exit', async (code) => {
        if (code !== 0 && this.isRecording) {
          console.error('Recording process exited with code:', code);
        }

        // 녹화 파일을 로컬로 복사
        if (this.isRecording) {
          try {
            await this._execAdb(`pull ${devicePath} "${outputPath}"`);
            await this._execAdb(`shell rm ${devicePath}`);
          } catch (error) {
            console.error('Failed to pull recording:', error);
          }
        }

        this.isRecording = false;
      });

      return this.recordingInfo;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * 화면 녹화 중지
   */
  async stopRecording() {
    if (!this.isRecording) {
      return null;
    }

    try {
      // 녹화 프로세스 종료
      if (this.recordingProcess) {
        this.recordingProcess.kill('SIGINT');
      }

      // 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 녹화 파일 가져오기
      const { devicePath, outputPath } = this.recordingInfo;

      try {
        await this._execAdb(`pull ${devicePath} "${outputPath}"`);
        await this._execAdb(`shell rm ${devicePath}`);
      } catch (error) {
        console.error('Failed to retrieve recording:', error);
      }

      // 파일 정보 확인
      const stats = await fs.stat(outputPath);
      const duration = Date.now() - this.recordingInfo.startTime;

      const result = {
        path: outputPath,
        duration: Math.floor(duration / 1000),
        size: stats.size
      };

      this.isRecording = false;
      this.recordingInfo = null;
      this.recordingProcess = null;

      return result;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * 이미지 찾기 (템플릿 매칭)
   */
  async findImage(templatePath, options = {}) {
    try {
      const { threshold = 0.95, region = null, multiple = false } = options;

      // 현재 화면 캡처
      const screenshot = await this.takeScreenshot();

      // OpenCV를 사용한 템플릿 매칭 (여기서는 간단한 구현)
      // 실제로는 opencv4nodejs 또는 다른 이미지 처리 라이브러리 사용
      const matches = [];

      // 임시로 더미 매치 반환
      if (Math.random() > 0.5) {
        matches.push({
          location: {
            x: 100,
            y: 200,
            width: 50,
            height: 50
          },
          confidence: 0.96
        });
      }

      return matches;
    } catch (error) {
      console.error('Failed to find image:', error);
      throw error;
    }
  }

  /**
   * 캐시 클리어
   */
  async clearCache() {
    try {
      const files = await fs.readdir(this.tempDir);

      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }

      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * 디버깅용 상태 반환
   */
  getState() {
    return {
      initialized: this._initialized,
      streaming: !!this.currentStream,
      recording: this.isRecording,
      tempDir: this.tempDir
    };
  }
}

// 싱글톤 인스턴스 내보내기
module.exports = new ScreenService();