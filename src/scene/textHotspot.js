const hotspotLayer = document.createElement('div');
hotspotLayer.id = 'hotspotLayer';
hotspotLayer.style.position = 'absolute';
hotspotLayer.style.inset = '0';
hotspotLayer.style.pointerEvents = 'none';
hotspotLayer.style.zIndex = '12';

if (typeof document !== 'undefined') {
  const ui = document.getElementById('ui');
  if (ui) {
    ui.appendChild(hotspotLayer);
  } else {
    document.body.appendChild(hotspotLayer);
  }
}

let hotspotIndex = 0;

export function clearHotspots() {
  hotspotLayer.innerHTML = '';
  hotspotIndex = 0;
}

export function createTextHotspot(question) {
  const card = document.createElement('div');
  card.className = 'hotspot-card';
  card.style.pointerEvents = 'auto';
  const title = document.createElement('strong');
  title.textContent = question.objectName || '关键物品';
  const text = document.createElement('div');
  text.textContent = question.question || '';
  const answer = document.createElement('div');
  answer.className = 'hotspot-answer';
  answer.textContent = question.userAnswer ? `回答：${question.userAnswer}` : '尚未回答';

  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(answer);

  const positions = [
    { top: '16%', left: '8%' },
    { top: '22%', right: '10%' },
    { bottom: '18%', left: '12%' },
    { bottom: '16%', right: '10%' },
  ];
  const pos = positions[hotspotIndex % positions.length];
  Object.entries(pos).forEach(([key, value]) => {
    card.style[key] = value;
  });
  hotspotIndex += 1;

  hotspotLayer.appendChild(card);
}
