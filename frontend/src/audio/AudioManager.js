/**
 * AudioManager — 全局音频控制器（单例）
 * 管理背景音乐、环境音的播放/暂停/切换。
 *
 * 三层音频架构：
 *   1. 背景音乐 (BGM) — 全局循环音乐
 *   2. 环境音 (Ambience) — 主环境音 + 四方向渐变环境音
 *   3. 互动触发音 (Trigger) — 点击互动点触发的一次性音效
 *
 * 浏览器策略要求 AudioContext 必须由用户手势触发后才能恢复，
 * 所以 init() 必须在点击/触摸事件中被调用。
 */

class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.bgmAudio = null;
    this.bgmGain = null;
    this.bgmPlaying = false;
    this.bgmVolume = this.loadVolume('bgmVolume', 0.5);

    // 主环境音（始终播放的背景层）
    this.mainAmbience = null;      // { audio, gain }
    this.mainAmbienceVolume = this.loadVolume('mainAmbienceVolume', 0.6);

    // 方向环境音（4方向，带渐变过渡）
    this.directionalAmbiences = {}; // sector → { audio, gain, file, targetGain }
    this.ambienceVolume = this.loadVolume('ambienceVolume', 0.7);
    this.crossfadeDuration = 1.5;   // 渐变过渡时间（秒）

    this.initialized = false;
    this._rafId = null;             // 渐变动画帧 ID
    this._crossfading = false;
  }

  /** 从 localStorage 加载音量 */
  loadVolume(key, defaultValue) {
    try {
      const stored = localStorage.getItem('the-moment-' + key);
      if (stored !== null) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val >= 0 && val <= 1) return val;
      }
    } catch (_) { /* ignore */ }
    return defaultValue;
  }

  /** 保存音量到 localStorage */
  saveVolume(key, value) {
    try {
      localStorage.setItem('the-moment-' + key, String(value));
    } catch (_) { /* ignore */ }
  }

  /** 初始化 AudioContext（必须由用户手势触发） */
  init() {
    if (this.initialized) {
      // 即使已初始化，也尝试恢复（处理浏览器自动播放策略）
      this._ensureResumed();
      return;
    }
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.bgmGain = this.audioCtx.createGain();
    this.bgmGain.gain.value = this.bgmVolume;
    this.bgmGain.connect(this.audioCtx.destination);

    // 主环境音增益节点
    this.mainAmbienceGain = this.audioCtx.createGain();
    this.mainAmbienceGain.gain.value = this.mainAmbienceVolume;
    this.mainAmbienceGain.connect(this.audioCtx.destination);

    this.initialized = true;

    // 处理浏览器自动播放策略：如果 AudioContext 被挂起，尝试恢复
    this._ensureResumed();
  }

  /** 确保 AudioContext 不处于 suspended 状态 */
  _ensureResumed() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        console.log('✅ AudioContext 已恢复');
      }).catch(err => {
        console.warn('⚠️ AudioContext 恢复失败:', err);
      });
    }
  }

  // ==================== 背景音乐 ====================

  /**
   * 安全创建 Audio 对象（带错误处理）
   * 返回 null 表示路径无效
   */
  _createAudio(path, loop = false) {
    if (!path || typeof path !== 'string' || path.trim() === '') {
      console.warn('⚠️ 音频路径为空，跳过');
      return null;
    }
    try {
      const audio = new Audio(path);
      audio.loop = loop;
      audio.crossOrigin = 'anonymous';
      // 监听错误以防崩溃
      audio.addEventListener('error', () => {
        console.warn('⚠️ 音频加载失败（文件可能不存在）:', path.substring(0, 50));
        audio._loadFailed = true;
      });
      return audio;
    } catch (err) {
      console.warn('⚠️ 创建 Audio 失败:', err.message, path?.substring(0, 50));
      return null;
    }
  }

  /** 播放背景音乐 */
  playBGM(path) {
    if (!this.initialized) return;
    this._ensureResumed();
    this.stopBGM();

    const audio = this._createAudio(path, true);
    if (!audio) return;

    this.bgmAudio = audio;
    this.bgmAudio.volume = this.bgmVolume;

    try {
      const source = this.audioCtx.createMediaElementSource(this.bgmAudio);
      source.connect(this.bgmGain);
    } catch (err) {
      console.warn('Failed to connect audio source:', err);
    }

    this.bgmAudio.play().then(() => {
      this.bgmPlaying = true;
      console.log('✅ BGM 正在播放:', path ? path.substring(0, 50) : 'unknown');
    }).catch(err => {
      console.error('❌ BGM play failed:', err);
    });
  }

  pauseBGM() {
    if (!this.bgmAudio) return;
    this.bgmAudio.pause();
    this.bgmPlaying = false;
  }

  resumeBGM() {
    if (!this.bgmAudio) return;
    this.bgmAudio.play().then(() => {
      this.bgmPlaying = true;
    }).catch(() => {
      console.warn('BGM resume failed');
    });
  }

  toggleBGM() {
    if (this.bgmPlaying) {
      this.pauseBGM();
    } else {
      this.resumeBGM();
    }
    return this.bgmPlaying;
  }

  stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.bgmAudio = null;
    }
    this.bgmPlaying = false;
  }

  setBGMVolume(level) {
    this.bgmVolume = Math.max(0, Math.min(1, level));
    this.saveVolume('bgmVolume', this.bgmVolume);
    if (this.bgmGain) {
      this.bgmGain.gain.value = this.bgmVolume;
    }
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.bgmVolume;
    }
  }

  // ==================== 主环境音（始终播放的背景层） ====================

  /**
   * 播放主环境音（全局背景层，不受方向影响）
   * @param {string} path - 音频文件路径
   */
  playMainAmbience(path) {
    if (!this.initialized) return;
    this._ensureResumed();
    this.stopMainAmbience();

    const audio = this._createAudio(path, true);
    if (!audio) return;
    audio.volume = this.mainAmbienceVolume;

    const gain = this.audioCtx.createGain();
    gain.gain.value = this.mainAmbienceVolume;
    gain.connect(this.mainAmbienceGain);

    try {
      const source = this.audioCtx.createMediaElementSource(audio);
      source.connect(gain);
    } catch (err) {
      console.warn('Failed to connect main ambience:', err);
    }

    audio.play().then(() => {
      console.log('✅ 主环境音已播放');
    }).catch(err => {
      console.error('❌ 主环境音播放失败:', err);
    });

    this.mainAmbience = { audio, gain };
  }

  stopMainAmbience() {
    if (!this.mainAmbience) return;
    this.mainAmbience.audio.pause();
    this.mainAmbience.audio.currentTime = 0;
    this.mainAmbience = null;
  }

  /** 设置主环境音音量 */
  setMainAmbienceVolume(level) {
    this.mainAmbienceVolume = Math.max(0, Math.min(1, level));
    this.saveVolume('mainAmbienceVolume', this.mainAmbienceVolume);
    if (this.mainAmbience?.gain) {
      this.mainAmbience.gain.gain.value = this.mainAmbienceVolume;
    }
    if (this.mainAmbience?.audio) {
      this.mainAmbience.audio.volume = this.mainAmbienceVolume;
    }
  }

  // ==================== 方向环境音（带渐变过渡） ====================

  /**
   * 确保方向环境音已加载（不自动播放，由渐变系统控制）
   * @param {string} sector - 方向: north/east/south/west
   * @param {string} file - 音频文件路径
   */
  loadDirectionalAmbience(sector, file) {
    if (!this.initialized) return;
    this._ensureResumed();

    // 如果已经加载了同一文件，跳过
    const existing = this.directionalAmbiences[sector];
    if (existing && existing.file === file) return;

    // 停止旧的
    if (existing) {
      existing.audio.pause();
      existing.audio.currentTime = 0;
    }

    const audio = this._createAudio(file, true);
    if (!audio) return;
    audio.volume = 0; // 初始静音，由渐变系统控制

    const gain = this.audioCtx.createGain();
    gain.gain.value = 0; // 从 0 开始，等待渐变
    gain.connect(this.audioCtx.destination);

    try {
      const source = this.audioCtx.createMediaElementSource(audio);
      source.connect(gain);
    } catch (err) {
      console.warn('Failed to connect directional ambience:', err);
    }

    audio.play().then(() => {
      console.log(`✅ 方向环境音已加载 [${sector}]:`, file.substring(0, 40));
    }).catch(err => {
      console.error(`❌ 方向环境音加载失败 [${sector}]:`, err);
    });

    this.directionalAmbiences[sector] = { audio, gain, file, targetGain: 0 };
  }

  /**
   * 设置方向环境音的目标音量（触发渐变过渡）
   * @param {string} sector - 方向
   * @param {number} targetLevel - 目标音量 0-1
   */
  setDirectionalTarget(sector, targetLevel) {
    const entry = this.directionalAmbiences[sector];
    if (!entry) return;
    entry.targetGain = Math.max(0, Math.min(1, targetLevel)) * this.ambienceVolume;
  }

  /**
   * 更新所有方向环境音的渐变（每帧调用）
   * @param {number} deltaTime - 帧间隔时间（秒）
   */
  updateCrossfade(deltaTime) {
    let anyAnimating = false;
    const step = deltaTime / (this.crossfadeDuration || 1.5);

    Object.entries(this.directionalAmbiences).forEach(([sector, entry]) => {
      if (!entry.gain) return;
      const current = entry.gain.gain.value;
      const target = entry.targetGain || 0;
      if (Math.abs(current - target) < 0.001) return;

      const newVal = current + (target - current) * Math.min(step * 3, 1);
      entry.gain.gain.value = newVal;
      entry.audio.volume = newVal;

      if (Math.abs(newVal - target) > 0.001) {
        anyAnimating = true;
      }
    });

    if (!anyAnimating && this._crossfading) {
      this._crossfading = false;
    }
    return anyAnimating;
  }

  /** 停止所有方向环境音 */
  stopAllDirectionalAmbiences() {
    Object.values(this.directionalAmbiences).forEach(entry => {
      entry.audio.pause();
      entry.audio.currentTime = 0;
    });
    this.directionalAmbiences = {};
  }

  /** 设置方向环境音总音量 */
  setAmbienceVolume(level) {
    this.ambienceVolume = Math.max(0, Math.min(1, level));
    this.saveVolume('ambienceVolume', this.ambienceVolume);
  }

  // ==================== 互动触发音（一次性音效） ====================

  /**
   * 播放一次性触发音效（点击互动点时使用）
   * @param {string} path - 音频文件路径
   * @param {number} volume - 音量 0-1，默认 0.8
   * @returns {Promise} 播放完成的 Promise
   */
  playTriggerSound(path, volume = 0.8) {
    if (!this.initialized) return Promise.resolve();
    this._ensureResumed();

    if (!path) return Promise.resolve();

    return new Promise((resolve) => {
      const audio = this._createAudio(path, false);
      if (!audio) { resolve(); return; }
      audio.volume = Math.max(0, Math.min(1, volume));

      const gain = this.audioCtx.createGain();
      gain.gain.value = volume;
      gain.connect(this.audioCtx.destination);

      try {
        const source = this.audioCtx.createMediaElementSource(audio);
        source.connect(gain);
      } catch (err) {
        // MediaElementAudioSourceNode 可能已存在
      }

      audio.addEventListener('ended', () => {
        resolve();
      });

      audio.addEventListener('error', () => {
        console.warn('触发音播放失败:', path);
        resolve();
      });

      audio.play().then(() => {
        console.log('🔔 触发音播放:', path.substring(0, 40));
      }).catch(err => {
        console.warn('触发音播放失败:', err);
        resolve();
      });
    });
  }

  // ==================== 清理 ====================

  destroy() {
    this.stopBGM();
    this.stopMainAmbience();
    this.stopAllDirectionalAmbiences();
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.initialized = false;
  }
}

export default new AudioManager();
