export async function previewSpace(imageUrls) {
  const response = await fetch('/api/spaces/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageUrls }),
  });

  if (!response.ok) {
    throw new Error(`Preview API failed: ${response.status}`);
  }

  return response.json();
}

export async function createSpace(space) {
  const response = await fetch('/api/spaces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(space),
  });

  if (!response.ok) {
    throw new Error(`Create space failed: ${response.status}`);
  }

  return response.json();
}

export async function listSpaces() {
  const response = await fetch('/api/spaces');
  if (!response.ok) {
    throw new Error(`List spaces failed: ${response.status}`);
  }
  return response.json();
}

export async function getSpace(spaceId) {
  const response = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}`);
  if (!response.ok) {
    throw new Error(`Get space failed: ${response.status}`);
  }
  return response.json();
}

export async function saveAnswer(spaceId, questionId, userAnswer) {
  const response = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}/questions/${encodeURIComponent(questionId)}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userAnswer }),
  });

  if (!response.ok) {
    throw new Error(`Save answer failed: ${response.status}`);
  }

  return response.ok;
}
