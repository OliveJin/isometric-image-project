/**
 * guidePoints — 3D 引导点组件
 * 在全景球体上以发光球体形式显示引导问题，点击弹出对话气泡。
 */

import * as THREE from 'three';
import audioManager from '../audio/AudioManager.js';
import { show as showBubble } from '../ui/DialogueBubble.js';

let guidePointObjects = [];  // 存放所有球体 + 光环

/** 创建引导点 */
export function createGuidePoints(scene, guidePoints, isEditMode = false) {
  if (!guidePoints || !Array.isArray(guidePoints) || guidePoints.length === 0) return;

  guidePoints.forEach(gp => {
    // ✅ 改进：更亮更突出的颜色，更强的泛光
    const geometry = new THREE.SphereGeometry(isEditMode ? 0.25 : 0.15, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: isEditMode ? 0xff6b9d : 0xd4c5ff,  // 编辑模式时使用粉红色，正常模式使用淡紫色
      emissive: isEditMode ? 0xff1493 : 0xa88fff,  // 更亮的发光色
      emissiveIntensity: isEditMode ? 1.2 : 0.8,   // 编辑模式发光更强
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);

    const [x, y, z] = gp.position || [2, 1.2, -2];
    mesh.position.set(x, y, z);

    mesh.userData.guidePoint = {
      id: gp.id,
      text: gp.text,
      ambienceId: gp.ambienceId,
      file: gp.file,
      position: gp.position,  // 同步 position 引用
      isEditMode: isEditMode,
    };

    // ✅ 改进：更明显的外发光光环
    const ringGeometry = isEditMode 
      ? new THREE.RingGeometry(0.35, 0.5, 32)    // 编辑模式更大的光环
      : new THREE.RingGeometry(0.22, 0.32, 32);  // 正常模式
    
    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: isEditMode ? 0xff69b4 : 0xc5b9ff,
        transparent: true,
        opacity: isEditMode ? 0.4 : 0.2,  // 编辑模式光环更明显
        side: THREE.DoubleSide,
      })
    );
    ring.position.copy(mesh.position);
    ring.rotation.x = -Math.PI / 2;
    ring.userData.parentMesh = mesh;

    // ✅ 新增：脉冲动画（如果是编辑模式）
    if (isEditMode) {
      ring.userData.pulsePhase = Math.random() * Math.PI * 2;
      ring.userData.isPulsing = true;
    }

    scene.add(mesh, ring);
    guidePointObjects.push(mesh, ring);
  });
}

/** 清理引导点 */
export function clearGuidePoints() {
  guidePointObjects.forEach(obj => {
    if (!obj) return;
    obj.parent?.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  guidePointObjects = [];
}

/** 获取所有引导点 Mesh */
export function getGuidePointMeshes() {
  return guidePointObjects.filter(o => o.isMesh);
}
