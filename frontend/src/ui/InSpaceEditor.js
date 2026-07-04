/**
 * InSpaceEditor — 球内空间编辑器（双栏：环境音 + 互动点）
 * 用户在空间球内部编辑所有音频和互动点：
 *   🎵 环境音：背景音乐、主环境音、四方向环境音
 *   📍 互动点：引导点（问题+触发音）、语音点（触发音）
 */

import * as THREE from 'three';
import { updateSpace, syncSpaceToBackend } from '../scene/loader.js';
import { createGuidePoints, clearGuidePoints } from '../scene/guidePoints.js';
import { createVoicePoints, clearVoicePoints } from '../scene/voicePoints.js';
import { getCurrentSphereMesh } from '../scene/sphere.js';
import audioManager from '../audio/AudioManager.js';
import ambienceManager from '../audio/AmbienceManager.js';

let editorPanel = null;
let isOpen = false;
let currentSpace = null;
let sceneRef = null;
let cameraRef = null;
let rendererRef = null;
let raycaster = null;
let placementMode = null;
let onPointsChanged = null;
let activeTab = 'audio'; // 'audio' | 'interact'

// ==================== 初始化 ====================

export function initInSpaceEditor(scene, camera, renderer) {
  sceneRef = scene;
  cameraRef = camera;
  rendererRef = renderer;
  raycaster = new THREE.Raycaster();

  if (!document.getElementById('inSpaceEditor')) {
    createEditorUI();
  }
}

function createEditorUI() {
  // 浮动触发按钮
  const trigger = document.createElement('button');
  trigger.id = 'inSpaceEditorTrigger';
  trigger.innerHTML = '✦';
  trigger.title = '编辑空间';
  Object.assign(trigger.style, {
    position: 'fixed', bottom: '30px', right: '30px', zIndex: '200',
    width: '50px', height: '50px', borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,107,157,0.25)',
    backdropFilter: 'blur(10px)',
    color: '#fff', fontSize: '22px', cursor: 'pointer',
    display: 'none',
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 32px rgba(255,107,157,0.3)',
  });
  trigger.addEventListener('click', togglePanel);
  document.body.appendChild(trigger);

  // 编辑面板
  const panel = document.createElement('div');
  panel.id = 'inSpaceEditor';
  Object.assign(panel.style, {
    position: 'fixed', top: '0', right: '-420px', width: '400px',
    height: '100vh', zIndex: '250',
    background: 'rgba(15,14,29,0.96)',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(20px)',
    transition: 'right 0.35s ease',
    overflowY: 'auto',
    color: '#eef0ff',
    fontFamily: 'system-ui, sans-serif',
    padding: '0',
  });
  panel.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;font-size:1.05rem;">✦ 空间编辑器</h3>
      <button id="inSpaceEditorClose" style="background:none;border:none;color:#aaa;font-size:1.3rem;cursor:pointer;">✕</button>
    </div>
    <!-- Tab 切换 -->
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);">
      <button id="tabAudio" class="inspace-tab inspace-tab-active" style="flex:1;padding:12px;border:none;background:rgba(255,255,255,0.06);color:#eef0ff;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">🎵 环境音</button>
      <button id="tabInteract" class="inspace-tab" style="flex:1;padding:12px;border:none;background:transparent;color:#888;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">📍 互动点</button>
    </div>
    <!-- 🎵 环境音面板 -->
    <div id="tabAudioPanel" style="padding:20px;">
      ${buildAudioPanel()}
    </div>
    <!-- 📍 互动点面板 -->
    <div id="tabInteractPanel" style="padding:20px;display:none;">
      ${buildInteractPanel()}
    </div>
    <!-- 底部保存 -->
    <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,0.08);">
      <button id="inSpaceSaveBtn" style="width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff6b9d,#c44dff);color:#fff;font-size:1rem;font-weight:bold;cursor:pointer;">💾 保存所有更改</button>
    </div>
    <div id="inSpacePlaceHint" style="display:none;margin:0 20px 12px;padding:10px;border-radius:8px;background:rgba(255,200,50,0.12);color:#ffc832;font-size:0.85rem;text-align:center;"></div>
  `;
  document.body.appendChild(panel);
  editorPanel = panel;

  // 事件绑定
  document.getElementById('inSpaceEditorClose').addEventListener('click', closePanel);
  document.getElementById('inSpaceSaveBtn').addEventListener('click', saveAllChanges);
  document.getElementById('tabAudio').addEventListener('click', () => switchTab('audio'));
  document.getElementById('tabInteract').addEventListener('click', () => switchTab('interact'));
  document.getElementById('inSpaceAddGuide').addEventListener('click', () => startPlacement('guide'));
  document.getElementById('inSpaceAddVoice').addEventListener('click', () => startPlacement('voice'));

  // 环境音上传事件
  setupAudioPanelEvents();
}

// ==================== 面板 HTML 构建 ====================

function buildAudioPanel() {
  const sectors = ['north', 'east', 'south', 'west'];
  const sectorLabels = { north: '⬆ 前方', east: '➡ 右侧', south: '⬇ 后方', west: '⬅ 左侧' };
  return `
    <div style="margin-bottom:16px;">
      <h4 style="color:#ff9db5;margin:0 0 4px 0;">🎵 背景音乐 (BGM)</h4>
      <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;">
        <span id="bgmStatus" style="color:#888;flex:1;">未设置</span>
        <input type="file" id="bgmUpload" accept="audio/*" style="display:none;" />
        <button id="bgmUploadBtn" style="background:rgba(255,157,181,0.12);border:1px solid rgba(255,157,181,0.3);color:#ff9db5;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;">上传</button>
        <button id="bgmClearBtn" style="background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.2);color:#f66;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.7rem;">清除</button>
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <h4 style="color:#c4a0ff;margin:0 0 4px 0;">🏞️ 主环境音（全局背景层）</h4>
      <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;">
        <span id="mainAmbStatus" style="color:#888;flex:1;">未设置</span>
        <input type="file" id="mainAmbUpload" accept="audio/*" style="display:none;" />
        <button id="mainAmbUploadBtn" style="background:rgba(196,160,255,0.12);border:1px solid rgba(196,160,255,0.3);color:#c4a0ff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;">上传</button>
        <button id="mainAmbClearBtn" style="background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.2);color:#f66;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.7rem;">清除</button>
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <h4 style="color:#88ccff;margin:0 0 4px 0;">🧭 方向环境音（随视角渐变）</h4>
      ${sectors.map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem;">
          <span style="color:#88ccff;width:60px;">${sectorLabels[s]}</span>
          <span id="ambStatus_${s}" style="color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">未设置</span>
          <input type="file" id="ambUpload_${s}" accept="audio/*" style="display:none;" />
          <button class="amb-upload-btn" data-sector="${s}" style="background:rgba(136,204,255,0.1);border:1px solid rgba(136,204,255,0.25);color:#88ccff;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.7rem;">上传</button>
          <button class="amb-clear-btn" data-sector="${s}" style="background:rgba(255,80,80,0.06);border:1px solid rgba(255,80,80,0.15);color:#f66;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:0.7rem;">✕</button>
        </div>
      `).join('')}
    </div>
  `;
}

