import * as THREE from 'three';
import { initScene } from './scene/scene.js';
import { loadSpaces, getSpaceById, setSpaces, saveCreatedSpaces, markSpaceDeleted } from './scene/loader.js';
import { createSphere, clearSphere } from './scene/sphere.js';
import {
  createEntrySpheres,
  clearEntrySpheres,
  getEntrySpheres,
  getEntrySphereById,
  resetCameraPosition,
} from './scene/entrySpheres.js';
import { renderSpaceMemorySelector } from './ui/spaceMemorySelector.js';
import { showAssociativePanel, hideAssociativePanel } from './ui/associativePanel.js';
import { createTextHotspot, clearHotspots } from './scene/textHotspot.js';
import { SpaceManager } from './scene/spaceManager.js';

let scene;
let camera;
let renderer;
let controls;
let raycaster;
let spacesData = [];
let currentSpaceId = null;
let isIntroVisible = true;
let isConfirmVisible = false;
let pendingSpaceId = null;
let currentRenameId = null;

const spaceManager = new SpaceManager();
let activePreview = null;

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
  renderSpaceMemorySelector(spacesData, prepareFocusOnSphere, openRenameOverlay, deleteSpace);
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
  const uploadHint = document.getElementById('uploadHint');

  if (!createButton || !uploadOverlay || !fileInput || !uploadButton || !cancelUploadBtn || !uploadHint) return;

  createButton.addEventListener('click', openUploadOverlay);

  fileInput.addEventListener('change', () => {
    const count = fileInput.files?.length || 0;
    uploadButton.disabled = count !== 1 && count !== 4;
    if (count === 1) {
      uploadButton.textContent = '上传并生成提问';
      uploadHint.textContent = '选择 1 张图片即可生成关联问题并创建空间。';
    } else if (count === 4) {
      uploadButton.textContent = 'AI 合成：生成提问';
      uploadHint.textContent = '选择 4 张图片由后端生成全景与联想问题。';
    } else {
      uploadButton.textContent = '上传并创建';
      uploadHint.textContent = '请选择 1 张或恰好 4 张图片。';
    }
  });

  uploadButton.addEventListener('click', async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length !== 1 && files.length !== 4) {
      alert('请选择 1 张或恰好 4 张图片。');
      return;
    }

    uploadButton.disabled = true;
    uploadButton.textContent = '处理中...';

    try {
      await uploadAndCreateSpace(files);
      hideUploadOverlay();
    } catch (err) {
      console.error(err);
      alert('上传失败，请稍后再试');
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = files.length === 4 ? 'AI 合成：生成提问' : '上传并生成提问';
    }
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

async function uploadPanorama(file) {
  const formData = new FormData();
  formData.append('panorama', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }

    const data = await res.json();
    if (data?.id && data?.panorama) {
      addSpace(data);
      return;
    }

    throw new Error('Invalid response from upload API');
  } catch (err) {
    console.warn('Upload API unavailable, using local preview', err);
    await createTemporarySpace(file);
  }
}

async function uploadAndCreateSpace(files) {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const uploadRes = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status}`);
  }

  const imageUrls = await uploadRes.json();
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error('Upload API returned no images');
  }

  const preview = await spaceManager.previewSpace(imageUrls);
  if (!preview || !preview.generatedImageUrl) {
    throw new Error('生成空间预览失败');
  }

  activePreview = {
    generatedImageUrl: preview.generatedImageUrl,
    questions: preview.questions || [],
  };

  showAssociativePanel(activePreview.questions, async (spaceName, answeredQuestions) => {
    await finalizeSpace(spaceName, answeredQuestions);
  }, () => {
    activePreview = null;
  });
}

async function finalizeSpace(name, answeredQuestions) {
  if (!activePreview) return;
  const created = await spaceManager.createNewSpace(name, activePreview.generatedImageUrl, answeredQuestions);
  const normalized = {
    id: created.id,
    panorama: created.generatedImageUrl,
    label: created.name,
    questions: created.questions,
    isSaved: true,
    isBackend: true,
  };
  addSpace(normalized);
  await enterSpace(normalized.id);
}

function addSpace(space) {
  const exists = spacesData.some(item => item.id === space.id);
  const normalizedSpace = {
    ...space,
    panorama: space.panorama || space.generatedImageUrl,
    label: space.label || space.name || space.id,
    isSaved: true,
  };

  if (!exists) {
    spacesData.push(normalizedSpace);
  } else {
    spacesData = spacesData.map(item => item.id === normalizedSpace.id ? normalizedSpace : item);
  }

  setSpaces(spacesData);
  saveCreatedSpaces(spacesData);
  refreshSpaces();
}

function renameSpace(id, label) {
  const space = getSpaceById(id);
  if (!space) return;

  space.label = label;
  space.isSaved = true;
  setSpaces(spacesData);
  saveCreatedSpaces(spacesData);
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

  if (pendingSpaceId === id) {
    pendingSpaceId = null;
    hideConfirmOverlay();
  }
  refreshSpaces();
}

function refreshSpaces() {
  renderSpaceMemorySelector(spacesData, prepareFocusOnSphere, openRenameOverlay, deleteSpace);
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
  pendingSpaceId = null;
  updateBackButton();
  hideSelector();
  clearEntrySpheres(scene);
  clearHotspots();
  createSphere(scene, space.panorama);
  if (Array.isArray(space.questions)) {
    space.questions.forEach(q => createTextHotspot(q));
  }
  setSpaceControls();
  controls.enabled = true;
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
  updateBackButton();
  clearEntrySpheres(scene);
  clearHotspots();
  createSphere(scene, space.panorama);
  if (Array.isArray(space.questions)) {
    space.questions.forEach(q => createTextHotspot(q));
  }
  hideSelector();
  setSpaceControls();
  controls.enabled = true;
}

export async function exitSpace() {
  clearSphere(scene);
  clearHotspots();
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