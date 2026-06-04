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
import { renderSelector } from './ui/selector.js';

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
  renderSelector(spacesData, prepareFocusOnSphere, openRenameOverlay, deleteSpace);
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
    uploadButton.disabled = !fileInput.files?.length;
  });

  uploadButton.addEventListener('click', async () => {
    if (!fileInput.files?.length) return;
    uploadButton.disabled = true;
    uploadButton.textContent = '上传中...';

    try {
      await uploadPanorama(fileInput.files[0]);
      hideUploadOverlay();
    } catch (err) {
      console.error(err);
      alert('上传失败，请稍后再试');
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = '上传并创建';
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
    const res = await fetch('/api/spaces/upload', {
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
  pendingSpaceId = null;
  updateBackButton();
  hideSelector();
  clearEntrySpheres(scene);
  createSphere(scene, space.panorama);
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
  createSphere(scene, space.panorama);
  hideSelector();
  setSpaceControls();
  controls.enabled = true;
}

export async function exitSpace() {
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