function buildInteractPanel() {
  return `
    <div style="margin-bottom:20px;">
      <h4 style="color:#ff9db5;margin:0 0 4px 0;">📍 引导点（引导问题 + 触发音乐）</h4>
      <p style="font-size:0.7rem;color:#888;margin:0 0 8px 0;">可输入引导性问题，也可上传触发时播放的音频</p>
      <div id="inSpaceGuideList" style="margin-bottom:8px;"></div>
      <button id="inSpaceAddGuide" style="width:100%;padding:10px;border:1px dashed rgba(255,157,181,0.35);border-radius:10px;background:rgba(255,107,157,0.06);color:#ff9db5;cursor:pointer;font-size:0.85rem;">+ 添加引导点（点击球面放置）</button>
    </div>
    <div style="margin-bottom:16px;">
      <h4 style="color:#88ccff;margin:0 0 4px 0;">🔊 语音点（触发环境音）</h4>
      <p style="font-size:0.7rem;color:#888;margin:0 0 8px 0;">上传音频文件，点击后触发一次性播放</p>
      <div id="inSpaceVoiceList" style="margin-bottom:8px;"></div>
      <button id="inSpaceAddVoice" style="width:100%;padding:10px;border:1px dashed rgba(136,204,255,0.35);border-radius:10px;background:rgba(136,204,255,0.06);color:#88ccff;cursor:pointer;font-size:0.85rem;">+ 添加语音点（点击球面放置）</button>
    </div>
  `;
}

// ==================== Tab 切换 ====================

