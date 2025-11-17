<template>
  <div class="vox3d-viewer">
    <div class="vox3d-header">
      <span>3D Voxel Viewer</span>
      <button class="view-toggle-btn" @click="show3D = !show3D">
        {{ show3D ? 'Show 2D Grid' : 'Show 3D View' }}
      </button>
    </div>

    <div v-if="show3D && voxels.length > 0" class="vox3d-container">
      <canvas ref="canvas" class="vox3d-canvas"></canvas>
      <div class="vox3d-controls">
        <button @click="resetCamera" class="vox-btn">Reset View</button>
        <label class="vox-checkbox">
          <input type="checkbox" v-model="showTargetMarker" @change="updateScene" />
          <span>Show Target</span>
        </label>
        <label class="vox-checkbox">
          <input type="checkbox" v-model="showAir" @change="updateScene" />
          <span>Show Air</span>
        </label>
      </div>
      <div class="vox3d-stats">
        <span>Total Voxels: <strong>{{ voxels.length }}</strong></span>
        <span>Solid: <strong>{{ solidCount }}</strong></span>
        <span>Air: <strong>{{ airCount }}</strong></span>
      </div>
    </div>

    <div v-else-if="!voxels.length" class="vox3d-empty">
      No voxel data available
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Voxel = { x: number; y: number; z: number; id: string };
type Coord = { x: number; y: number; z: number };

const props = defineProps<{
  vox?: any;
  target?: Coord | [number, number, number] | null;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const show3D = ref(true);
const showTargetMarker = ref(true);
const showAir = ref(false);

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let animationId: number | null = null;

const voxels = computed<Voxel[]>(() => {
  return Array.isArray(props.vox?.voxels) ? props.vox.voxels : [];
});

const targetCoord = computed<Coord | null>(() => {
  const t = props.target;
  if (!t) return null;
  if (Array.isArray(t) && t.length === 3) {
    return { x: Number(t[0]), y: Number(t[1]), z: Number(t[2]) };
  }
  if (typeof t === 'object' && 'x' in t && 'y' in t && 'z' in t) {
    const obj = t as Coord;
    return { x: Number(obj.x), y: Number(obj.y), z: Number(obj.z) };
  }
  return null;
});

const solidCount = computed(() => voxels.value.filter(v => !isAir(v.id)).length);
const airCount = computed(() => voxels.value.filter(v => isAir(v.id)).length);

// Minecraft block colors
const blockColors: Record<string, number> = {
  air: 0x000000,
  stone: 0x7f7f7f,
  cobblestone: 0x7a7a7a,
  dirt: 0x8b4513,
  grass_block: 0x5fba2d,
  oak_log: 0x9c6f3b,
  oak_planks: 0xb8945f,
  oak_leaves: 0x6ba836,
  glass: 0x8dd3f2,
  sand: 0xdbd3a0,
  sandstone: 0xe0d3a8,
  water: 0x3b82f6,
  lava: 0xff6b35,
};

function isAir(id: string): boolean {
  return id.replace('minecraft:', '') === 'air';
}

function getBlockColor(blockId: string): number {
  const id = blockId.replace('minecraft:', '');
  return blockColors[id] || 0x888888;
}

function initThree() {
  if (!canvas.value || voxels.value.length === 0) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Camera
  const aspect = canvas.value.offsetWidth / canvas.value.offsetHeight;
  camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  camera.position.set(20, 20, 20);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true });
  renderer.setSize(canvas.value.offsetWidth, canvas.value.offsetHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Render loop
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  animate();

  updateScene();
}

function updateScene() {
  if (!scene || !camera || !controls) return;

  // Clear existing voxels
  while (scene.children.length > 0) {
    const child = scene.children[0];
    scene.remove(child);
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) (child as any).material.dispose();
  }

  // Re-add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Calculate bounds
  const voxelsToRender = voxels.value.filter(v => showAir.value || !isAir(v.id));

  if (voxelsToRender.length === 0) return;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const voxel of voxelsToRender) {
    minX = Math.min(minX, voxel.x);
    minY = Math.min(minY, voxel.y);
    minZ = Math.min(minZ, voxel.z);
    maxX = Math.max(maxX, voxel.x);
    maxY = Math.max(maxY, voxel.y);
    maxZ = Math.max(maxZ, voxel.z);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Add voxels
  for (const voxel of voxelsToRender) {
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const color = getBlockColor(voxel.id);
    const isAirBlock = isAir(voxel.id);

    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: isAirBlock,
      opacity: isAirBlock ? 0.15 : 1.0,
      metalness: 0.1,
      roughness: 0.8,
    });

    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(
      voxel.x - centerX,
      voxel.y - centerY,
      voxel.z - centerZ
    );

    // Add edge wireframe for better visibility
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: isAirBlock ? 0x444444 : 0xffffff,
      transparent: true,
      opacity: isAirBlock ? 0.2 : 0.3,
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    cube.add(wireframe);

    scene.add(cube);
  }

  // Add target marker
  if (showTargetMarker.value && targetCoord.value) {
    const targetGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const targetMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
    });
    const targetSphere = new THREE.Mesh(targetGeometry, targetMaterial);
    targetSphere.position.set(
      targetCoord.value.x - centerX,
      targetCoord.value.y - centerY,
      targetCoord.value.z - centerZ
    );
    scene.add(targetSphere);

    // Add glow ring around target
    const ringGeometry = new THREE.TorusGeometry(0.5, 0.05, 8, 24);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(targetSphere.position);
    scene.add(ring);
  }

  // Adjust camera to fit scene
  const distance = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 2;
  camera.position.set(distance, distance, distance);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}

function resetCamera() {
  if (!camera || !controls) return;
  const voxelsToRender = voxels.value.filter(v => showAir.value || !isAir(v.id));

  if (voxelsToRender.length === 0) return;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const voxel of voxelsToRender) {
    minX = Math.min(minX, voxel.x);
    minY = Math.min(minY, voxel.y);
    minZ = Math.min(minZ, voxel.z);
    maxX = Math.max(maxX, voxel.x);
    maxY = Math.max(maxY, voxel.y);
    maxZ = Math.max(maxZ, voxel.z);
  }

  const distance = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 2;
  camera.position.set(distance, distance, distance);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}

function handleResize() {
  if (!canvas.value || !camera || !renderer) return;
  const aspect = canvas.value.offsetWidth / canvas.value.offsetHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.value.offsetWidth, canvas.value.offsetHeight);
}

onMounted(() => {
  if (voxels.value.length > 0 && show3D.value) {
    initThree();
    window.addEventListener('resize', handleResize);
  }
});

onUnmounted(() => {
  if (animationId !== null) cancelAnimationFrame(animationId);
  if (controls) controls.dispose();
  if (renderer) renderer.dispose();
  window.removeEventListener('resize', handleResize);
});

watch(() => [voxels.value.length, show3D.value], ([newLen, new3D]) => {
  if (newLen > 0 && new3D && !scene) {
    setTimeout(() => initThree(), 100);
  }
});
</script>

<style scoped>
.vox3d-viewer {
  margin-top: 12px;
}

.vox3d-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}

.view-toggle-btn {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.vox3d-container {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
}

.vox3d-canvas {
  width: 100%;
  height: 500px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #0f1115;
}

.vox3d-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.vox-btn {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.vox-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.vox-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.vox3d-stats {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
}

.vox3d-stats span {
  opacity: 0.85;
}

.vox3d-stats strong {
  font-weight: 600;
  opacity: 1;
}

.vox3d-empty {
  padding: 24px;
  text-align: center;
  opacity: 0.6;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
</style>
