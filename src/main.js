import { initScene } from './scene/scene.js';
import { loadSpaces, getSpaceById } from './scene/loader.js';
import { createSphere } from './scene/sphere.js';

async function init() {
  const { scene } = initScene(); // 初始化 scene

  await loadSpaces(); // 加载 JSON

  const space = getSpaceById('room1'); // 获取数据

  createSphere(scene, space.panorama); // 把 sphere 加到 scene
}

init();