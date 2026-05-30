import * as THREE from 'three';

let currentMesh = null; // 用来记录当前球体（后面切换空间会用）

export function createSphere(scene, texturePath) {
  // 若已经有球体，先删除（为后面切换做准备）
  if (currentMesh) {
    scene.remove(currentMesh);
  }

  // 创建几何体（球）
  const geometry = new THREE.SphereGeometry(500, 60, 40);

  // 内翻（关键！）
  geometry.scale(-1, 1, 1);

  // 加载贴图
  const texture = new THREE.TextureLoader().load(texturePath);

  // 材质
  const material = new THREE.MeshBasicMaterial({ map: texture });

  // 创建 mesh
  const mesh = new THREE.Mesh(geometry, material);

  // 加入 scene
  scene.add(mesh);

  // 保存当前球体
  currentMesh = mesh;
}