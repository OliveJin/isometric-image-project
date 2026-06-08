import * as THREE from 'three';

let entryObjects = [];
let entryMeshes = [];
let backgroundGroup = null;
let animationFrameId = null;
let particleData = null;
let floatingData = [];
let lightGroup = null;

const spaceColors = [0xd0d0ff, 0xc5b9ff, 0xa8e6ff, 0xd0cdfb, 0xffdcda];

export function createEntrySpheres(scene, spaces) {
  clearEntrySpheres(scene);

  if (!Array.isArray(spaces) || spaces.length === 0) {
    return;
  }

  addSelectionLights(scene);

  const totalCount = spaces.length + 1;
  const ringRadius = 4.7 + Math.max(0, totalCount - 7) * 0.32;
  const fixedY = 0.28;
  const sizeScale = THREE.MathUtils.clamp(1 - (totalCount - 5) * 0.05, 0.58, 1);
  const createRadius = THREE.MathUtils.clamp(0.96 * sizeScale, 0.62, 0.96);
  const baseRadius = THREE.MathUtils.clamp(0.72 * sizeScale, 0.42, 0.72);

  const items = [
    {
      type: 'create',
      title: '创建新空间',
      radius: createRadius,
      baseY: fixedY + 0.12,
      amplitude: 0.12,
      speed: 0.9,
      rotationSpeed: 0.0024,
    },
    ...spaces.map((space, index) => ({
      type: 'space',
      space,
      radius: baseRadius + ((index % 2) * 0.12 * sizeScale),
      baseY: fixedY,
      amplitude: 0.08 + Math.random() * 0.05,
      speed: 0.8 + Math.random() * 0.5,
      rotationSpeed: 0.0015 + Math.random() * 0.0012,
    })),
  ];

  items.forEach((item, index) => {
    const geometry = new THREE.SphereGeometry(item.radius, 40, 40);
    const material = new THREE.MeshStandardMaterial({
      color: item.type === 'create' ? 0xf8f4ff : spaceColors[index % spaceColors.length],
      emissive: item.type === 'create' ? 0xd8d0ff : 0x8f8be8,
      emissiveIntensity: item.type === 'create' ? 0.35 : 0.18,
      roughness: item.type === 'create' ? 0.18 : 0.28,
      metalness: item.type === 'create' ? 0.3 : 0.22,
      transparent: true,
      opacity: item.type === 'create' ? 0.98 : 0.94,
    });

    const mesh = new THREE.Mesh(geometry, material);
    const angle = (index / totalCount) * Math.PI * 2;
    const x = Math.cos(angle) * ringRadius;
    const z = Math.sin(angle) * ringRadius;
    mesh.position.set(x, item.baseY, z);

    if (item.type === 'create') {
      mesh.userData.createNewSpace = true;
      mesh.userData.title = item.title;
    } else {
      mesh.userData.spaceId = item.space.id;
      mesh.userData.title = item.space.id;
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(item.radius + 0.14, item.radius + 0.28, 64),
      new THREE.MeshBasicMaterial({
        color: 0xf7f5ff,
        opacity: 0.18,
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(mesh.position);
    ring.position.y = item.baseY - 0.12;

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(item.radius + 0.36, item.radius + 0.48, 80),
      new THREE.MeshBasicMaterial({
        color: 0xf4f2ff,
        opacity: item.type === 'create' ? 0.14 : 0.08,
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.copy(mesh.position);
    halo.position.y = item.baseY - 0.1;

    scene.add(mesh, ring, halo);
    entryObjects.push(mesh, ring, halo);
    entryMeshes.push(mesh);
    floatingData.push({
      mesh,
      baseY: item.baseY,
      amplitude: item.amplitude,
      speed: item.speed,
      phase: Math.random() * Math.PI * 2,
      baseX: x,
      baseZ: z,
      rotationSpeed: item.rotationSpeed,
    });
  });

  backgroundGroup = createGalaxyBackground();
  scene.add(backgroundGroup);

  startEntryAnimation();
}

function createGalaxyBackground() {
  const group = new THREE.Group();

  const starMaterial = new THREE.PointsMaterial({
    color: 0xe3e4ff,
    size: 0.06,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  const starGeometry = new THREE.BufferGeometry();
  const starCount = 320;
  const positions = new Float32Array(starCount * 3);
  const speeds = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const radius = THREE.MathUtils.lerp(5.5, 10.8, Math.random());
    const angle = Math.random() * Math.PI * 2;
    const height = THREE.MathUtils.lerp(-0.8, 0.8, Math.random());
    const x = Math.cos(angle) * radius;
    const y = height;
    const z = Math.sin(angle) * radius;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    speeds[i * 3] = (0.0005 + Math.random() * 0.0008) * (Math.random() > 0.5 ? 1 : -1);
    speeds[i * 3 + 1] = 0.00015 + Math.random() * 0.0003;
    speeds[i * 3 + 2] = (0.0005 + Math.random() * 0.0008) * (Math.random() > 0.5 ? 1 : -1);
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  particleData = {
    geometry: starGeometry,
    speeds,
    basePositions: positions.slice(),
  };

  const stars = new THREE.Points(starGeometry, starMaterial);
  group.add(stars);

  return group;
}

function addSelectionLights(scene) {
  if (lightGroup) {
    scene.remove(lightGroup);
    lightGroup = null;
  }

  lightGroup = new THREE.Group();
  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  const point = new THREE.PointLight(0xdde4ff, 0.65, 12, 2);
  point.position.set(0, 4.5, 4.5);
  const point2 = new THREE.PointLight(0x8877ff, 0.45, 10, 2);
  point2.position.set(-4, 3.5, -2);
  lightGroup.add(ambient, point, point2);
  scene.add(lightGroup);
}

function startEntryAnimation() {
  if (animationFrameId) {
    return;
  }

  const start = performance.now();

  function animate() {
    const elapsed = (performance.now() - start) / 1000;

    floatingData.forEach(item => {
      item.mesh.position.y = item.baseY + Math.sin(elapsed * item.speed + item.phase) * item.amplitude;
      item.mesh.position.x = item.baseX + Math.cos(elapsed * item.speed * 0.7 + item.phase) * 0.04;
      item.mesh.position.z = item.baseZ + Math.sin(elapsed * item.speed * 0.9 + item.phase) * 0.04;
      item.mesh.rotation.y += item.rotationSpeed;
    });

    if (particleData) {
      const positions = particleData.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = particleData.basePositions[i] + Math.sin(elapsed * 0.7 + i) * 0.02;
        positions[i + 1] = particleData.basePositions[i + 1] + Math.cos(elapsed * 0.9 + i) * 0.02;
        positions[i + 2] = particleData.basePositions[i + 2] + Math.sin(elapsed * 0.6 + i * 1.1) * 0.02;
      }
      particleData.geometry.attributes.position.needsUpdate = true;
      backgroundGroup.rotation.y = elapsed * 0.01;
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  animationFrameId = requestAnimationFrame(animate);
}

export function clearEntrySpheres(scene) {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (backgroundGroup) {
    scene.remove(backgroundGroup);
    backgroundGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    backgroundGroup = null;
  }

  if (lightGroup) {
    scene.remove(lightGroup);
    lightGroup.traverse(child => {
      if (child.dispose) child.dispose();
    });
    lightGroup = null;
  }

  if (entryObjects.length > 0) {
    entryObjects.forEach(obj => {
      if (!obj) return;
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }

  entryObjects = [];
  entryMeshes = [];
  particleData = null;
  floatingData = [];
}

export function getEntrySpheres() {
  return entryMeshes.slice();
}

export function getEntrySphereById(id) {
  return entryMeshes.find(mesh => mesh.userData.spaceId === id) || null;
}

export function resetCameraPosition(camera) {
  camera.position.set(0, 1.12, 8.2);
}

