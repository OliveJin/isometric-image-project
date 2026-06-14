/**
 * AudioManager — 全局音频控制器（单例）
 * 管理背景音乐、环境音的播放/暂停/切换。
 *
 * 浏览器策略要求 AudioContext 必须由用户手势触发后才能恢复，
 * 所以 init() 必须在点击/触摸事件中被调用。
 */

class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.bgmAudio = null;
    this.bgmGain = null;
    this.ambiences = {};  // key: id → { audio, gain }
    this.bgmPlaying = false;
    this.bgmVolume = this.loadVolume('bgmVolume', 0.5);
    this.ambienceVolume = this.loadVolume('ambienceVolume', 0.7);
    this.initialized = false;
  }

  /** 从 localStorage 加载音量，不存在则使用默认值 */
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
    if (this.initialized) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.bgmGain = this.audioCtx.createGain();
    this.bgmGain.gain.value = this.bgmVolume;
    this.bgmGain.connect(this.audioCtx.destination);
    this.initialized = true;
  }

  // ==================== 背景音乐 ====================

  /** 播放背景音乐，path 为 public 目录下的相对路径或 DataURL */
  playBGM(path) {
    if (!this.initialized) return;
    this.stopBGM();

    this.bgmAudio = new Audio(path);
    this.bgmAudio.loop = true;
    this.bgmAudio.crossOrigin = 'anonymous';
    // ✅ 修复：设置正确的初始音量，而不是 0
    this.bgmAudio.volume = this.bgmVolume;

    try {
      const source = this.audioCtx.createMediaElementSource(this.bgmAudio);
      source.connect(this.bgmGain);
    } catch (err) {
      console.warn('Failed to connect audio source:', err);
      // 如果 MediaElementAudioSourceNode 已存在，直接播放
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
    // ✅ 也同时更新 Audio 元素的音量
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.bgmVolume;
    }
  }

  /** 设置环境音音量 */
  setAmbienceVolume(level) {
    this.ambienceVolume = Math.max(0, Math.min(1, level));
    this.saveVolume('ambienceVolume', this.ambienceVolume);
  }

  // ==================== 环境音 ====================

  /** 播放指定环境音 */
  playAmbience(id, file, sector) {
    if (!this.initialized) return;
    this.stopAmbience(id);

    const audio = new Audio(file);
    // 不设置 loop，通过 ended 事件自动重新播放，避免 loop 拼接处的突兀跳跃
    audio.crossOrigin = 'anonymous';
    // 播放结束后自动重新播放（环境音需要循环）
    audio.addEventListener('ended', () => this.playAmbience(id, file, sector));
    // ✅ 修复：设置正确的初始音量，而不是 0
    audio.volume = this.ambienceVolume;

    const gain = this.audioCtx.createGain();
    gain.gain.value = this.ambienceVolume;
    gain.connect(this.audioCtx.destination);

    try {
      const source = this.audioCtx.createMediaElementSource(audio);
      source.connect(gain);
    } catch (err) {
      console.warn('Failed to connect ambience source:', err);
      // 如果已存在，直接使用 audio.volume
    }

    audio.play().then(() => {
      console.log(`✅ 环境音已播放 [${sector}]:`, file ? file.substring(0, 40) : 'unknown');
    }).catch(err => {
      console.error(`❌ 环境音播放失败 [${sector}]:`, err);
    });

    this.ambiences[id] = { audio, gain, sector };
  }

  stopAmbience(id) {
    const entry = this.ambiences[id];
    if (!entry) return;
    entry.audio.pause();
    entry.audio.currentTime = 0;
    delete this.ambiences[id];
  }

  /** 停止所有环境音 */
  stopAllAmbiences() {
    Object.keys(this.ambiences).forEach(id => this.stopAmbience(id));
  }

  /** 获取所有当前正在播放的环境音的扇区列表 */
  getActiveSectors() {
    return Object.values(this.ambiences).map(a => a.sector).filter(Boolean);
  }

  /** 停止指定扇区的环境音 */
  stopAmbienceBySector(sector) {
    const entries = Object.entries(this.ambiences).filter(([, a]) => a.sector === sector);
    entries.forEach(([id]) => this.stopAmbience(id));
  }

  // ==================== 清理 ====================

  destroy() {
    this.stopBGM();
    this.stopAllAmbiences();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.initialized = false;
  }
}

export default new AudioManager();
