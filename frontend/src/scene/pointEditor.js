/**
 * pointEditor.js — 3D 交互点编辑模块
 * 在 3D 空间中拖动交互点修改位置，实时显示文本标签
 */

import * as THREE from 'three';
import { createGuidePoints } from './guidePoints.js';
import { createVoicePoints } from './voicePoints.js';

// 编辑状态
let isEditingMode = false;
let selectedPoint = null;  // 当前选中的交互点
let raycaster = null;
let camera = null;
let renderer = null;
let scene = null;
let plane = null;  // 拖拽平面
let lastMousePos = null;
let pointLabels = new Map();  // 点ID -> 标签DOM

// 鼠标事件监听
let onPointerDown = null;
let onPointerMove = null;
let onPointerUp = null;

/**
 * 初始化点编辑器
 */
export function initPointEditor(sceneObj, cameraObj, rendererObj) {
  if (!sceneObj || !cameraObj || !rendererObj) {
    console.error('❌ pointEditor: 缺少场景、摄像机或渲染器');
    return;
  }

  scene = sceneObj;
  camera = cameraObj;
  renderer = rendererObj;
  raycaster = new THREE.Raycaster();

  // 创建拖拽参考平面（不可见）
  const planeGeometry = new THREE.PlaneGeometry(100, 100);
  const planeMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  plane = new THREE.Mesh(planeGeometry, planeMaterial);
  scene.add(plane);
}

// 相机位置缓存
let savedCameraPosition = null;
let savedControlsTarget = null;

/**
 * 将相机移动到球体内部中心
 * 这样用户可以在球体内部看到所有引导点/语音点，便于编辑
 */
function moveCameraToSphereInterior() {
  if (!camera) return;
  savedCameraPosition = camera.position.clone();
  savedControlsTarget = null; // 由外部 controls 自行处理
  // 移动到球心附近，面向 -Z 方向（与默认相机朝向一致）
  camera.position.set(0, 1.2, 0);
  camera.lookAt(0, 1.2, -1);
  console.log('📷 相机已移至球体内部');
}

/**
 * 恢复相机到之前的位置
 */
export function restoreCameraPosition() {
  if (!camera || !savedCameraPosition) return;
  camera.position.copy(savedCameraPosition);
  camera.lookAt(0, 1.2, -1);
  console.log('📷 相机已恢复');
  savedCameraPosition = null;
}

/**
 * 确保场景中存在对应的引导点/语音点
 * 当场景已被清除（如 exitSpace）时，需要从数据重建场景中的点，
 * 这样才能让用户在 3D 空间中拖动编辑位置。
 */
function ensurePointsInScene(points, pointType) {
  if (!points || points.length === 0) return;

  // 检查场景中是否已有对应类型的点
  const existingIds = new Set();
  scene.children.forEach(child => {
    if (pointType === 'guide' && child.userData.guidePoint) {
      existingIds.add(child.userData.guidePoint.id);
    }
    if (pointType === 'voice' && child.userData.voicePoint) {
      existingIds.add(child.userData.voicePoint.id);
    }
  });

  // 找出场景中缺失的点
  const missingPoints = points.filter(p => !existingIds.has(p.id));
  if (missingPoints.length === 0) return;

  console.log(`🔧 场景中没有 ${pointType} 点，从数据重建 ${missingPoints.length} 个`);

  if (pointType === 'guide') {
    createGuidePoints(scene, missingPoints);
  } else {
    createVoicePoints(scene, missingPoints);
  }
}

/**
 * 进入编辑模式
 * @param {Object} space - 空间对象
 * @param {Array} pointsToEdit - 要编辑的点数组 (guidePoints 或 voicePoints)
 * @param {String} pointType - 点的类型 ('guide' 或 'voice')
 * @param {Function} onPointsChanged - 位置改变时的回调
 */
export function enterEditMode(space, pointsToEdit, pointType, onPointsChanged) {
  if (!scene || !camera || !renderer) {
    console.error('❌ pointEditor: 编辑器未初始化');
    return;
  }

  isEditingMode = true;

  console.log(`📝 进入编辑模式: ${pointType}点`, pointsToEdit);

  // 将相机移动到球体内部中心，方便用户看到并交互所有引导点
  moveCameraToSphereInterior();

  // 如果场景中没有对应的引导点/语音点（例如用户从入口页面打开编辑器，
  // 而场景已被 exitSpace 清除），则需要从数据重建场景中的点
  ensurePointsInScene(pointsToEdit, pointType);

  // 显示文本标签
  showPointLabels(pointsToEdit, pointType);

  // 设置鼠标事件
  setupEditModeEvents(pointsToEdit, pointType, onPointsChanged);

  // 更新所有点的视觉效果（高亮）
  highlightPointsForEditing(pointsToEdit, pointType);
}

/**
 * 退出编辑模式
 */
export function exitEditMode() {
  if (!isEditingMode) return;

  isEditingMode = false;
  selectedPoint = null;

  // 恢复相机位置
  restoreCameraPosition();

  // 隐藏所有文本标签
  pointLabels.forEach((entry) => {
    if (entry.element.parentNode) entry.element.parentNode.removeChild(entry.element);
  });
  pointLabels.clear();

  // 移除事件监听
  if (onPointerDown) renderer.domElement.removeEventListener('pointerdown', onPointerDown);
  if (onPointerMove) renderer.domElement.removeEventListener('pointermove', onPointerMove);
  if (onPointerUp) renderer.domElement.removeEventListener('pointerup', onPointerUp);

  console.log('✅ 已退出编辑模式');
}

