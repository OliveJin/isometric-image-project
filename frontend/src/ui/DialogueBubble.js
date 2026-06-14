/**
 * DialogueBubble — 对话气泡 UI
 * 点击语音点/引导点后弹出，显示引导文字。
 * 自动关闭（5 秒后）或点击关闭按钮。
 * 样式与现有 confirmOverlay 风格一致。
 */

let bubbleEl = null;
let hideTimeout = null;

function injectStyles() {
  if (bubbleEl) return;

  const style = document.createElement('style');
  style.textContent = `
    .dialogue-bubble {
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      z-index: 200;
      max-width: min(400px, 85vw);
      padding: 18px 22px;
      border-radius: 20px;
      background: rgba(15, 14, 29, 0.94);
      border: 1px solid rgba(255,255,255,0.14);
      backdrop-filter: blur(16px);
      box-shadow: 0 30px 90px rgba(11, 11, 28, 0.45);
      text-align: center;
      color: #f2f3ff;
      font-size: 1rem;
      line-height: 1.6;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: auto;
    }
    .dialogue-bubble.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .dialogue-bubble .close-btn {
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      color: rgba(238,240,255,0.5);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 4px 6px;
      transition: color 0.2s;
    }
    .dialogue-bubble .close-btn:hover {
      color: #f2f3ff;
    }
  `;
  document.head.appendChild(style);
}

/** 显示对话气泡 */
export function show(text, duration = 5000) {
  if (bubbleEl) {
    // 已有气泡，先清除
    clearTimeout(hideTimeout);
    bubbleEl.remove();
  }

  injectStyles();

  bubbleEl = document.createElement('div');
  bubbleEl.className = 'dialogue-bubble';

  bubbleEl.innerHTML = `
    <button class="close-btn" aria-label="关闭">&times;</button>
    <p style="margin: 0;">${text}</p>
  `;

  document.body.appendChild(bubbleEl);

  // 触发过渡动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bubbleEl.classList.add('visible');
    });
  });

  // 关闭按钮
  const closeBtn = bubbleEl.querySelector('.close-btn');
  closeBtn.addEventListener('click', hide);

  // 点击气泡外部关闭
  bubbleEl.addEventListener('click', (e) => {
    if (e.target === bubbleEl) hide();
  });

  // 自动隐藏
  if (duration > 0) {
    hideTimeout = setTimeout(hide, duration);
  }
}

/** 隐藏并销毁 */
export function hide() {
  if (!bubbleEl) return;
  clearTimeout(hideTimeout);
  bubbleEl.classList.remove('visible');

  // 等待过渡动画结束后移除
  setTimeout(() => {
    if (bubbleEl && bubbleEl.parentNode) {
      bubbleEl.remove();
    }
    bubbleEl = null;
  }, 300);
}
