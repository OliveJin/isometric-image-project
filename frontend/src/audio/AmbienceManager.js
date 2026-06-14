/**
 * AmbienceManager — 管理弱交互环境音的扇区切换
 * 基于相机朝向的 Y 轴角度自动切换环境音。
 *
 * 4 个方位扇区：
 *   north  (前方)  0°  ± 90°
 *   east   (右方)  90° ± 90°
 *   south  (后方)  180°± 90°
 *   west   (左方)  270°± 90°
 */

import audioManager from './AudioManager.js';

const SECTORS = ['north', 'east', 'south', 'west'];
const DEBOUNCE_MS = 2000;

class AmbienceManager {
  constructor() {
    this.ambiences = [];   // { id, file, sector, text }
    this.currentSector = null;
    this.lastSwitchTime = 0;
  }

  /** 设置当前空间的环境音列表 */
  setAmbiences(ambiences) {
    this.ambiences = Array.isArray(ambiences) ? ambiences : [];
  }

  /**
   * 检测相机朝向并切换环境音
   * @param {THREE.PerspectiveCamera} camera - 当前相机
   */
  update(camera) {
    if (!camera || this.ambiences.length === 0) return;

    const now = performance.now();
    if (now - this.lastSwitchTime < DEBOUNCE_MS) return;

    // 获取相机朝向向量（Z 轴的负方向）
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // 计算水平角度（忽略 Y 轴，只看 XZ 平面）
    const angle = Math.atan2(direction.x, direction.z);
    let degrees = (angle * 180) / Math.PI;
    if (degrees < 0) degrees += 360;

    // 确定扇区
    let sector;
    if (degrees >= 315 || degrees < 45) {
      sector = 'north';
    } else if (degrees >= 45 && degrees < 135) {
      sector = 'east';
    } else if (degrees >= 135 && degrees < 225) {
      sector = 'south';
    } else {
      sector = 'west';
    }

    if (sector === this.currentSector) return;

    this.switchTo(sector);
  }

  /** 切换到指定扇区的环境音 */
  switchTo(sector) {
    const entry = this.ambiences.find(a => a.sector === sector);
    if (!entry) {
      // 该扇区没有环境音，停止当前扇区的
      audioManager.stopAmbienceBySector(this.currentSector);
      this.currentSector = null;
      return;
    }

    // 停止旧扇区
    audioManager.stopAmbienceBySector(this.currentSector);

    // 播放新扇区
    audioManager.playAmbience(entry.id, entry.file, entry.sector);
    this.currentSector = sector;
    this.lastSwitchTime = performance.now();
  }

  /** 停止所有环境音并重置 */
  reset() {
    audioManager.stopAllAmbiences();
    this.currentSector = null;
    this.ambiences = [];
  }
}

// 需要 THREE 全局可用，但这里我们用局部引用避免循环依赖
// 实际使用时确保 THREE 已加载
import * as THREE from 'three';

export default new AmbienceManager();