function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tabAudio').className = tab === 'audio' ? 'inspace-tab inspace-tab-active' : 'inspace-tab';
  document.getElementById('tabAudio').style.background = tab === 'audio' ? 'rgba(255,255,255,0.06)' : 'transparent';
  document.getElementById('tabAudio').style.color = tab === 'audio' ? '#eef0ff' : '#888';
  document.getElementById('tabInteract').className = tab === 'interact' ? 'inspace-tab inspace-tab-active' : 'inspace-tab';
  document.getElementById('tabInteract').style.background = tab === 'interact' ? 'rgba(255,255,255,0.06)' : 'transparent';
  document.getElementById('tabInteract').style.color = tab === 'interact' ? '#eef0ff' : '#888';
  document.getElementById('tabAudioPanel').style.display = tab === 'audio' ? 'block' : 'none';
  document.getElementById('tabInteractPanel').style.display = tab === 'interact' ? 'block' : 'none';
  cancelPlacement();
  if (tab === 'audio') renderAudioPanel();
  if (tab === 'interact') renderInteractLists();
}

// ==================== 环境音面板渲染 ====================

function renderAudioPanel() {
  if (!currentSpace?.audio) return;
  const a = currentSpace.audio;
  const sectors = ['north', 'east', 'south', 'west'];

  document.getElementById('bgmStatus').textContent = a.bgm ? a.bgm.split('/').pop() : '未设置';
  document.getElementById('mainAmbStatus').textContent = a.mainAmbience ? a.mainAmbience.split('/').pop() : '未设置';

  sectors.forEach(s => {
    const amb = a.ambiences?.find(x => x.sector === s);
    document.getElementById('ambStatus_' + s).textContent = amb?.file ? amb.file.split('/').pop() : '未设置';
  });
}

function setupAudioPanelEvents() {
  // BGM
  document.getElementById('bgmUploadBtn').addEventListener('click', () => document.getElementById('bgmUpload').click());
  document.getElementById('bgmUpload').addEventListener('change', (e) => handleAudioFileUpload(e, 'bgm'));
  document.getElementById('bgmClearBtn').addEventListener('click', () => clearAudioField('bgm'));

  // 主环境音
  document.getElementById('mainAmbUploadBtn').addEventListener('click', () => document.getElementById('mainAmbUpload').click());
  document.getElementById('mainAmbUpload').addEventListener('change', (e) => handleAudioFileUpload(e, 'mainAmbience'));
  document.getElementById('mainAmbClearBtn').addEventListener('click', () => clearAudioField('mainAmbience'));

  // 方向环境音
  document.querySelectorAll('.amb-upload-btn').forEach(btn => {
    btn.addEventListener('click', () => document.getElementById('ambUpload_' + btn.dataset.sector).click());
  });
  document.querySelectorAll('[id^="ambUpload_"]').forEach(input => {
    input.addEventListener('change', (e) => handleAmbienceUpload(e));
  });
  document.querySelectorAll('.amb-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => clearAmbienceField(btn.dataset.sector));
  });
}

async function handleAudioFileUpload(event, field) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = await uploadAudio(file);
    currentSpace.audio = currentSpace.audio || {};
    currentSpace.audio[field] = data.url;
    renderAudioPanel();
    applyAudioChanges();
    console.log(`✅ ${field} 已上传:`, data.url);
  } catch (err) {
    alert('上传失败: ' + err.message);
  }
}

async function handleAmbienceUpload(event) {
  const file = event.target.files?.[0];
  const sector = event.target.id.replace('ambUpload_', '');
  if (!file) return;
  try {
    const data = await uploadAudio(file);
    currentSpace.audio = currentSpace.audio || {};
    currentSpace.audio.ambiences = currentSpace.audio.ambiences || [];
    const idx = currentSpace.audio.ambiences.findIndex(a => a.sector === sector);
    if (idx >= 0) {
      currentSpace.audio.ambiences[idx].file = data.url;
      currentSpace.audio.ambiences[idx].fileName = file.name;
    } else {
      currentSpace.audio.ambiences.push({
        id: 'amb-' + sector + '-' + Date.now(),
        sector, file: data.url, fileName: file.name, text: sector + '环境音'
      });
    }
    renderAudioPanel();
    applyAudioChanges();
    console.log(`✅ 方向环境音[${sector}] 已上传:`, data.url);
  } catch (err) {
    alert('上传失败: ' + err.message);
  }
}

