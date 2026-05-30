let spaces = [];

// 加载 JSON 数据
export async function loadSpaces() {
  const res = await fetch('/data/spaces.json');
  spaces = await res.json();
}

// 根据 id 获取空间数据
export function getSpaceById(id) {
  return spaces.find(space => space.id === id);
}