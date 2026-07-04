/**
 * guidePoints — 3D 引导点组件（上升星尘效果）
 * 以一组上升、闪烁的微粒表示引导点，含蓄不抢眼。
 * 点击时弹出对话气泡并播放触发音频。
 */

import * as THREE from 'three';

let guidePointObjects = [];  // 存放所有点对象

const PARTICLE_COUNT = 16;       // 每点粒子数
const RISE_SPEED = 0.2;          // 上升速度
const RISE_RANGE = 3.0;          // 上升范围
const SPREAD_RADIUS = 1.0;       // 最大散布半径
const CORE_RADIUS = 0.25;        // 核心密集区半径

/** 创建引导点（上升星尘，中心密集外圈稀疏） */
export function createGuidePoints(scene, guidePoints, isEditMode = false) {
  if (!guidePoints || !Array.isArray(guidePoints) || guidePoints.length === 0) return;

  guidePoints.forEach(gp => {
    const [x, y, z] = gp.position || [0, 1.5, -4];
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // 编辑模式下加一个可见的中心标记
    if (isEditMode) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xd090b0, transparent: true, opacity: 0.5 })
      );
      marker.userData.guidePoint = {
        id: gp.id, text: gp.text, ambienceId: gp.ambienceId,
        file: gp.file, position: gp.position, isEditMode: true,
      };
      group.add(marker);
      guidePointObjects.push(marker);
    }

    // 不可见的碰撞球
    const hitSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitSphere.userData.guidePoint = {
      id: gp.id, text: gp.text, ambienceId: gp.ambienceId,
      file: gp.file, position: gp.position, isEditMode: isEditMode,
    };
    group.add(hitSphere);
    guidePointObjects.push(hitSphere);

    // 创建径向渐变星尘粒子（中心密集、外圈稀疏）
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 加权随机：更大概率在核心区
      const t = Math.random();
      const dist = t < 0.55
        ? Math.random() * CORE_RADIUS                          // 55% 在核心区
        : CORE_RADIUS + Math.random() * (SPREAD_RADIUS - CORE_RADIUS); // 45% 在外圈
      const angle = Math.random() * Math.PI * 2;

      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;
      const py = (Math.random() - 0.5) * RISE_RANGE;  // 居中分布

      // 距离中心越近，粒子越大越亮
      const distRatio = 1 - (dist / SPREAD_RADIUS); // 1=中心, 0=最远
      const particle = createStardustParticle(isEditMode, distRatio);
      particle.position.set(px, py, pz);

      particle.userData.stardust = {
        baseY: py,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        riseSpeed: RISE_SPEED * (0.5 + Math.random()),
        spreadX: px,
        spreadZ: pz,
        maxRise: RISE_RANGE * 0.5,  // 从中心向上浮动范围
        distRatio: distRatio,  // 存储距离比，用于动画
      };
      group.add(particle);
      guidePointObjects.push(particle);
    }

    scene.add(group);
    guidePointObjects.push(group);
  });
}

/** 创建单个星尘粒子（distRatio: 0=边缘 1=中心） */
function createStardustParticle(isEditMode, distRatio) {
  const baseSize = isEditMode ? 0.08 : 0.06;
  const size = baseSize * (0.5 + distRatio * 0.8); // 中心粒子大 80%
  const geometry = new THREE.SphereGeometry(size, 4, 4);

  // 中心更暖更亮，边缘更淡
  const hue = 0.08 + (1 - distRatio) * 0.04;
  const sat = 0.4 + distRatio * 0.35;
  const light = 0.6 + distRatio * 0.35;
  const color = new THREE.Color().setHSL(hue, sat, light);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const particle = new THREE.Mesh(geometry, material);
  return particle;
}

/** 清理引导点 */
export function clearGuidePoints() {
  guidePointObjects.forEach(obj => {
    if (!obj) return;
    obj.parent?.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
    // 清理子对象
    if (obj.children) {
      obj.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  });
  guidePointObjects = [];
}

/** 获取所有引导点 Mesh（用于射线检测） */
export function getGuidePointMeshes() {
  return guidePointObjects.filter(o => o.isMesh && o.userData?.guidePoint);
}

/** 每帧调用：更新星尘动画 */
export function updateGuidePointAnimations(time) {
  guidePointObjects.forEach(obj => {
    if (!obj || !obj.userData?.stardust) return;

    const sd = obj.userData.stardust;
    // 上升运动（循环）
    // 上下浮动（以 baseY 为中心）
    let newY = sd.baseY + Math.sin(time * sd.riseSpeed * 0.5 + sd.phase) * sd.maxRise * 0.6;
    obj.position.y = newY;

    // 微小水平漂移
    obj.position.x = sd.spreadX + Math.sin(time * 0.4 + sd.phase) * 0.15;
    obj.position.z = sd.spreadZ + Math.cos(time * 0.35 + sd.phase) * 0.15;

    // 闪烁透明度（中心粒子更亮）
    const distRatio = sd.distRatio || 0.5;
    const twinkle = 0.4 + 0.6 * Math.sin(time * sd.speed * 3 + sd.phase);
    const baseOp = obj.userData.triggerBoost ? 0.55 + distRatio * 0.35 : 0.2 + distRatio * 0.3;
    obj.material.opacity = Math.max(0, baseOp * twinkle);

    // 触发 boost 衰减
    if (obj.userData?.triggerBoost && obj.userData.triggerBoostTime) {
      if (time - obj.userData.triggerBoostTime > 1.5) {
        obj.userData.triggerBoost = false;
        obj.userData.triggerBoostTime = 0;
      }
    }
  });
}

/** 触发引导点的视觉反馈 */
export function triggerGuidePointFeedback(pointId) {
  guidePointObjects.forEach(obj => {
    if (obj.userData?.guidePoint?.id === pointId || obj.userData?.stardust) {
      // 检查该粒子是否属于目标引导点
      const parent = obj.parent;
      if (parent?.children) {
        const hitSphere = parent.children.find(c => c.userData?.guidePoint?.id === pointId);
        if (hitSphere) {
          obj.userData.triggerBoost = true;
          obj.userData.triggerBoostTime = performance.now() / 1000;
        }
      }
      if (obj.userData?.guidePoint?.id === pointId) {
        obj.userData.triggerBoost = true;
        obj.userData.triggerBoostTime = performance.now() / 1000;
      }
    }
  });
}
