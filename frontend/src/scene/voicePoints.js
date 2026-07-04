/**
 * voicePoints — 3D 语音点组件（上升星尘效果，青蓝色调）
 * 与引导点统一格式：以一组上升、闪烁的微粒表示，含蓄不抢眼。
 * 点击时播放触发音频。
 */

import * as THREE from 'three';

let voicePointObjects = [];

const VP_PARTICLE_COUNT = 16;
const VP_RISE_SPEED = 0.2;
const VP_RISE_RANGE = 3.0;
const VP_SPREAD_RADIUS = 1.0;
const VP_CORE_RADIUS = 0.25;

/** 创建语音点（青蓝星尘） */
export function createVoicePoints(scene, voicePoints, isEditMode = false) {
  if (!voicePoints || !Array.isArray(voicePoints) || voicePoints.length === 0) return;

  voicePoints.forEach(vp => {
    const [x, y, z] = vp.position || [2, 1.5, -4];
    const group = new THREE.Group();
    group.position.set(x, y, z);

    if (isEditMode) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x60b0b0, transparent: true, opacity: 0.5 })
      );
      marker.userData.voicePoint = {
        id: vp.id, text: vp.text, ambienceId: vp.ambienceId,
        file: vp.file, position: vp.position, isEditMode: true,
      };
      group.add(marker);
      voicePointObjects.push(marker);
    }

    const hitSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitSphere.userData.voicePoint = {
      id: vp.id, text: vp.text, ambienceId: vp.ambienceId,
      file: vp.file, position: vp.position, isEditMode: isEditMode,
    };
    group.add(hitSphere);
    voicePointObjects.push(hitSphere);

    for (let i = 0; i < VP_PARTICLE_COUNT; i++) {
      const t = Math.random();
      const dist = t < 0.55
        ? Math.random() * VP_CORE_RADIUS
        : VP_CORE_RADIUS + Math.random() * (VP_SPREAD_RADIUS - VP_CORE_RADIUS);
      const angle = Math.random() * Math.PI * 2;

      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;
      const py = (Math.random() - 0.5) * VP_RISE_RANGE;

      const distRatio = 1 - (dist / VP_SPREAD_RADIUS);
      const particle = createVoiceParticle(isEditMode, distRatio);
      particle.position.set(px, py, pz);

      particle.userData.stardust = {
        baseY: py, phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        riseSpeed: VP_RISE_SPEED * (0.5 + Math.random()),
        spreadX: px, spreadZ: pz,
        maxRise: VP_RISE_RANGE * 0.5,
        distRatio: distRatio,
      };
      group.add(particle);
      voicePointObjects.push(particle);
    }

    scene.add(group);
    voicePointObjects.push(group);
  });
}

function createVoiceParticle(isEditMode, distRatio) {
  const baseSize = isEditMode ? 0.08 : 0.06;
  const size = baseSize * (0.5 + distRatio * 0.8);
  const geometry = new THREE.SphereGeometry(size, 4, 4);

  // 青蓝色调
  const hue = 0.52 + (1 - distRatio) * 0.06;
  const sat = 0.35 + distRatio * 0.35;
  const light = 0.58 + distRatio * 0.35;
  const color = new THREE.Color().setHSL(hue, sat, light);
  const material = new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0, depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/** 清理语音点 */
export function clearVoicePoints() {
  voicePointObjects.forEach(obj => {
    if (!obj) return;
    obj.parent?.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
    if (obj.children) obj.children.forEach(ch => {
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) ch.material.dispose();
    });
  });
  voicePointObjects = [];
}

/** 获取所有语音点 Mesh（用于射线检测） */
export function getVoicePointSprites() {
  return voicePointObjects.filter(o => o.isMesh && o.userData?.voicePoint);
}

/** 每帧调用：更新动画 */
export function updateVoicePointAnimations(time) {
  voicePointObjects.forEach(obj => {
    if (!obj || !obj.userData?.stardust) return;
    const sd = obj.userData.stardust;

    let newY = sd.baseY + Math.sin(time * sd.riseSpeed * 0.5 + sd.phase) * sd.maxRise * 0.6;
    obj.position.y = newY;

    obj.position.x = sd.spreadX + Math.sin(time * 0.4 + sd.phase) * 0.15;
    obj.position.z = sd.spreadZ + Math.cos(time * 0.35 + sd.phase) * 0.15;

    const distRatio = sd.distRatio || 0.5;
    const twinkle = 0.4 + 0.6 * Math.sin(time * sd.speed * 3 + sd.phase);
    const baseOp = obj.userData.triggerBoost ? 0.55 + distRatio * 0.35 : 0.2 + distRatio * 0.3;
    obj.material.opacity = Math.max(0, baseOp * twinkle);

    if (obj.userData?.triggerBoost && obj.userData.triggerBoostTime) {
      if (time - obj.userData.triggerBoostTime > 1.5) {
        obj.userData.triggerBoost = false;
        obj.userData.triggerBoostTime = 0;
      }
    }
  });
}

export function triggerVoicePointFeedback(pointId) {
  voicePointObjects.forEach(obj => {
    if (obj.userData?.voicePoint?.id === pointId) {
      obj.userData.triggerBoost = true;
      obj.userData.triggerBoostTime = performance.now() / 1000;
    }
    // 触发该组内所有粒子
    if (obj.userData?.stardust) {
      const parent = obj.parent;
      if (parent?.children) {
        const hs = parent.children.find(c => c.userData?.voicePoint?.id === pointId);
        if (hs) {
          obj.userData.triggerBoost = true;
          obj.userData.triggerBoostTime = performance.now() / 1000;
        }
      }
    }
  });
}
