import * as THREE from 'three';
let currentMesh = null;
let currentFogMesh = null;

export function clearSphere(scene) {
  if (currentMesh) {
    scene.remove(currentMesh);
    if (currentMesh.geometry) currentMesh.geometry.dispose();
    if (currentMesh.material) {
      if (currentMesh.material.map) currentMesh.material.map.dispose();
      currentMesh.material.dispose();
    }
    currentMesh = null;
  }

  if (currentFogMesh) {
    scene.remove(currentFogMesh);
    if (currentFogMesh.geometry) currentFogMesh.geometry.dispose();
    if (currentFogMesh.material) {
      if (currentFogMesh.material.map && currentFogMesh.material.map !== currentMesh?.material?.map) {
        currentFogMesh.material.map.dispose();
      }
      if (currentFogMesh.material.alphaMap) currentFogMesh.material.alphaMap.dispose();
      currentFogMesh.material.dispose();
    }
    currentFogMesh = null;
  }
}

function loadTexture(texturePath) {
  const textureUrl = typeof texturePath === 'string' && texturePath.startsWith('data:')
    ? texturePath
    : `${texturePath}?t=${Date.now()}`;

  const texture = new THREE.TextureLoader().load(textureUrl);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createFogOverlayMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      blurRange: { value: 0.03 },
      blurOffset: { value: 0.012 },
      overlayOpacity: { value: 0.12 },
      hazeStrength: { value: 0.18 },
      desaturate: { value: 0.14 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float blurRange;
      uniform float blurOffset;
      uniform float overlayOpacity;
      uniform float hazeStrength;
      uniform float desaturate;
      varying vec2 vUv;

      float luminance(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }

      void main() {
        float leftEdge = smoothstep(0.0, blurRange, vUv.x);
        float rightEdge = smoothstep(1.0, 1.0 - blurRange, vUv.x);
        float edgeAlpha = max(leftEdge, rightEdge);
        if (edgeAlpha <= 0.0) {
          discard;
        }

        vec4 original = texture2D(map, vUv);
        vec4 sampleA = texture2D(map, vec2(vUv.x - blurOffset, vUv.y));
        vec4 sampleB = texture2D(map, vec2(vUv.x + blurOffset, vUv.y));
        vec4 hazeColor = mix(original, mix(sampleA, sampleB, 0.5), 0.35);

        float lum = luminance(hazeColor.rgb);
        vec3 gray = vec3(lum);
        hazeColor.rgb = mix(hazeColor.rgb, gray, desaturate);
        hazeColor.rgb += vec3(0.03) * edgeAlpha;

        vec4 finalColor = mix(original, hazeColor, edgeAlpha * hazeStrength);
        gl_FragColor = vec4(finalColor.rgb, overlayOpacity * edgeAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

export function createSphere(scene, texturePath) {
  // 先清理旧的
  clearSphere(scene);

  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);

  const texture = loadTexture(texturePath);
  const material = new THREE.MeshBasicMaterial({ map: texture });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  currentMesh = mesh;

  const fogMaterial = createFogOverlayMaterial(texture);
  const fogMesh = new THREE.Mesh(geometry.clone(), fogMaterial);
  fogMesh.renderOrder = 1;
  scene.add(fogMesh);
  currentFogMesh = fogMesh;
}