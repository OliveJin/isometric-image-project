import * as THREE from 'three';
import { createCamera } from './camera.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export function initScene() {
  const canvas = document.getElementById('app');

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = createCamera();

  const controls = new OrbitControls(camera, renderer.domElement);

  // 限制缩放（防止穿模）
  controls.enableZoom = false;

  // 平滑
  controls.enableDamping = true;



  // 创建球体（很大）
  const geometry = new THREE.SphereGeometry(5, 64, 64);

  // 关键：反转（让贴图显示在内部）
  geometry.scale(-1, 1, 1);

  // 加载纹理（先用占位）
  const texture = new THREE.TextureLoader().load(
    'https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg'
  );

  // 材质
  const material = new THREE.MeshBasicMaterial({ map: texture });

  // 网格
  const sphere = new THREE.Mesh(geometry, material);

  // 加入场景
  scene.add(sphere);

  // 处理窗口变化（非常重要）
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // 渲染循环
  function animate() {
    requestAnimationFrame(animate);

    controls.update();

    renderer.render(scene, camera);
  }

  animate();
  return { scene };
}