/**
 * SpaceEditor - 空间编辑面板
 * 允许编辑空间内的环境音、背景音乐、引导点和语音点
 */

import { getSpaceById, updateSpace, saveCreatedSpaces } from '../scene/loader.js';
import { initPointEditor, enterEditMode, exitEditMode, isInEditMode } from '../scene/pointEditor.js';

/** 将文件转换为 DataURL */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let currentEditingSpace = null;
let editorContainer = null;
let pointEditorInitialized = false;

// 3D上下文引用（由main.js注册）
let sceneContext = null;

/**
 * 注册3D上下文（由main.js在initSpaceEditor时调用）
 */
export function register3DContext(scene, camera, renderer) {
  sceneContext = { scene, camera, renderer };
  if (pointEditorInitialized === false) {
    initPointEditor(scene, camera, renderer);
    pointEditorInitialized = true;
  }
}

/** 初始化编辑器 */
export function initSpaceEditor() {
  editorContainer = document.getElementById('spaceEditor');
  if (!editorContainer) {
    createEditorContainer();
  }
}

/** 创建编辑器容器 */
function createEditorContainer() {
  const container = document.createElement('div');
  container.id = 'spaceEditor';
  container.className = 'space-editor hidden';
  container.innerHTML = `
    <div class="editor-overlay"></div>
    <div class="editor-panel">
      <div class="editor-header">
        <h2>编辑空间</h2>
        <button class="editor-close-btn" id="editorCloseBtn">✕</button>
      </div>
      
      <div class="editor-content">
        <div class="editor-section">
          <h3>🎵 背景音乐 (BGM)</h3>
          <div class="editor-row">
            <label>当前：<span id="currentBGM">未设置</span></label>
            <input type="file" id="bgmUpload" accept="audio/*" />
            <button id="bgmUploadBtn" class="editor-btn">上传背景音乐</button>
            <button id="bgmClearBtn" class="editor-btn btn-danger">清除</button>
          </div>
        </div>

        <div class="editor-section">
          <h3>🌍 环境音效 (按方向)</h3>
          <div id="ambiencesContainer"></div>
          <button id="addAmbienceBtn" class="editor-btn btn-primary">+ 添加环境音</button>
        </div>

        <div class="editor-section">
          <h3>💬 引导点</h3>
          <div id="guidePointsContainer"></div>
          <button id="addGuidePointBtn" class="editor-btn btn-primary">+ 添加引导点</button>
        </div>

        <div class="editor-section">
          <h3>🔊 语音点</h3>
          <div id="voicePointsContainer"></div>
          <button id="addVoicePointBtn" class="editor-btn btn-primary">+ 添加语音点</button>
        </div>
      </div>

      <div class="editor-footer">
        <button id="editorSaveBtn" class="editor-btn btn-success">💾 保存</button>
        <button id="editorCancelBtn" class="editor-btn">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  editorContainer = container;
  setupEditorEvents();
}

/** 打开编辑器 */
export function openSpaceEditor(spaceId) {
  const space = getSpaceById(spaceId);
  if (!space) {
    console.error('Space not found:', spaceId);
    return;
  }

  currentEditingSpace = JSON.parse(JSON.stringify(space)); // 深拷贝
  editorContainer.classList.remove('hidden');
  renderEditorContent();
}

/** 关闭编辑器 */
export function closeSpaceEditor() {
  editorContainer.classList.add('hidden');
  currentEditingSpace = null;
}

/** 渲染编辑器内容 */
function renderEditorContent() {
  if (!currentEditingSpace) return;

  const space = currentEditingSpace;

  // 背景音乐
  const bgmSpan = document.getElementById('currentBGM');
  bgmSpan.textContent = space.audio?.bgm ? space.audio.bgm.split('/').pop() : '未设置';

  // 环境音
  renderAmbiences();

  // 引导点
  renderGuidePoints();

  // 语音点
  renderVoicePoints();
}

/** 渲染环境音 */
function renderAmbiences() {
  const container = document.getElementById('ambiencesContainer');
  container.innerHTML = '';

  const ambiences = currentEditingSpace.audio?.ambiences || [];
  const sectors = ['north', 'south', 'east', 'west'];

  sectors.forEach(sector => {
    const ambience = ambiences.find(a => a.sector === sector);
    const div = document.createElement('div');
    div.className = 'ambience-item';
    div.innerHTML = `
      <div class="ambience-header">
        <h4>${sector.toUpperCase()} (${sector})</h4>
        ${ambience ? `<span class="file-name">${ambience.fileName || ambience.file.substring(0, 30)}</span>` : '<span class="file-name">未设置</span>'}
      </div>
      <div class="ambience-controls">
        <input type="file" accept="audio/*" class="ambience-upload" data-sector="${sector}" />
        <button class="editor-btn ambience-upload-btn" data-sector="${sector}">上传</button>
        <input type="text" class="ambience-text" data-sector="${sector}" placeholder="环境音文本描述" value="${ambience?.text || ''}" />
        ${ambience ? `<button class="editor-btn btn-danger ambience-delete-btn" data-sector="${sector}">删除</button>` : ''}
      </div>
    `;
    container.appendChild(div);
  });
}

/** 渲染引导点 */
function renderGuidePoints() {
  const container = document.getElementById('guidePointsContainer');
  container.innerHTML = '';

  const guidePoints = currentEditingSpace.audio?.guidePoints || [];

  guidePoints.forEach((gp, index) => {
    const div = document.createElement('div');
    div.className = 'point-item guide-point-item';
    div.innerHTML = `
      <div class="point-header">
        <h4>引导点 ${index + 1}</h4>
        <div class="point-header-buttons">
          <button class="editor-btn btn-edit" data-gp-edit="${index}" title="在3D空间中编辑位置">📍 编辑位置</button>
          <button class="editor-btn btn-danger" data-gp-delete="${index}">删除</button>
        </div>
      </div>
      <div class="point-controls">
        <label>位置: <code>[${gp.position ? gp.position.map(v => v.toFixed(2)).join(', ') : '0.00, 0.00, 0.00'}]</code></label>
        <textarea class="point-text" data-gp-index="${index}" placeholder="引导点文本内容">${gp.text || ''}</textarea>
        <select class="point-ambience" data-gp-index="${index}">
          <option value="">-- 不关联环境音 --</option>
          ${(currentEditingSpace.audio?.ambiences || []).map(a => `
            <option value="${a.id}" ${gp.ambienceId === a.id ? 'selected' : ''}>
              ${a.sector}: ${a.text}
            </option>
          `).join('')}
        </select>
      </div>
    `;
    container.appendChild(div);
  });
}

/** 渲染语音点 */
function renderVoicePoints() {
  const container = document.getElementById('voicePointsContainer');
  container.innerHTML = '';

  const voicePoints = currentEditingSpace.audio?.voicePoints || [];

  voicePoints.forEach((vp, index) => {
    const div = document.createElement('div');
    div.className = 'point-item voice-point-item';
    div.innerHTML = `
      <div class="point-header">
        <h4>语音点 ${index + 1}</h4>
        <div class="point-header-buttons">
          <button class="editor-btn btn-edit" data-vp-edit="${index}" title="在3D空间中编辑位置">📍 编辑位置</button>
          <button class="editor-btn btn-danger" data-vp-delete="${index}">删除</button>
        </div>
      </div>
      <div class="point-controls">
        <label>位置: <code>[${vp.position ? vp.position.map(v => v.toFixed(2)).join(', ') : '0.00, 0.00, 0.00'}]</code></label>
        <textarea class="point-text" data-vp-index="${index}" placeholder="语音点文本内容">${vp.text || ''}</textarea>
        <select class="point-ambience" data-vp-index="${index}">
          <option value="">-- 不关联环境音 --</option>
          ${(currentEditingSpace.audio?.ambiences || []).map(a => `
            <option value="${a.id}" ${vp.ambienceId === a.id ? 'selected' : ''}>
              ${a.sector}: ${a.text}
            </option>
          `).join('')}
        </select>
      </div>
    `;
    container.appendChild(div);
  });
}

/** 设置编辑器事件 */
function setupEditorEvents() {
  // 关闭按钮
  document.getElementById('editorCloseBtn').addEventListener('click', closeSpaceEditor);
  document.getElementById('editorCancelBtn').addEventListener('click', closeSpaceEditor);

  // 保存按钮
  document.getElementById('editorSaveBtn').addEventListener('click', saveEditorChanges);

  // 背景音乐上传
  document.getElementById('bgmUploadBtn').addEventListener('click', () => {
    document.getElementById('bgmUpload').click();
  });

  document.getElementById('bgmUpload').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const audioUrl = await fileToDataURL(file);
        currentEditingSpace.audio = currentEditingSpace.audio || {};
        currentEditingSpace.audio.bgm = audioUrl;
        document.getElementById('currentBGM').textContent = file.name;
        console.log('✅ BGM文件已加载:', file.name);
      } catch (err) {
        alert('❌ 文件读取失败: ' + err.message);
      }
    }
  });

  // 背景音乐清除
  document.getElementById('bgmClearBtn').addEventListener('click', () => {
    if (currentEditingSpace.audio) {
      currentEditingSpace.audio.bgm = '';
    }
    document.getElementById('currentBGM').textContent = '未设置';
  });

  // 环境音委托事件
  document.getElementById('ambiencesContainer').addEventListener('click', (e) => {
    if (e.target.classList.contains('ambience-upload-btn')) {
      const sector = e.target.dataset.sector;
      const input = document.querySelector(`.ambience-upload[data-sector="${sector}"]`);
      input.click();
    } else if (e.target.classList.contains('ambience-delete-btn')) {
      const sector = e.target.dataset.sector;
      deleteAmbience(sector);
      renderAmbiences();
    }
  });

  document.getElementById('ambiencesContainer').addEventListener('change', async (e) => {
    if (e.target.classList.contains('ambience-upload')) {
      const file = e.target.files?.[0];
      const sector = e.target.dataset.sector;
      if (file) {
        try {
          const audioUrl = await fileToDataURL(file);
          addOrUpdateAmbience(sector, audioUrl, file.name);
          renderAmbiences();
          console.log('✅ 环境音已加载:', sector, file.name);
        } catch (err) {
          alert('❌ 文件读取失败: ' + err.message);
        }
      }
    } else if (e.target.classList.contains('ambience-text')) {
      const sector = e.target.dataset.sector;
      const text = e.target.value;
      updateAmbienceText(sector, text);
    }
  });

  // 引导点事件
  document.getElementById('addGuidePointBtn').addEventListener('click', () => {
    addGuidePoint();
    renderGuidePoints();
  });

  document.getElementById('guidePointsContainer').addEventListener('click', (e) => {
    if (e.target.dataset.gpDelete !== undefined) {
      const index = parseInt(e.target.dataset.gpDelete);
      deleteGuidePoint(index);
      renderGuidePoints();
    } else if (e.target.dataset.gpEdit !== undefined) {
      // ✅ 编辑位置
      const index = parseInt(e.target.dataset.gpEdit);
      editGuidePointPosition(index);
    }
  });

  document.getElementById('guidePointsContainer').addEventListener('change', (e) => {
    const index = e.target.dataset.gpIndex;
    if (index !== undefined) {
      if (e.target.classList.contains('point-text')) {
        currentEditingSpace.audio.guidePoints[index].text = e.target.value;
      } else if (e.target.classList.contains('point-ambience')) {
        currentEditingSpace.audio.guidePoints[index].ambienceId = e.target.value;
      }
    }
  });

  // 语音点事件
  document.getElementById('addVoicePointBtn').addEventListener('click', () => {
    addVoicePoint();
    renderVoicePoints();
  });

  document.getElementById('voicePointsContainer').addEventListener('click', (e) => {
    if (e.target.dataset.vpDelete !== undefined) {
      const index = parseInt(e.target.dataset.vpDelete);
      deleteVoicePoint(index);
      renderVoicePoints();
    } else if (e.target.dataset.vpEdit !== undefined) {
      // ✅ 编辑位置
      const index = parseInt(e.target.dataset.vpEdit);
      editVoicePointPosition(index);
    }
  });

  document.getElementById('voicePointsContainer').addEventListener('change', (e) => {
    const index = e.target.dataset.vpIndex;
    if (index !== undefined) {
      if (e.target.classList.contains('point-text')) {
        currentEditingSpace.audio.voicePoints[index].text = e.target.value;
      } else if (e.target.classList.contains('point-ambience')) {
        currentEditingSpace.audio.voicePoints[index].ambienceId = e.target.value;
      }
    }
  });
}

/** 添加或更新环境音 */
function addOrUpdateAmbience(sector, audioDataUrl, fileName) {
  currentEditingSpace.audio = currentEditingSpace.audio || {};
  currentEditingSpace.audio.ambiences = currentEditingSpace.audio.ambiences || [];

  const index = currentEditingSpace.audio.ambiences.findIndex(a => a.sector === sector);

  if (index >= 0) {
    currentEditingSpace.audio.ambiences[index].file = audioDataUrl;
    // 从fileName提取显示名称
    if (fileName) {
      currentEditingSpace.audio.ambiences[index].fileName = fileName;
    }
  } else {
    currentEditingSpace.audio.ambiences.push({
      id: `amb-${sector}-${Date.now()}`,
      sector,
      file: audioDataUrl,
      fileName: fileName || 'audio',
      text: `${sector}环境音`,
    });
  }
}

/** 更新环境音文本 */
function updateAmbienceText(sector, text) {
  const ambience = currentEditingSpace.audio?.ambiences?.find(a => a.sector === sector);
  if (ambience) {
    ambience.text = text;
  }
}

/** 删除环境音 */
function deleteAmbience(sector) {
  if (currentEditingSpace.audio?.ambiences) {
    currentEditingSpace.audio.ambiences = currentEditingSpace.audio.ambiences.filter(a => a.sector !== sector);
  }
}

/** 添加引导点 */
function addGuidePoint() {
  currentEditingSpace.audio = currentEditingSpace.audio || {};
  currentEditingSpace.audio.guidePoints = currentEditingSpace.audio.guidePoints || [];

  currentEditingSpace.audio.guidePoints.push({
    id: `gp-${Date.now()}`,
    position: [0, 1.2, -2],
    text: '新的引导点',
    ambienceId: '',
  });
}

/** 删除引导点 */
function deleteGuidePoint(index) {
  if (currentEditingSpace.audio?.guidePoints) {
    currentEditingSpace.audio.guidePoints.splice(index, 1);
  }
}

/** 添加语音点 */
function addVoicePoint() {
  currentEditingSpace.audio = currentEditingSpace.audio || {};
  currentEditingSpace.audio.voicePoints = currentEditingSpace.audio.voicePoints || [];

  currentEditingSpace.audio.voicePoints.push({
    id: `vp-${Date.now()}`,
    position: [0, 1.5, -3],
    text: '新的语音点',
    ambienceId: '',
  });
}

/** 删除语音点 */
function deleteVoicePoint(index) {
  if (currentEditingSpace.audio?.voicePoints) {
    currentEditingSpace.audio.voicePoints.splice(index, 1);
  }
}

/** ✅ 编辑引导点位置 */
function editGuidePointPosition(index) {
  if (!sceneContext) {
    alert('❌ 3D场景未初始化，无法编辑位置');
    return;
  }

  const points = currentEditingSpace.audio?.guidePoints;
  if (!points || !points[index]) {
    alert('❌ 引导点不存在');
    return;
  }

  // 隐藏编辑器面板
  document.getElementById('spaceEditor').classList.add('hidden');

  console.log('📍 进入3D编辑模式: 引导点');

  // 进入编辑模式
  enterEditMode(
    currentEditingSpace,
    points,
    'guide',
    (updatedPoints) => {
      // 位置改变时的回调
      currentEditingSpace.audio.guidePoints = updatedPoints;
      console.log('📍 引导点位置已更新');
    }
  );

  // 添加返回编辑器的UI提示
  const hint = document.createElement('div');
  hint.id = 'edit-mode-hint';
  hint.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 107, 157, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 20px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(255, 107, 157, 0.4);
  `;
  hint.textContent = '📍 在3D空间中拖动点修改位置 | 按 ESC 完成编辑';
  document.body.appendChild(hint);

  // ESC键返回编辑器
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      finishPointEditing();
    }
  };
  document.addEventListener('keydown', handleEscape);

  // 保存便利函数以便稍后移除
  window._editModeCleanup = () => {
    document.removeEventListener('keydown', handleEscape);
    if (hint.parentNode) hint.parentNode.removeChild(hint);
  };
}

