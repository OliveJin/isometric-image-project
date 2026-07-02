import * as THREE from 'three';
import { initScene } from './scene/scene.js';
import { loadSpaces, getSpaceById, setSpaces, saveCreatedSpaces, markSpaceDeleted, syncSpaceToBackend, deleteSpaceFromBackend } from './scene/loader.js';
import { createSphere, clearSphere } from './scene/sphere.js';
import {
  createEntrySpheres,
  clearEntrySpheres,
  getEntrySpheres,
  getEntrySphereById,
  resetCameraPosition,
} from './scene/entrySpheres.js';
import { renderSelector } from './ui/selector.js';
import audioManager from './audio/AudioManager.js';
import ambienceManager from './audio/AmbienceManager.js';
import { initBGMControl, hideBGMControl } from './ui/BGMControl.js';
import { getVoicePointSprites } from './scene/voicePoints.js';
import { getGuidePointMeshes, updateGuidePointAnimations } from './scene/guidePoints.js';
import { updateVoicePointAnimations } from './scene/voicePoints.js';
import { registerFrameCallback, clearFrameCallbacks } from './scene/scene.js';
import { initSpaceEditor, openSpaceEditor, register3DContext } from './ui/SpaceEditor.js';
import './ui/editor.css';

let scene;
let camera;
let renderer;
let controls;
let raycaster;
let spacesData = [];
let currentSpaceId = null;
let currentSpace = null;
let isIntroVisible = true;
let isConfirmVisible = false;
let pendingSpaceId = null;
let currentRenameId = null;

let pointerDownListener = null;

const selectionTarget = new THREE.Vector3(0, 0.3, 0);
const selectionPosition = new THREE.Vector3(0, 1.12, 8.2);

async function init() {
  const res = initScene();
  scene = res.scene;
  camera = res.camera;
  renderer = res.renderer;
  controls = res.controls;
  controls.target.copy(selectionTarget);
  setSelectionControls();
  controls.enabled = false;

  spacesData = await loadSpaces();
  initSpaceEditor();
  register3DContext(scene, camera, renderer);  // 注册3D上下文以支持交互点位置编辑
  renderSelector(spacesData, prepareFocusOnSphere, openRenameOverlay, deleteSpace, openSpaceEditor);
  setupBackButton();
  setupPointerEvents();
  setupIntro();
  setupConfirmOverlay();
  setupUploadUI();
  setupRenameOverlay();
}

function setupIntro() {
  const introOverlay = document.getElementById('introOverlay');
  const enterBtn = document.getElementById('enterMomentBtn');
  const selector = document.getElementById('selector');

  if (!enterBtn || !introOverlay || !selector) return;

  selector.classList.remove('visible');

  enterBtn.addEventListener('click', () => {
    isIntroVisible = false;
    introOverlay.classList.add('hidden');
    selector.classList.add('visible');
    createEntrySpheres(scene, spacesData);
    resetCameraPosition(camera);
    controls.target.copy(selectionTarget);
    setSelectionControls();
    controls.enabled = true;
    controls.update();
  });
}

function setupConfirmOverlay() {
  const confirmYesBtn = document.getElementById('confirmYesBtn');
  const confirmNoBtn = document.getElementById('confirmNoBtn');

  if (!confirmYesBtn || !confirmNoBtn) return;

  confirmYesBtn.addEventListener('click', async () => {
    if (!pendingSpaceId) return;
    await confirmEnterSpace();
  });

  confirmNoBtn.addEventListener('click', async () => {
    await cancelConfirm();
  });
}

function setupBackButton() {
  const backBtn = document.getElementById('backBtn');

  if (!backBtn) return;

  backBtn.addEventListener('click', async () => {
    if (currentSpaceId) {
      await exitSpace();
    }
  });
}

