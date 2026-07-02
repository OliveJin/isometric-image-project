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
  // 并行加载：本地 JSON + localStorage + 后端 API
  const [baseSpaces, savedSpaces, backendSpaces] = await Promise.allSettled([
    fetchBaseSpaces(),
    Promise.resolve(getSavedSpaces()),
    fetchBackendSpaces(),
  ]);

  const base = baseSpaces.status === 'fulfilled' ? baseSpaces.value : [];
  const local = savedSpaces.status === 'fulfilled' ? savedSpaces.value : [];
  const remote = backendSpaces.status === 'fulfilled' ? backendSpaces.value : [];

  const deletedIds = getDeletedIds();

  const mergedMap = new Map();

  // 1. 静态 JSON 基础数据
  base.forEach(space => {
    if (!deletedIds.includes(space.id)) {
      mergedMap.set(space.id, space);
    }
  });

  // 2. localStorage 用户空间
  local.forEach(saved => {
    if (!deletedIds.includes(saved.id)) {
      mergedMap.set(saved.id, saved);
    }
  });

  // 3. 后端服务端空间（优先级最高）
  remote.forEach(remoteSpace => {
    if (!deletedIds.includes(remoteSpace.id)) {
      // 如果已存在，合并（保留本地可能更新的字段）
      const existing = mergedMap.get(remoteSpace.id);
      if (existing) {
        mergedMap.set(remoteSpace.id, { ...existing, ...remoteSpace, isSaved: true });
      } else {
        mergedMap.set(remoteSpace.id, { ...remoteSpace, isSaved: true });
      }
    }
  });

  spaces = Array.from(mergedMap.values());
  console.log(`[loader] 加载完成: 静态${base.length} + 本地${local.length} + 远程${remote.length} = ${spaces.length}个空间`);
  return spaces;

  async function fetchBaseSpaces() {
    const res = await fetch('/data/spaces.json');
    if (!res.ok) throw new Error('Failed to load spaces.json');
    return res.json();
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

// ==================== 后端 API 集成 ====================

const BACKEND_API = '/api/spaces';

/** 从后端加载所有空间 */
async function fetchBackendSpaces() {
  try {
    const res = await fetch(BACKEND_API);
    if (!res.ok) throw new Error(`后端返回 ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[loader] 从服务端加载 ${data.length} 个空间`);
      return data;
    }
    return [];
  } catch (err) {
    console.warn('[loader] 无法连接后端API（将仅使用本地存储）:', err.message);
    return [];
  }
}

/** 同步单个空间到后端 */
export async function syncSpaceToBackend(space) {
  if (!space || !space.id) return false;

  // 清理前端特有字段
  const payload = { ...space };
  delete payload.isLocal;
  delete payload.isSaved;

  try {
    // 先尝试 PUT 更新
    let res = await fetch(`${BACKEND_API}/${space.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 如果 404，则 POST 创建
    if (res.status === 404) {
      res = await fetch(BACKEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      throw new Error(`后端返回 ${res.status}`);
    }

    const saved = await res.json();
    console.log(`[loader] 已同步到服务端: ${space.id}`);
    return saved;
  } catch (err) {
    console.error('[loader] 同步失败:', err.message);
    throw err;
  }
}

/** 从后端删除空间 */
export async function deleteSpaceFromBackend(id) {
  try {
    const res = await fetch(`${BACKEND_API}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      console.log(`[loader] 已从服务端删除: ${id}`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[loader] 从后端删除失败:', err.message);
    return false;
  }
}