function clearAudioField(field) {
  if (currentSpace?.audio) currentSpace.audio[field] = '';
  renderAudioPanel();
  applyAudioChanges();
}

function clearAmbienceField(sector) {
  if (currentSpace?.audio?.ambiences) {
    currentSpace.audio.ambiences = currentSpace.audio.ambiences.filter(a => a.sector !== sector);
  }
  renderAudioPanel();
  applyAudioChanges();
}

function applyAudioChanges() {
  if (!currentSpace?.audio) return;
  const a = currentSpace.audio;

  // BGM
  if (a.bgm) {
    audioManager.playBGM(a.bgm);
    import('../ui/BGMControl.js').then(m => m.updateBGMState(true));
  } else {
    audioManager.stopBGM();
    import('../ui/BGMControl.js').then(m => m.updateBGMState(false));
  }

  // 主环境音
  if (a.mainAmbience) {
    audioManager.playMainAmbience(a.mainAmbience);
  } else {
    audioManager.stopMainAmbience();
  }

  // 方向环境音
  ambienceManager.setAmbiences(a.ambiences || []);
  ambienceManager.setMainAmbience(a.mainAmbience || null);
  ambienceManager._initialized = false;
  ambienceManager.initDirectionalAmbiences();
}

async function uploadAudio(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload/audio', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('上传失败 (' + res.status + ')');
  return res.json();
}

// ==================== 互动点面板渲染 ====================

function renderInteractLists() {
  renderGuideList();
  renderVoiceList();
}

function renderGuideList() {
  const list = document.getElementById('inSpaceGuideList');
  if (!list) return;
  const points = currentSpace?.audio?.guidePoints || [];
  list.innerHTML = points.map((gp, i) => `
    <div style="display:flex;flex-direction:column;gap:6px;padding:10px;margin-bottom:8px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,157,181,0.1);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:0.8rem;color:#ff9db5;">📍 引导点 #${i + 1}</span>
        <span style="font-size:0.7rem;color:#888;margin-left:auto;">${escHtml((gp.id || '').slice(0, 8))}</span>
      </div>
      <input type="text" data-gp-text="${i}" value="${escHtml(gp.text || '')}" placeholder="输入引导性问题..."
        style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#eef0ff;font-size:0.85rem;box-sizing:border-box;" />
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="file" accept="audio/*" data-gp-audio="${i}" style="display:none;" />
        <button data-gp-audio-btn="${i}" style="background:rgba(255,157,181,0.12);border:1px solid rgba(255,157,181,0.25);color:#ff9db5;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;white-space:nowrap;">🎵 ${gp.file ? '已设置' : '上传音频'}</button>
        <span style="font-size:0.7rem;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${gp.file ? gp.file.split('/').pop() : '未设置触发音'}</span>
        <button data-gp-del="${i}" style="background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.2);color:#f55;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.7rem;">删除</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-gp-text]').forEach(input => {
    input.addEventListener('input', () => {
      const arr = currentSpace?.audio?.guidePoints;
      if (arr && arr[parseInt(input.dataset.gpText)]) arr[parseInt(input.dataset.gpText)].text = input.value;
    });
  });
  list.querySelectorAll('[data-gp-audio-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); list.querySelector(`[data-gp-audio="${btn.dataset.gpAudioBtn}"]`).click(); });
  });
  list.querySelectorAll('[data-gp-audio]').forEach(input => {
    input.addEventListener('change', (e) => handlePointAudio(e, 'guide', parseInt(input.dataset.gpAudio)));
  });
  list.querySelectorAll('[data-gp-del]').forEach(btn => {
    btn.addEventListener('click', () => deletePoint('guide', parseInt(btn.dataset.gpDel)));
  });
}

function renderVoiceList() {
  const list = document.getElementById('inSpaceVoiceList');
  if (!list) return;
  const points = currentSpace?.audio?.voicePoints || [];
  list.innerHTML = points.map((vp, i) => `
    <div style="display:flex;flex-direction:column;gap:6px;padding:10px;margin-bottom:8px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(136,204,255,0.1);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:0.8rem;color:#88ccff;">🔊 语音点 #${i + 1}</span>
        <span style="font-size:0.7rem;color:#888;margin-left:auto;">${escHtml((vp.id || '').slice(0, 8))}</span>
      </div>
      <input type="text" data-vp-text="${i}" value="${escHtml(vp.text || '')}" placeholder="输入语音点标签..."
        style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#eef0ff;font-size:0.85rem;box-sizing:border-box;" />
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="file" accept="audio/*" data-vp-audio="${i}" style="display:none;" />
        <button data-vp-audio-btn="${i}" style="background:rgba(136,204,255,0.12);border:1px solid rgba(136,204,255,0.25);color:#88ccff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;white-space:nowrap;">🎵 ${vp.file ? '已设置' : '上传音频'}</button>
        <span style="font-size:0.7rem;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${vp.file ? vp.file.split('/').pop() : '未设置音频'}</span>
        <button data-vp-del="${i}" style="background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.2);color:#f55;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.7rem;">删除</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-vp-text]').forEach(input => {
    input.addEventListener('input', () => {
      const arr = currentSpace?.audio?.voicePoints;
      if (arr && arr[parseInt(input.dataset.vpText)]) arr[parseInt(input.dataset.vpText)].text = input.value;
    });
  });
  list.querySelectorAll('[data-vp-audio-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); list.querySelector(`[data-vp-audio="${btn.dataset.vpAudioBtn}"]`).click(); });
  });
  list.querySelectorAll('[data-vp-audio]').forEach(input => {
    input.addEventListener('change', (e) => handlePointAudio(e, 'voice', parseInt(input.dataset.vpAudio)));
  });
  list.querySelectorAll('[data-vp-del]').forEach(btn => {
    btn.addEventListener('click', () => deletePoint('voice', parseInt(btn.dataset.vpDel)));
  });
}