function setupUploadUI() {
  const createButton = document.getElementById('createSpaceBtn');
  const uploadOverlay = document.getElementById('uploadOverlay');
  const fileInput = document.getElementById('panoramaFileInput');
  const uploadButton = document.getElementById('uploadSpaceBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');

  if (!createButton || !uploadOverlay || !fileInput || !uploadButton || !cancelUploadBtn) return;

  createButton.addEventListener('click', openUploadOverlay);

  fileInput.addEventListener('change', () => {
    if (!fileInput.files?.length) {
      uploadButton.disabled = true;
      uploadButton.textContent = '上传并创建';
      return;
    }
    const count = fileInput.files.length;

    // 1 张 = 本地贴图；4 张 = AI 合成；10+ = OpenCV 全景拼接；其他数量拒绝
    if (count === 1) {
      uploadButton.disabled = false;
      uploadButton.textContent = '本地贴图：立即创建 (1 张)';
      document.getElementById('uploadHint').innerText = '将对单张图片进行本地即时贴图，无需后端调用。';
    } else if (count === 4) {
      uploadButton.disabled = false;
      uploadButton.textContent = 'AI 合成并创建 (恰好4张)';
      document.getElementById('uploadHint').innerText = '将把恰好4张照片发送给后端进行 AI 分析与合成。';
    } else if (count >= 10) {
      uploadButton.disabled = false;
      uploadButton.textContent = `OpenCV 全景拼接并创建 (${count} 张)`;
      document.getElementById('uploadHint').innerText = `将对 ${count} 张照片进行 OpenCV 自动拼接，生成全景图。图片越多还原越精确。此过程可能需要数十秒。`;
    } else {
      alert('请选择 1 张（即时贴图）、恰好 4 张（AI 合成）或 10 张以上（OpenCV 全景拼接）。');
      const dt = new DataTransfer();
      fileInput.value = '';
      fileInput.files = dt.files;
      return;
    }
  });

  uploadButton.addEventListener('click', async () => {
    if (!fileInput.files?.length) return;
    const files = Array.from(fileInput.files);

    // Handle single-image immediate local貼圖
    if (files.length === 1) {
      uploadButton.disabled = true;
      uploadButton.textContent = '创建预览...';
      try {
        await createTemporarySpace(files[0]);
        hideUploadOverlay();
      } catch (err) {
        console.error(err);
        alert('创建预览失败');
      } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = '本地贴图：立即创建 (1 张)';
      }
      return;
    }

    // Handle exactly-4 AI flow
    if (files.length === 4) {
      uploadButton.disabled = true;
      uploadButton.textContent = '上传并合成...';
      try {
        await uploadPhotos(files.slice(0,4));
        hideUploadOverlay();
      } catch (err) {
        console.error(err);
        alert('上传或AI合成失败，请稍后再试');
      } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = 'AI 合成并创建 (恰好4张)';
      }
      return;
    }

    // Handle 10+ image OpenCV stitch flow
    if (files.length >= 10) {
      uploadButton.disabled = true;
      uploadButton.textContent = `JavaCV 拼接中... (${files.length} 张)`;
      try {
        await uploadOpenCVImages(files);
        hideUploadOverlay();
      } catch (err) {
        console.error(err);
        const detail = err.message || '';
        alert('全景拼接失败\n\n' + detail + '\n\n请确保：\n1. 图片之间有 30%-50% 重叠区域\n2. 拍摄角度变化不要过大\n3. 图片数量 ≥ 10 张');
      } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = `OpenCV 全景拼接并创建 (${files.length} 张)`;
      }
      return;
    }

    alert('请选择 1 张用于本地即时贴图，或恰好 4 张用于 AI 合成，或 10 张以上用于 OpenCV 全景拼接。');
  });

  cancelUploadBtn.addEventListener('click', () => {
    hideUploadOverlay();
  });
}

function openUploadOverlay() {
  const overlay = document.getElementById('uploadOverlay');
  const fileInput = document.getElementById('panoramaFileInput');
  const uploadButton = document.getElementById('uploadSpaceBtn');

  if (!overlay || !fileInput || !uploadButton) return;

  hideConfirmOverlay();
  hideRenameOverlay();
  overlay.classList.add('visible');
  fileInput.value = '';
  uploadButton.disabled = true;
}