/** ✅ 编辑语音点位置 */
function editVoicePointPosition(index) {
  if (!sceneContext) {
    alert('❌ 3D场景未初始化，无法编辑位置');
    return;
  }

  const points = currentEditingSpace.audio?.voicePoints;
  if (!points || !points[index]) {
    alert('❌ 语音点不存在');
    return;
  }

  // 隐藏编辑器面板
  document.getElementById('spaceEditor').classList.add('hidden');

  console.log('📍 进入3D编辑模式: 语音点');

  // 进入编辑模式
  enterEditMode(
    currentEditingSpace,
    points,
    'voice',
    (updatedPoints) => {
      // 位置改变时的回调
      currentEditingSpace.audio.voicePoints = updatedPoints;
      console.log('📍 语音点位置已更新');
    }
  );

  // 添加返回编辑器的UI提示
  const hint = document.createElement('div');
  hint.id = 'edit-mode-hint';
  hint.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(102, 255, 153, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 20px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(102, 255, 153, 0.4);
  `;
  hint.textContent = '🔊 在3D空间中拖动点修改位置 | 按 ESC 完成编辑';
  document.body.appendChild(hint);

  // ESC键返回编辑器
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      finishPointEditing();
    }
  };
  document.addEventListener('keydown', handleEscape);

  // 保存便利函数以便稍后移除
  window._editModeCleanup = () => {
    document.removeEventListener('keydown', handleEscape);
    if (hint.parentNode) hint.parentNode.removeChild(hint);
  };
}

/** ✅ 完成点编辑并返回编辑器 */
function finishPointEditing() {
  console.log('✅ 完成位置编辑');

  // 清理编辑模式
  exitEditMode();

  // 保存位置变更到 localStorage
  if (currentEditingSpace) {
    updateSpace(currentEditingSpace);
  }

  // 清理UI提示
  if (window._editModeCleanup) {
    window._editModeCleanup();
    delete window._editModeCleanup;
  }

  // 显示编辑器面板
  document.getElementById('spaceEditor').classList.remove('hidden');

  // 重新渲染交互点列表，显示更新的位置
  renderGuidePoints();
  renderVoicePoints();
}

/** 保存编辑器改动 */
async function saveEditorChanges() {
  if (!currentEditingSpace) return;

  try {
    // 确保audio对象完整
    if (!currentEditingSpace.audio) {
      currentEditingSpace.audio = {
        bgm: '',
        ambiences: [],
        guidePoints: [],
        voicePoints: [],
      };
    }

    // 标记为已保存，确保能被持久化
    currentEditingSpace.isSaved = true;

    updateSpace(currentEditingSpace);
    
    console.log('✅ 空间已保存:', currentEditingSpace);
    alert('✅ 空间数据已保存！');
    closeSpaceEditor();
  } catch (err) {
    console.error('Save error:', err);
    alert('❌ 保存失败: ' + err.message);
  }
}

export { currentEditingSpace };
