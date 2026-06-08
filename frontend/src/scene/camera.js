import * as THREE from 'three';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(0, 1.2, 7);

  return camera;
}