async function handlePointAudio(event, type, index) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = await uploadAudio(file);
    const arr = type === 'guide' ? currentSpace?.audio?.guidePoints : currentSpace?.audio?.voicePoints;
    if (arr && arr[index]) arr[index].file = data.url;
    renderInteractLists();
    console.log(`${type}点音频已上传:`, data.url);
  } catch (err) {
    alert('音频上传失败: ' + err.message);
  }
}

// ==================== 面板开关 ====================

function togglePanel() { isOpen ? closePanel() : openPanel(); }

function openPanel() {
  if (!currentSpace) return;
  isOpen = true;
  editorPanel.style.right = '0';
  document.getElementById('inSpaceEditorTrigger').style.display = 'none';
  if (activeTab === 'audio') renderAudioPanel();
  else renderInteractLists();
}

function closePanel() {
  isOpen = false;
  cancelPlacement();
  editorPanel.style.right = '-420px';
  document.getElementById('inSpaceEditorTrigger').style.display = 'block';
}

// ==================== 显示/隐藏 ====================

let welcomeHintEl = null;
let welcomeHintTimeout = null;

export function showInSpaceEditor(space) {
  currentSpace = space;
  document.getElementById('inSpaceEditorTrigger').style.display = 'block';
  showWelcomeHint(space);
}

export function hideInSpaceEditor() {
  closePanel();
  currentSpace = null;
  document.getElementById('inSpaceEditorTrigger').style.display = 'none';
  hideWelcomeHint();
}

function showWelcomeHint(space) {
  hideWelcomeHint();
  const hasPoints = (space?.audio?.guidePoints?.length || 0) + (space?.audio?.voicePoints?.length || 0) > 0;
  const hasAudio = !!(space?.audio?.bgm || space?.audio?.mainAmbience || space?.audio?.ambiences?.some(a => a.file));

  const hint = document.createElement('div');
  hint.id = 'welcomeHint';
  hint.style.cssText = `
    position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:150;max-width:420px;
    padding:16px 24px;border-radius:16px;background:rgba(15,14,29,0.9);
    border:1px solid rgba(255,255,255,0.15);backdrop-filter:blur(16px);
    box-shadow:0 12px 40px rgba(0,0,0,0.4);color:#eef0ff;font-size:0.9rem;
    line-height:1.6;text-align:center;opacity:0;transition:opacity 0.5s ease;
  `;

  let msg = '';
  if (hasPoints) msg += '🔍 <b>转动视角</b>寻找空间中上升的星尘 — 点击它触发互动！<br>';
  if (!hasPoints && !hasAudio) {
    msg += '🎵 这个空间还没有内容。<br>点击右下角 <b style="color:#ff9db5;">✦</b> 开始编辑吧！';
  } else if (!hasAudio) {
    msg += '🎵 点击右下角 <b style="color:#ff9db5;">✦</b> 上传背景音乐或环境音。';
  } else if (!hasPoints) {
    msg += '📍 点击右下角 <b style="color:#ff9db5;">✦</b> 添加引导点和语音点。';
  }

  hint.innerHTML = msg;
  document.body.appendChild(hint);
  requestAnimationFrame(() => { hint.style.opacity = '1'; });
  welcomeHintEl = hint;
  welcomeHintTimeout = setTimeout(() => hideWelcomeHint(), 10000);
}

