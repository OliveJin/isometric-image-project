/**
 * BGMControl — 背景音乐右上角播放/暂停控件
 * 样式与现有 UI 风格一致（半透明毛玻璃）。
 */

import audioManager from '../audio/AudioManager.js';

let controlEl = null;
let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .bgm-control-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.55);
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(8px);
      color: #eef0ff;
      font-size: 1.2rem;
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, background 0.2s ease;
      box-shadow: 0 10px 40px rgba(22,18,44,0.22);
    }
    .bgm-control-btn:hover {
      transform: translateY(-2px);
      background: rgba(255,255,255,0.15);
    }
  `;
  document.head.appendChild(style);
}

export function initBGMControl() {
  if (controlEl) return;  // 已初始化

  injectStyles();

  controlEl = document.createElement('button');
  controlEl.id = 'bgmControlBtn';
  controlEl.className = 'bgm-control-btn';
  controlEl.title = '背景音乐';
  controlEl.innerHTML = '♪';

  controlEl.addEventListener('click', () => {
    const playing = audioManager.toggleBGM();
    controlEl.innerHTML = playing ? '♫' : '♪';
    controlEl.title = playing ? '暂停背景音乐' : '播放背景音乐';
  });

  document.getElementById('ui').appendChild(controlEl);
}

/** 更新 BGM 按钮状态（BGM 开始播放后调用） */
export function updateBGMState(playing) {
  if (!controlEl) return;
  controlEl.innerHTML = playing ? '♫' : '♪';
  controlEl.title = playing ? '暂停背景音乐' : '播放背景音乐';
}

export function hideBGMControl() {
  if (controlEl) {
    controlEl.remove();
    controlEl = null;
  }
}
