let spaces = [];
const localStorageKey = 'the-moment-spaces';

function getLocalStorageData() {
  if (typeof localStorage === 'undefined') {
    return { savedSpaces: [], deletedIds: [] };
  }

  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return { savedSpaces: [], deletedIds: [] };
    const parsed = JSON.parse(raw);
    return {
      savedSpaces: Array.isArray(parsed.savedSpaces) ? parsed.savedSpaces : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
    };
  } catch (err) {
    console.warn('Failed to load saved spaces from localStorage:', err);
    return { savedSpaces: [], deletedIds: [] };
  }
}

function persistLocalStorageData(data) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(localStorageKey, JSON.stringify({
      savedSpaces: Array.isArray(data.savedSpaces) ? data.savedSpaces : [],
      deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
    }));
  } catch (err) {
    console.warn('Failed to persist spaces to localStorage:', err);
  }
}

function getSavedSpaces() {
  return getLocalStorageData().savedSpaces;
}

function getDeletedIds() {
  return getLocalStorageData().deletedIds;
}

function persistSavedSpaces(newSpaces) {
  const { deletedIds } = getLocalStorageData();
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const savedSpaces = newSpaces.filter(space => space.isLocal || space.isSaved);
    persistLocalStorageData({ savedSpaces, deletedIds });
  } catch (err) {
    console.warn('Failed to persist spaces to localStorage:', err);
  }
}

function persistDeletedId(id) {
  const data = getLocalStorageData();
  const nextDeletedIds = Array.from(new Set([...data.deletedIds, id]));
  persistLocalStorageData({ savedSpaces: data.savedSpaces, deletedIds: nextDeletedIds });
}

export async function loadSpaces() {
  try {
    const res = await fetch('/data/spaces.json');

    if (!res.ok) {
      throw new Error('Failed to load spaces.json');
    }

    const baseSpaces = await res.json();
    const savedSpaces = getSavedSpaces();
    const deletedIds = getDeletedIds();

    const mergedMap = new Map();
    baseSpaces.forEach(space => {
      if (!deletedIds.includes(space.id)) {
        mergedMap.set(space.id, space);
      }
    });

    savedSpaces.forEach(saved => {
      if (!deletedIds.includes(saved.id)) {
        mergedMap.set(saved.id, saved);
      }
    });

    spaces = Array.from(mergedMap.values());
    return spaces;

  } catch (err) {
    console.error('loadSpaces error:', err);
    const savedSpaces = getSavedSpaces();
    const deletedIds = getDeletedIds();
    spaces = savedSpaces.filter(saved => !deletedIds.includes(saved.id));
    return spaces;
  }
}

export function setSpaces(newSpaces) {
  spaces = Array.isArray(newSpaces) ? newSpaces.slice() : [];
}

export function saveCreatedSpaces(newSpaces) {
  persistSavedSpaces(newSpaces);
}

export function markSpaceDeleted(id) {
  persistDeletedId(id);
}

export function getSpaceById(id) {
  return spaces.find(space => space.id === id);
}

/** 更新指定空间并持久化到 localStorage */
export function updateSpace(updatedSpace) {
  if (!updatedSpace || !updatedSpace.id) {
    throw new Error('Invalid space object: missing id');
  }
  const index = spaces.findIndex(s => s.id === updatedSpace.id);
  const mergedSpace = {
    ...spaces[index],
    ...updatedSpace,
    audio: {
      ...(spaces[index]?.audio || {}),
      ...(updatedSpace?.audio || {}),
    },
  };
  if (index >= 0) {
    spaces[index] = mergedSpace;
  } else {
    spaces.push(mergedSpace);
  }
  spaces[index >= 0 ? index : spaces.length - 1].isSaved = true;
  persistSavedSpaces(spaces);
}