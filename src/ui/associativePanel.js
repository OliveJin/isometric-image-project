let currentQuestions = [];
let currentIndex = 0;
let onCompleteCallback = null;
let onCancelCallback = null;

export function showAssociativePanel(questions, onComplete, onCancel) {
  const overlay = document.getElementById('questionOverlay');
  const title = document.getElementById('questionTitle');
  const description = document.getElementById('questionDescription');
  const answerInput = document.getElementById('questionAnswer');
  const counter = document.getElementById('questionCounter');
  const nextButton = document.getElementById('questionNextBtn');
  const cancelButton = document.getElementById('questionCancelBtn');

  if (!overlay || !title || !description || !answerInput || !counter || !nextButton || !cancelButton) {
    return;
  }

  currentQuestions = questions.map(question => ({ ...question, userAnswer: question.userAnswer || '' }));
  currentIndex = 0;
  onCompleteCallback = onComplete;
  onCancelCallback = onCancel;

  function render() {
    const current = currentQuestions[currentIndex];
    title.textContent = `${current.objectName}：${current.question}`;
    description.textContent = current.question;
    answerInput.value = current.userAnswer || '';
    counter.textContent = `${currentIndex + 1} / ${currentQuestions.length}`;
    nextButton.textContent = currentIndex === currentQuestions.length - 1 ? '保存空间' : '下一题';
  }

  nextButton.onclick = async () => {
    const answer = answerInput.value.trim();
    if (!answer) {
      alert('请先输入你的回答。');
      return;
    }
    currentQuestions[currentIndex].userAnswer = answer;
    if (currentIndex < currentQuestions.length - 1) {
      currentIndex += 1;
      render();
      answerInput.focus();
      return;
    }

    overlay.classList.remove('visible');
    const spaceName = prompt('给这个空间取一个名字吧：', '我的空间记忆');
    if (!spaceName) {
      overlay.classList.add('visible');
      return;
    }
    if (onCompleteCallback) {
      await onCompleteCallback(spaceName, currentQuestions);
    }
  };

  cancelButton.onclick = () => {
    overlay.classList.remove('visible');
    if (onCancelCallback) {
      onCancelCallback();
    }
  };

  render();
  overlay.classList.add('visible');
  answerInput.focus();
}

export function hideAssociativePanel() {
  const overlay = document.getElementById('questionOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}
