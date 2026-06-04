import * as THREE from 'three';
import { createCamera } from './camera.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

let scene;

export function initScene() {
  const canvas = document.getElementById('app');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();

  const camera = createCamera();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI / 2 - 0.08;
  controls.maxPolarAngle = Math.PI / 2 + 0.08;
  controls.autoRotate = false;

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  return { scene, camera, renderer, controls };
}

// 👇 导出 scene 给别的模块用（关键！）
export { scene };