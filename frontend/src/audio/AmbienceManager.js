/**
 * AmbienceManager — 管理弱交互环境音的扇区切换
 * 基于相机朝向的 Y 轴角度实现方向环境音的平滑渐变过渡。
 *
 * 三层音频架构：
 *   1. 主环境音 — 始终播放的背景层（不受方向影响）
 *   2. 方向环境音 — 4 方向渐变过渡
 *   3. 互动触发音 — 由互动点触发
 *
 * 4 个方位扇区：
 *   north  (前方)  0°  ± 45°
 *   east   (右方)  90° ± 45°
 *   south  (后方)  180°± 45°
 *   west   (左方)  270°± 45°
 *
 * 渐变策略：每个方向使用 sigmoid 权重，相邻两方向叠加
 * 用户转向时方向音平滑增加/衰减，实现无缝过渡
 */

import audioManager from './AudioManager.js';
import * as THREE from 'three';

const SECTORS = ['north', 'east', 'south', 'west'];

class AmbienceManager {
  constructor() {
    this.ambiences = [];         // 方向环境音配置: { id, file, sector, text }
    this.mainAmbienceFile = null; // 主环境音文件路径
    this.lastTime = 0;
    this._initialized = false;
  }

  /** 设置当前空间的环境音列表 */
  setAmbiences(ambiences) {
    this.ambiences = Array.isArray(ambiences) ? ambiences : [];
  }

  /** 设置主环境音 */
  setMainAmbience(file) {
    this.mainAmbienceFile = file || null;
  }

  /**
   * 初始化：加载所有方向环境音到 AudioManager
   * 必须在进入空间球后调用
   */
  initDirectionalAmbiences() {
    if (!this._initialized) {
      // 预加载所有 4 个方向
      SECTORS.forEach(sector => {
        const entry = this.ambiences.find(a => a.sector === sector);
        if (entry?.file) {
          audioManager.loadDirectionalAmbience(sector, entry.file);
        }
      });
      this._initialized = true;
    }
  }

  /**
   * 启动主环境音
   */
  startMainAmbience() {
    if (this.mainAmbienceFile) {
      audioManager.playMainAmbience(this.mainAmbienceFile);
    }
  }

  /**
   * 每帧调用：根据相机朝向计算方向权重并更新渐变
   * @param {THREE.PerspectiveCamera} camera - 当前相机
   * @param {number} deltaTime - 帧间隔（秒）
   */
  update(camera, deltaTime) {
    if (!camera || this.ambiences.length === 0) return;

    // 获取相机朝向
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // 计算水平角度
    const angle = Math.atan2(direction.x, direction.z);
    let degrees = (angle * 180) / Math.PI;
    if (degrees < 0) degrees += 360;

    // 计算四个方向的权重
    const weights = this._calculateWeights(degrees);

    // 设置各方向的目标音量
    SECTORS.forEach(sector => {
      const entry = this.ambiences.find(a => a.sector === sector);
      if (entry?.file) {
        audioManager.setDirectionalTarget(sector, weights[sector]);
      }
    });

    // 更新渐变
    audioManager.updateCrossfade(deltaTime || 0.016);
  }

  /**
   * 根据角度计算四个方向的权重（平滑渐变）
   * 使用平滑的三角函数过渡而非硬切换
   */
  _calculateWeights(degrees) {
    const weights = { north: 0, east: 0, south: 0, west: 0 };

    // 将角度映射到 4 个方向，每个方向覆盖 90 度
    // north: 315-45, east: 45-135, south: 135-225, west: 225-315
    // 使用平滑过渡：在相邻方向之间有 45 度的过渡区

    const transitions = [
      { sector: 'north', center: 0,   range: [315, 45] },
      { sector: 'east',  center: 90,  range: [45, 135] },
      { sector: 'south', center: 180, range: [135, 225] },
      { sector: 'west',  center: 270, range: [225, 315] },
    ];

    transitions.forEach(t => {
      let dist;
      if (t.center === 0) {
        // 处理 0°/360° 边界
        const d1 = Math.abs(degrees - 0);
        const d2 = Math.abs(degrees - 360);
        dist = Math.min(d1, d2);
      } else {
        dist = Math.abs(degrees - t.center);
      }
      // 平滑衰减：方向中心处权重为 1，45 度处为 0.5，90 度处为 0
      // 使用 cos 函数实现平滑过渡
      if (dist <= 90) {
        weights[t.sector] = Math.cos((dist / 90) * Math.PI / 2);
      }
    });

    return weights;
  }

  /** 停止所有环境音并重置 */
  reset() {
    audioManager.stopMainAmbience();
    audioManager.stopAllDirectionalAmbiences();
    this._initialized = false;
  }
}

export default new AmbienceManager();