function hideUploadOverlay() {
  const overlay = document.getElementById('uploadOverlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
}

function setupRenameOverlay() {
  const renameOverlay = document.getElementById('renameOverlay');
  const renameInput = document.getElementById('renameInput');
  const confirmRenameBtn = document.getElementById('confirmRenameBtn');
  const cancelRenameBtn = document.getElementById('cancelRenameBtn');

  if (!renameOverlay || !renameInput || !confirmRenameBtn || !cancelRenameBtn) return;

  renameInput.addEventListener('input', () => {
    confirmRenameBtn.disabled = !renameInput.value.trim();
  });

  confirmRenameBtn.addEventListener('click', async () => {
    const newLabel = renameInput.value.trim();
    if (!currentRenameId || !newLabel) return;
    renameSpace(currentRenameId, newLabel);
    hideRenameOverlay();
  });

  cancelRenameBtn.addEventListener('click', () => {
    hideRenameOverlay();
  });
}

function openRenameOverlay(spaceId) {
  const renameOverlay = document.getElementById('renameOverlay');
  const renameInput = document.getElementById('renameInput');
  const confirmRenameBtn = document.getElementById('confirmRenameBtn');
  const space = getSpaceById(spaceId);

  if (!renameOverlay || !renameInput || !confirmRenameBtn || !space) return;

  hideUploadOverlay();
  hideConfirmOverlay();
  currentRenameId = spaceId;
  renameInput.value = space.label || space.id.replace(/[-_]/g, ' ');
  confirmRenameBtn.disabled = !renameInput.value.trim();
  renameOverlay.classList.add('visible');
  renameInput.focus();
}

function hideRenameOverlay() {
  const renameOverlay = document.getElementById('renameOverlay');
  const renameInput = document.getElementById('renameInput');
  const confirmRenameBtn = document.getElementById('confirmRenameBtn');

  if (!renameOverlay || !renameInput || !confirmRenameBtn) return;

  renameOverlay.classList.remove('visible');
  renameInput.value = '';
  confirmRenameBtn.disabled = true;
  currentRenameId = null;
}

async function uploadPhotos(files) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }

    const imageUrls = await res.json();
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error('Invalid response from upload API');
    }

    // 调用后端AI分析并生成图像（发送纯JSON数组）
    try {
      console.log('=== 上传成功，准备调用AI分析 ===', imageUrls);
      const analyzePayload = JSON.stringify(imageUrls);
      
      const analyzeRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: analyzePayload,
      });

      if (!analyzeRes.ok) throw new Error(`Analyze failed: ${analyzeRes.status}`);

      const contentType = analyzeRes.headers.get('content-type') || '';
      let generatedData;
      if (contentType.includes('application/json')) {
        generatedData = await analyzeRes.json();
      } else {
        const text = await analyzeRes.text();
        try {
          generatedData = JSON.parse(text);
        } catch (e) {
          generatedData = text;
        }
      }

      console.log('=== AI返回数据 ===', generatedData);

      // 智能提取生成图的URL（后端返回 {data: [{url: '...'}]} 格式）
      let panoramaUrl = null;

      if (typeof generatedData === 'string') {
        const trimmed = generatedData.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            generatedData = JSON.parse(trimmed);
          } catch (e) {
            console.warn('AI returned text that is not valid JSON', e);
          }
        }
      }

      console.log('=== 调试：generatedData ===', generatedData);
      console.log('=== 调试：generatedData.data ===', generatedData?.data);
      console.log('=== 调试：是否为数组 ===', Array.isArray(generatedData?.data));

      if (typeof generatedData === 'string') {
        // 直接是URL字符串
        panoramaUrl = generatedData;
      } else if (Array.isArray(generatedData)) {
        // 是数组，取第一项的 url 或直接值
        panoramaUrl = generatedData[0]?.url || generatedData[0];
      } else if (generatedData?.data) {
        // 嵌套在 data 字段
        if (Array.isArray(generatedData.data) && generatedData.data.length > 0) {
          // data 是对象数组，取第一个对象的 url 属性
          const firstDataItem = generatedData.data[0];
          console.log('=== 调试：firstDataItem ===', firstDataItem);
          panoramaUrl = firstDataItem?.url;
          if (!panoramaUrl && typeof firstDataItem === 'string') {
            panoramaUrl = firstDataItem;
          }
        } else if (typeof generatedData.data === 'string') {
          panoramaUrl = generatedData.data;
        } else if (generatedData.data?.url) {
          panoramaUrl = generatedData.data.url;
        }
      }

      if (!panoramaUrl) {
        throw new Error('无法从AI响应中提取生成图URL');
      }

      console.log('=== 提取的全景图URL ===', panoramaUrl);

      // 如果是外部 URL，先尝试让后端下载并保存到本地 uploads/（避免 CORS/签名失效）
      let panoramaForSphere = panoramaUrl;
      try {
        const parsed = new URL(panoramaUrl);
        if (parsed.origin !== window.location.origin) {
          try {
            const saveRes = await fetch('/api/fetch-and-save?url=' + encodeURIComponent(panoramaUrl));
            if (saveRes.ok) {
              const j = await saveRes.json();
              if (j?.url) {
                panoramaForSphere = j.url;
              } else {
                // fallback to proxy
                panoramaForSphere = `/api/proxy?url=${encodeURIComponent(panoramaUrl)}`;
              }
            } else {
              // fallback to proxy
              panoramaForSphere = `/api/proxy?url=${encodeURIComponent(panoramaUrl)}`;
            }
          } catch (e) {
            // 如果 fetch-and-save 失败，退回到 proxy
            panoramaForSphere = `/api/proxy?url=${encodeURIComponent(panoramaUrl)}`;
          }
        }
      } catch (e) {
        // 非 URL（例如 data:）则直接使用
      }

      const space = {
        id: `space-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        panorama: panoramaForSphere,
        label: 'AI 生成的空间',
      };

      addSpace(space);
      return;
    } catch (err) {
      console.warn('AI analyze failed, using uploaded image', err);
      let fallbackPanorama = imageUrls[0];
      try {
        const parsed = new URL(imageUrls[0]);
        if (parsed.origin !== window.location.origin) {
          fallbackPanorama = `/api/proxy?url=${encodeURIComponent(imageUrls[0])}`;
        }
      } catch (e) {
      }

      const space = {
        id: `space-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        panorama: fallbackPanorama,
        label: '上传的空间（AI失败回退）',
      };
      addSpace(space);
      return;
    }
  } catch (err) {
    console.warn('Upload failed, creating temporary preview', err);
    // fallback to first file temporary preview
    await createTemporarySpace(files[0]);
  }
}