function hideWelcomeHint() {
  clearTimeout(welcomeHintTimeout);
  if (welcomeHintEl) {
    welcomeHintEl.style.opacity = '0';
    setTimeout(() => { welcomeHintEl?.parentNode?.removeChild(welcomeHintEl); welcomeHintEl = null; }, 500);
  }
}

export function onInSpacePointsChanged(callback) { onPointsChanged = callback; }

// ==================== 交互点放置 ====================

function startPlacement(type) {
  cancelPlacement();
  placementMode = type;
  const hint = document.getElementById('inSpacePlaceHint');
  hint.style.display = 'block';
  hint.textContent = type === 'guide'
    ? '📍 点击球面任意位置放置引导点（按 ESC 取消）'
    : '🔊 点击球面任意位置放置语音点（按 ESC 取消）';
  document.addEventListener('keydown', onPlaceKeyDown);
}

function cancelPlacement() {
  placementMode = null;
  const hint = document.getElementById('inSpacePlaceHint');
  if (hint) hint.style.display = 'none';
  document.removeEventListener('keydown', onPlaceKeyDown);
}

function onPlaceKeyDown(e) { if (e.key === 'Escape') cancelPlacement(); }

export function handlePlacementClick(event, camera, renderer, scene) {
  if (!placementMode || !currentSpace) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x, y }, camera);

  let sphereMesh = getCurrentSphereMesh();
  if (!sphereMesh) {
    sphereMesh = scene.children.find(c => c.isMesh && c.geometry?.type === 'SphereGeometry' && c.material?.isMeshBasicMaterial);
  }
  if (!sphereMesh) return false;

  const intersects = raycaster.intersectObject(sphereMesh, false);
  if (intersects.length === 0) return false;

  // 取射线方向，把点放在距离相机 6 单位的可见位置（而非球面 500 单位）
  const dir = raycaster.ray.direction.clone().normalize().multiplyScalar(6);
  const camPos = camera.position.clone();
  const point = camPos.clone().add(dir);
  const pos = [point.x, point.y, point.z];

  const newPoint = {
    id: (placementMode === 'guide' ? 'gp-' : 'vp-') + Date.now(),
    position: pos,
    text: placementMode === 'guide' ? '你想在这里发现什么？' : '新的语音点',
    ambienceId: '',
  };

  if (!currentSpace.audio) {
    currentSpace.audio = { bgm: '', mainAmbience: '', ambiences: [], guidePoints: [], voicePoints: [] };
  }

  const arr = placementMode === 'guide'
    ? (currentSpace.audio.guidePoints || (currentSpace.audio.guidePoints = []))
    : (currentSpace.audio.voicePoints || (currentSpace.audio.voicePoints = []));
  arr.push(newPoint);

  cancelPlacement();
  renderInteractLists();
  refreshScenePoints();
  return true;
}

function deletePoint(type, index) {
  const arr = type === 'guide' ? currentSpace?.audio?.guidePoints : currentSpace?.audio?.voicePoints;
  if (!arr || !arr[index]) return;
  if (!confirm(`确认删除这个${type === 'guide' ? '引导' : '语音'}点？`)) return;
  arr.splice(index, 1);
  renderInteractLists();
  refreshScenePoints();
}

// ==================== 保存 ====================

async function saveAllChanges() {
  if (!currentSpace) return;
  currentSpace.isSaved = true;
  updateSpace(currentSpace);
  try { await syncSpaceToBackend(currentSpace); } catch (e) { console.warn('后端同步失败（本地已保存）:', e.message); }
  refreshScenePoints();
  alert('已保存！');
}

function refreshScenePoints() {
  if (!sceneRef) return;
  clearGuidePoints();
  clearVoicePoints();
  if (currentSpace?.audio) {
    createGuidePoints(sceneRef, currentSpace.audio.guidePoints);
    createVoicePoints(sceneRef, currentSpace.audio.voicePoints);
  }
  if (onPointsChanged) onPointsChanged();
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