/**
 * 显示文本标签
 */
function showPointLabels(points, pointType) {
  points.forEach(point => {
    const label = document.createElement('div');
    label.className = 'point-label';
    label.style.cssText = `
      position: fixed;
      background: rgba(${pointType === 'guide' ? '255, 107, 157' : '107, 142, 255'}, 0.9);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.5);
      white-space: nowrap;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    label.textContent = point.text || `${pointType === 'guide' ? '引导点' : '语音点'} #${point.id.slice(0, 6)}`;
    
    document.body.appendChild(label);
    pointLabels.set(point.id, { element: label, type: pointType });
  });

  // 启动标签位置更新
  updatePointLabelsPosition();
}

/**
 * 更新标签位置（跟随3D点）
 */
function updatePointLabelsPosition() {
  if (!isEditingMode || pointLabels.size === 0) return;

  const updateLabelPositions = () => {
    pointLabels.forEach((entry, pointId) => {
      const type = entry?.type || 'guide';
      const obj = findPointInScene(pointId, type);
      if (obj && obj.position) {
        const screenPos = new THREE.Vector3();
        screenPos.copy(obj.position);
        screenPos.project(camera);

        const width = renderer.domElement.clientWidth;
        const height = renderer.domElement.clientHeight;

        const x = (screenPos.x * width) / 2 + width / 2;
        const y = -(screenPos.y * height) / 2 + height / 2;

        const label = entry.element;
        label.style.left = (x - label.offsetWidth / 2) + 'px';
        label.style.top = (y - 30) + 'px';  // 显示在点上方
      }
    });

    if (isEditingMode) {
      requestAnimationFrame(updateLabelPositions);
    }
  };

  updateLabelPositions();
}

/**
 * 高亮编辑中的点
 */
function highlightPointsForEditing(points, pointType) {
  points.forEach(point => {
    // 在scene中查找对应的mesh/sprite对象
    // 这里假设userData中有相关信息
    const foundObject = findPointInScene(point.id, pointType);
    if (foundObject) {
      // 标记为编辑模式
      foundObject.userData.isEditMode = true;
      
      // 如果是mesh（引导点），改变材质
      if (foundObject.isMesh && foundObject.geometry.type === 'SphereGeometry') {
        foundObject.material.color.setHex(0xff6b9d);  // 粉红色
        foundObject.material.emissive.setHex(0xff1493);
        foundObject.material.emissiveIntensity = 1.2;
      }
    }
  });
}

/**
 * 在scene中查找点
 */
function findPointInScene(pointId, pointType) {
  for (let obj of scene.children) {
    if (pointType === 'guide' && obj.userData.guidePoint?.id === pointId) {
      return obj;
    }
    if (pointType === 'voice' && obj.userData.voicePoint?.id === pointId) {
      return obj;
    }
  }
  return null;
}

/**
 * 设置编辑模式的鼠标事件
 */
function setupEditModeEvents(points, pointType, onPointsChanged) {
  // 建立 ID → 数据对象的映射（points 是 currentEditingSpace.audio.xxx 的引用）
  const idToData = new Map();
  points.forEach(p => {
    idToData.set(p.id, p);
  });

  onPointerDown = (event) => {
    if (!isEditingMode) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera({ x, y }, camera);

    // 检测点击的点
    const targetObjects = points.map(p => findPointInScene(p.id, pointType)).filter(o => o);
    const intersects = raycaster.intersectObjects(targetObjects);

    if (intersects.length > 0) {
      const clickedObj = intersects[0].object;
      const pointId = pointType === 'guide' ? clickedObj.userData.guidePoint?.id : clickedObj.userData.voicePoint?.id;
      // 通过 ID 直接从 points 数组中找到正确的数据对象
      const pointData = idToData.get(pointId);

      selectedPoint = {
        object: clickedObj,
        data: pointData,
        type: pointType,
        originalPos: clickedObj.position.clone(),
      };

      // 更新拖拽平面的位置
      plane.position.copy(clickedObj.position);
      plane.quaternion.copy(camera.quaternion);

      lastMousePos = { x: event.clientX, y: event.clientY };

      console.log(`✋ 选中${pointType === 'guide' ? '引导' : '语音'}点:`, selectedPoint.data?.text || pointId);
    }
  };

  onPointerMove = (event) => {
    if (!selectedPoint || !isEditingMode) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera({ x, y }, camera);

    // 与平面相交，得到新位置
    const intersects = raycaster.intersectObject(plane);
    if (intersects.length > 0) {
      const newPos = intersects[0].point;
      selectedPoint.object.position.copy(newPos);

      // 同时移动光环
      const ring = scene.children.find(obj => obj.userData.parentMesh === selectedPoint.object || obj.userData.parentSprite === selectedPoint.object);
      if (ring) {
        ring.position.copy(newPos);
      }

      // 更新数据
      selectedPoint.data.position = [newPos.x, newPos.y, newPos.z];

      // 触发回调
      onPointsChanged?.(points);
    }
  };

  onPointerUp = (event) => {
    if (selectedPoint) {
      console.log(`✅ 位置已更新:`, selectedPoint.data.position);
      selectedPoint = null;
    }
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
}

/**
 * 是否正在编辑
 */
export function isInEditMode() {
  return isEditingMode;
}

/**
 * 获取所有点的当前位置
 */
export function getUpdatedPoints(points) {
  return points.map(p => ({
    ...p,
    position: findPointInScene(p.id, p.type)?.position.toArray() || p.position,
  }));
}