async function uploadOpenCVImages(files) {
  const formData = new FormData();
  files.forEach(f => formData.append('images', f));

  try {
    const res = await fetch('/api/opencv/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenCV upload failed: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    if (data?.error) {
      throw new Error(data.error);
    }

    const panoramaUrl = data?.url;
    if (!panoramaUrl) {
      throw new Error('未从 OpenCV 服务获取到全景图 URL');
    }

    console.log('=== OpenCV 拼接成功 ===', panoramaUrl);

    // Convert Python service URL (e.g. http://localhost:5000/uploads/panorama-xxx.jpg)
    // to a relative path served by Spring Boot (e.g. /uploads/panorama-xxx.jpg)
    let panoramaForSphere = panoramaUrl;
    try {
      const parsed = new URL(panoramaUrl);
      if (parsed.origin !== window.location.origin) {
        panoramaForSphere = parsed.pathname;
      }
    } catch (e) {
      // Not a valid URL, use as-is
    }

    const space = {
      id: `space-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      panorama: panoramaForSphere,
      label: 'OpenCV 拼接的空间',
    };

    addSpace(space);
  } catch (err) {
    console.error('OpenCV upload error:', err);
    throw err;
  }
}

function addSpace(space) {
  const exists = spacesData.some(item => item.id === space.id);
  const normalizedSpace = {
    ...space,
    isSaved: true,
  };

  if (!exists) {
    spacesData.push(normalizedSpace);
  }

  setSpaces(spacesData);
  saveCreatedSpaces(spacesData);

  // 异步同步到后端（不阻塞UI）
  syncSpaceToBackend(normalizedSpace).catch(err =>
    console.warn('后端同步失败（本地已保存）:', err.message)
  );

  refreshSpaces();
}

function renameSpace(id, label) {
  const space = getSpaceById(id);
  if (!space) return;

  space.label = label;
  space.isSaved = true;
  setSpaces(spacesData);
  saveCreatedSpaces(spacesData);

  // 异步同步到后端
  syncSpaceToBackend(space).catch(err =>
    console.warn('后端同步失败（本地已保存）:', err.message)
  );

  refreshSpaces();
}

function deleteSpace(id) {
  const space = getSpaceById(id);
  if (!space) return;

  if (!window.confirm('确认删除该空间吗？此操作不可恢复。')) {
    return;
  }

  spacesData = spacesData.filter(item => item.id !== id);
  setSpaces(spacesData);
  saveCreatedSpaces(spacesData);
  markSpaceDeleted(id);

  // 异步从后端删除
  deleteSpaceFromBackend(id).catch(err =>
    console.warn('后端删除失败（本地已删除）:', err.message)
  );

  if (pendingSpaceId === id) {
    pendingSpaceId = null;
    hideConfirmOverlay();
  }
  refreshSpaces();
}

function refreshSpaces() {
  renderSelector(spacesData, prepareFocusOnSphere, openRenameOverlay, deleteSpace, openRenameOverlay, deleteSpace);
  if (!currentSpaceId) {
    createEntrySpheres(scene, spacesData);
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function createTemporarySpace(file) {
  const dataUrl = await readFileAsDataURL(file);
  const id = `temp-space-${Date.now()}`;
  const label = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const tempSpace = {
    id,
    panorama: dataUrl,
    audio: '',
    hotspots: [],
    label,
    isLocal: true,
  };

  spacesData.push(tempSpace);
  setSpaces(spacesData);
  saveCreatedSpaces(spacesData);
  refreshSpaces();
}

function updateBackButton() {
  const backBtn = document.getElementById('backBtn');
  if (!backBtn) return;

  backBtn.style.display = currentSpaceId ? 'inline-flex' : 'none';
}

function setSelectionControls() {
  if (!controls) return;
  controls.minPolarAngle = Math.PI / 2 - 0.08;
  controls.maxPolarAngle = Math.PI / 2 + 0.08;
  controls.enableZoom = false;
  controls.enablePan = false;
}

function setSpaceControls() {
  if (!controls) return;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.enableZoom = false;
  controls.enablePan = false;
}

function setupPointerEvents() {
  raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(event) {
  if (currentSpaceId || isIntroVisible) {
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera({ x, y }, camera);
  const intersects = raycaster.intersectObjects(getEntrySpheres(), true);

  if (intersects.length > 0) {
    const createHit = intersects.find(intersect => intersect.object?.userData?.createNewSpace);
    if (createHit) {
      openUploadOverlay();
      return;
    }

    const hit = intersects.find(intersect => intersect.object?.userData?.spaceId);
    const spaceId = hit?.object?.userData?.spaceId;
    if (spaceId) {
      prepareFocusOnSphere(spaceId);
    }
  }
}

function getSpaceList() {
  return spacesData;
}

function updateConfirmText() {
  const confirmText = document.getElementById('confirmText');
  if (!confirmText) return;
  confirmText.innerText = '您是否决定进入此刻？';
}

function showConfirmOverlay() {
  const confirmOverlay = document.getElementById('confirmOverlay');
  if (!confirmOverlay) return;
  confirmOverlay.classList.add('visible');
  isConfirmVisible = true;
}

function hideConfirmOverlay() {
  const confirmOverlay = document.getElementById('confirmOverlay');
  if (!confirmOverlay) return;
  confirmOverlay.classList.remove('visible');
  isConfirmVisible = false;
}

function showSelector() {
  const selector = document.getElementById('selector');
  if (!selector) return;
  selector.classList.add('visible');
}

function hideSelector() {
  const selector = document.getElementById('selector');
  if (!selector) return;
  selector.classList.remove('visible');
}

function animateCameraTo(position, lookAt, duration = 900, keepDisabled = false) {
  return new Promise(resolve => {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = position.clone();
    const endTarget = lookAt.clone();
    const startTime = performance.now();
    controls.enabled = false;

    function update() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeT = t * t * (3 - 2 * t);

      camera.position.lerpVectors(startPos, endPos, easeT);
      controls.target.lerpVectors(startTarget, endTarget, easeT);
      camera.lookAt(controls.target);

      if (t < 1) {
        requestAnimationFrame(update);
      } else {
        if (!keepDisabled) {
          controls.enabled = true;
        }
        resolve();
      }
    }

    update();
  });
}

async function prepareFocusOnSphere(spaceId) {
  const space = getSpaceById(spaceId);
  if (!space) return;

  const targetSphere = getEntrySphereById(spaceId);
  if (!targetSphere) return;

  pendingSpaceId = spaceId;
  updateConfirmText(space);

  const direction = targetSphere.position.clone().normalize();
  const focusDistance = 5.2;
  const focusPosition = direction.multiplyScalar(focusDistance);
  focusPosition.y = 1.1;

  await animateCameraTo(focusPosition, targetSphere.position, 700, false);
  showConfirmOverlay();
}

async function confirmEnterSpace() {
  if (!pendingSpaceId) return;

  hideConfirmOverlay();
  const space = getSpaceById(pendingSpaceId);
  if (!space) return;

  currentSpaceId = pendingSpaceId;
  currentSpace = space;
  pendingSpaceId = null;
  updateBackButton();
  hideSelector();
  clearEntrySpheres(scene);
  createSphere(scene, space.panorama, space);  // 传递完整 space 对象
  setSpaceControls();
  controls.enabled = true;

  // 初始化音频系统（在用户手势后允许 AudioContext）
  audioManager.init();
  initBGMControl();
  ambienceManager.setAmbiences(space.audio?.ambiences || []);
  if (space.audio?.bgm) {
    try { audioManager.playBGM(space.audio.bgm); } catch (e) { console.warn('BGM play failed:', e); }
  }

  // 设置语音点/引导点点击事件
  setupVoiceGuidePointerEvents();

  // 注册泛光呼吸动画
  registerFrameCallback((time) => {
    updateGuidePointAnimations(time);
    updateVoicePointAnimations(time);
  });
}

async function cancelConfirm() {
  hideConfirmOverlay();
  pendingSpaceId = null;
  await animateCameraTo(selectionPosition, selectionTarget, 700, false);
}

async function enterSpace(id) {
  const space = getSpaceById(id);

  if (!space) {
    console.error('Space not found:', id);
    return;
  }

  currentSpaceId = id;
  currentSpace = space;
  updateBackButton();
  clearEntrySpheres(scene);
  createSphere(scene, space.panorama, space);
  hideSelector();
  setSpaceControls();
  controls.enabled = true;

  // 初始化音频系统
  audioManager.init();
  initBGMControl();
  ambienceManager.setAmbiences(space.audio?.ambiences || []);
  if (space.audio?.bgm) {
    try { audioManager.playBGM(space.audio.bgm); } catch (e) { console.warn('BGM play failed:', e); }
  }

  // 设置语音点/引导点点击事件
  setupVoiceGuidePointerEvents();
}

/** 创建靠近3D点的文本提示气泡 */
let tooltipEl = null;
let tooltipTimeout = null;

function showTooltip(text, screenX, screenY) {
  // 清除旧的
  hideTooltip();

  if (!text) return;

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: fixed;
    left: ${screenX}px;
    top: ${screenY - 10}px;
    transform: translate(-50%, -100%);
    z-index: 300;
    max-width: 260px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(15, 14, 29, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    color: #f2f3ff;
    font-size: 0.9rem;
    line-height: 1.5;
    pointer-events: auto;
    white-space: normal;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
  `;
  tooltip.innerHTML = `<p style="margin: 0;">${text}</p>`;
  document.body.appendChild(tooltip);

  requestAnimationFrame(() => {
    tooltip.style.opacity = '1';
  });

  tooltipEl = tooltip;
}

function hideTooltip() {
  clearTimeout(tooltipTimeout);
  if (tooltipEl) {
    tooltipEl.style.opacity = '0';
    setTimeout(() => {
      if (tooltipEl && tooltipEl.parentNode) {
        tooltipEl.remove();
      }
      tooltipEl = null;
    }, 250);
  }
}

/** 设置语音点和引导点的点击事件 */
function setupVoiceGuidePointerEvents() {
  // 清除旧的
  if (pointerDownListener) {
    renderer.domElement.removeEventListener('pointerdown', pointerDownListener);
  }

  const allObjects = [
    ...getGuidePointMeshes(),
    ...getVoicePointSprites(),
  ];

  pointerDownListener = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera({ x, y }, camera);
    const intersects = raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      // 如果点到的是光环，获取关联的 sprite/mesh
      const root = hit.userData?.parentMesh || hit.userData?.parentSprite || hit;
      const gp = root.userData?.guidePoint;
      const vp = root.userData?.voicePoint;
      const pointData = gp || vp;

      if (!pointData) return;

      // 获取 3D 点在屏幕上的位置（使用关联对象的实际位置）
      const targetPos = root.position || hit.parent?.position;
      if (!targetPos) return;
      const screenPos = new THREE.Vector3();
      screenPos.copy(targetPos);
      screenPos.project(camera);

      const sx = (screenPos.x * 0.5 + 0.5) * rect.width;
      const sy = (-screenPos.y * 0.5 + 0.5) * rect.height;

      // 显示文本提示
      showTooltip(pointData.text || '', sx, sy);

      // 语音点：播放关联的环境音
      if (vp && vp.file) {
        try {
          audioManager.playAmbience(vp.ambienceId, vp.file, 'center');
        } catch (e) {
          console.warn('Ambience play failed:', e);
        }
      }
    }
  };

  renderer.domElement.addEventListener('pointerdown', pointerDownListener);
}

export async function exitSpace() {
  // 停止背景音乐
  audioManager.stopBGM();
  audioManager.destroy();
  hideBGMControl();

  // 清除帧回调和提示气泡
  clearFrameCallbacks();
  hideTooltip();

  clearSphere(scene);
  currentSpaceId = null;
  updateBackButton();
  showSelector();
  resetCameraPosition(camera);
  controls.target.copy(selectionTarget);
  setSelectionControls();
  await animateCameraTo(selectionPosition, selectionTarget, 700, false);
  controls.enabled = true;
  createEntrySpheres(scene, getSpaceList());
}

init();