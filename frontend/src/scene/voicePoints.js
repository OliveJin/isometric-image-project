/**
 * voicePoints — 3D 语音点组件
 * 在全景球体上以 Sprite 形式显示喇叭图标，点击播放环境音 + 弹出对话气泡。
 */

import * as THREE from 'three';

let voicePointObjects = [];  // 存放所有 Sprite + 光环

/**
 * 创建喇叭图标的 Canvas 纹理
 */
function createSpeakerTexture(isEditMode = false) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // ✅ 改进：更亮更突出的背景
  const bgColor = isEditMode ? 'rgba(255, 105, 180, 0.25)' : 'rgba(240, 235, 255, 0.15)';
  const borderColor = isEditMode ? 'rgba(255, 20, 147, 0.8)' : 'rgba(240, 235, 255, 0.6)';
  const textColor = isEditMode ? '#FF69B4' : '#eef0ff';
  
  // 背景圆形
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isEditMode ? 6 : 4;
  ctx.stroke();

  // 喇叭图标
  ctx.fillStyle = textColor;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔊', size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

let speakerTexture = null;
let speakerTextureEditMode = null;

/** 创建语音点 */
export function createVoicePoints(scene, voicePoints, isEditMode = false) {
  if (!voicePoints || !Array.isArray(voicePoints) || voicePoints.length === 0) return;

  const textureKey = isEditMode ? 'editMode' : 'normal';
  if (!speakerTexture || (isEditMode && !speakerTextureEditMode)) {
    if (isEditMode && !speakerTextureEditMode) {
      speakerTextureEditMode = createSpeakerTexture(true);
    } else if (!isEditMode && !speakerTexture) {
      speakerTexture = createSpeakerTexture(false);
    }
  }

  const texture = isEditMode ? speakerTextureEditMode : speakerTexture;

  voicePoints.forEach(vp => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: isEditMode ? 0.95 : 0.85,  // 编辑模式更不透明
      })
    );

    const [x, y, z] = vp.position || [0, 1.5, -2];
    sprite.position.set(x, y, z);
    sprite.scale.set(isEditMode ? 0.8 : 0.6, isEditMode ? 0.8 : 0.6, 1);  // 编辑模式更大

    sprite.userData.voicePoint = {
      id: vp.id,
      ambienceId: vp.ambienceId,
      text: vp.text,
      file: vp.file,
      position: vp.position,  // 同步 position 引用
      isEditMode: isEditMode,
    };

    // ✅ 改进：更明显的外发光光环
    const ringRadius = isEditMode ? [0.5, 0.65] : [0.35, 0.45];
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius[0], ringRadius[1], 32),
      new THREE.MeshBasicMaterial({
        color: isEditMode ? 0xff69b4 : 0xffffff,
        transparent: true,
        opacity: isEditMode ? 0.4 : 0.18,
        side: THREE.DoubleSide,
      })
    );
    ring.position.copy(sprite.position);
    ring.userData.parentSprite = sprite;

    // ✅ 新增：脉冲动画（正常模式和编辑模式都有泛光呼吸效果）
    ring.userData.pulsePhase = Math.random() * Math.PI * 2;
    ring.userData.isPulsing = true;

    scene.add(sprite, ring);
    voicePointObjects.push(sprite, ring);
  });
}

/** 清理语音点 */
export function clearVoicePoints() {
  voicePointObjects.forEach(obj => {
    if (!obj) return;
    obj.parent?.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  voicePointObjects = [];
}

/** 获取所有语音点 Sprite */
export function getVoicePointSprites() {
  return voicePointObjects.filter(o => o.isSprite);
}

/** 每帧调用：更新所有语音点光环的泛光呼吸动画 */
export function updateVoicePointAnimations(time) {
  voicePointObjects.forEach(obj => {
    if (obj.userData?.isPulsing && obj.material) {
      const phase = obj.userData.pulsePhase || 0;
      const pulse = 0.15 + 0.10 * Math.sin(time * 2 + phase);
      obj.material.opacity = pulse;
    }
  });
}
