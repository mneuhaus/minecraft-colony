<template>
  <MessageBlock class="block-changes-card" :collapsible="true" :default-collapsed="true">
    <template #title>
      <span class="bc-title">Block Changes</span>
    </template>
    <template #meta>
      <span class="bc-job-id">{{ jobId }}</span>
      <span class="bc-count">{{ totalChanges }} changes</span>
    </template>
    <template #actions>
      <button class="inspector-toggle" @click="$emit('openInspector', item)" title="Open Inspector">
        🔍
      </button>
    </template>

    <div v-if="changes.length > 0">
      <!-- List View -->
      <div class="bc-list">
        <div class="bc-list-header">
          <span>Detailed Changes</span>
        </div>
        <div class="bc-list-items">
          <div v-for="(change, idx) in changes" :key="idx" class="bc-list-item">
            <span class="bc-list-item__action" :data-action="change.action">{{ change.action }}</span>
            <span class="bc-list-item__block">{{ change.block_id }}</span>
            <span class="bc-list-item__pos">@ {{ change.x }}, {{ change.y }}, {{ change.z }}</span>
            <span class="bc-list-item__cmd" v-if="change.command">{{ change.command }}</span>
          </div>
        </div>
      </div>

      <!-- 3D Viewer -->
      <div class="bc-viewer">
        <div class="bc-viewer-header">3D Visualization</div>
        <canvas ref="canvas" class="bc-canvas"></canvas>
        <div class="bc-controls">
          <button @click="resetCamera" class="bc-btn">Reset View</button>
          <label class="bc-checkbox">
            <input type="checkbox" v-model="showPlaced" @change="updateScene" />
            <span>Show Placed</span>
          </label>
          <label class="bc-checkbox">
            <input type="checkbox" v-model="showDestroyed" @change="updateScene" />
            <span>Show Destroyed</span>
          </label>
        </div>
      </div>
    </div>

    <div v-else class="bc-empty">
      No block changes recorded for this job.
    </div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import MessageBlock from '../../MessageBlock.vue';

const props = defineProps<{ item: any }>();
defineEmits<{ openInspector: [item: any] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const showPlaced = ref(true);
const showDestroyed = ref(true);

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let animationId: number | null = null;

const fn = computed(() => props.item?.payload?.output ? JSON.parse(props.item.payload.output) : {});
const jobId = computed(() => fn.value.job_id || 'unknown');
const totalChanges = computed(() => fn.value.total_changes || 0);
const changes = computed(() => fn.value.changes || []);

// Extract movement traces if available (from craftscript_logs.traces with kind='movement')
const movements = computed(() => {
  if (!fn.value.movements) return [];
  return fn.value.movements.filter((m: any) => m.kind === 'movement');
});

const placedCount = computed(() => changes.value.filter((c: any) => c.action === 'placed').length);
const destroyedCount = computed(() => changes.value.filter((c: any) => c.action === 'destroyed').length);

// Minecraft block colors (simplified)
const blockColors: Record<string, number> = {
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
  air: 0x000000,
  // Add more as needed
};

function getBlockColor(blockId: string): number {
  const id = blockId.replace('minecraft:', '');
  return blockColors[id] || 0x888888; // Default gray
}

function initThree() {
  if (!canvas.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Camera
  const aspect = canvas.value.offsetWidth / canvas.value.offsetHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);

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

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
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
  if (!scene) return;

  // Clear existing blocks
  while (scene.children.length > 0) {
    const child = scene.children[0];
    scene.remove(child);
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) (child as any).material.dispose();
  }

  // Re-add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Calculate bounds
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const change of changes.value) {
    minX = Math.min(minX, change.x);
    minY = Math.min(minY, change.y);
    minZ = Math.min(minZ, change.z);
    maxX = Math.max(maxX, change.x);
    maxY = Math.max(maxY, change.y);
    maxZ = Math.max(maxZ, change.z);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Add blocks
  for (const change of changes.value) {
    if (change.action === 'placed' && !showPlaced.value) continue;
    if (change.action === 'destroyed' && !showDestroyed.value) continue;

    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const color = getBlockColor(change.block_id);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: change.action === 'placed' ? 0x00ff00 : 0xff0000,
      emissiveIntensity: 0.3,
      metalness: 0.1,
      roughness: 0.8,
    });

    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(
      change.x - centerX,
      change.y - centerY,
      change.z - centerZ
    );

    // Add edge glow
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: change.action === 'placed' ? 0x00ff00 : 0xff0000,
      linewidth: 2,
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    cube.add(wireframe);

    scene.add(cube);
  }

  // Add movement path if available
  if (movements.value.length > 0) {
    const pathPoints: THREE.Vector3[] = [];

    for (const move of movements.value) {
      if (move.data?.from) {
        pathPoints.push(new THREE.Vector3(
          move.data.from.x - centerX,
          move.data.from.y - centerY,
          move.data.from.z - centerZ
        ));
      }
      if (move.data?.arrived) {
        pathPoints.push(new THREE.Vector3(
          move.data.arrived.x - centerX,
          move.data.arrived.y - centerY,
          move.data.arrived.z - centerZ
        ));
      }
    }

    if (pathPoints.length > 1) {
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
      const pathMaterial = new THREE.LineBasicMaterial({
        color: 0xffff00,
        linewidth: 3,
      });
      const pathLine = new THREE.Line(pathGeometry, pathMaterial);
      scene.add(pathLine);

      // Add spheres at movement points
      for (const point of pathPoints) {
        const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(point);
        scene.add(sphere);
      }
    }
  }

  // Adjust camera to fit scene
  if (camera && controls) {
    const distance = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 1.5;
    camera.position.set(distance, distance, distance);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function resetCamera() {
  if (!camera || !controls) return;
  camera.position.set(20, 20, 20);
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
  if (changes.value.length > 0) {
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

watch(() => changes.value.length, (newLen) => {
  if (newLen > 0 && !scene) {
    initThree();
  }
});
</script>

<style scoped>
.block-changes-card {
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
  border: 1px solid #3a3a3a;
}

.bc-title {
  font-size: 14px;
  font-weight: 600;
  color: #00d9ff;
}

.bc-job-id {
  color: #888;
}

.bc-count {
  color: #00d9ff;
  font-weight: 600;
}

.bc-list {
  margin-bottom: 16px;
  padding: 10px;
  background: #0A1A1A;
  border: 1px solid #00d9ff;
  border-radius: 8px;
}

.bc-list-header {
  color: #00d9ff;
  font-weight: 600;
  font-size: 13px;
  text-shadow: 0 0 8px rgba(0, 217, 255, 0.5);
  margin-bottom: 8px;
}

.bc-list-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 300px;
  overflow-y: auto;
}

.bc-list-item {
  display: grid;
  grid-template-columns: 70px 120px 140px 1fr;
  gap: 8px;
  align-items: baseline;
  font-size: 11px;
  padding: 6px 8px;
  background: #0D1F1F;
  border-radius: 4px;
  border: 1px solid #1A3A3A;
}

.bc-list-item:hover {
  background: #102828;
  border-color: #00d9ff40;
}

.bc-list-item__action {
  color: #EAEAEA;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.bc-list-item__action[data-action="placed"] {
  color: #34D399;
}

.bc-list-item__action[data-action="destroyed"] {
  color: #F87171;
}

.bc-list-item__block {
  color: #00d9ff;
  font-family: monospace;
  font-size: 10px;
}

.bc-list-item__pos {
  color: #B3B3B3;
  font-family: monospace;
  font-size: 10px;
}

.bc-list-item__cmd {
  color: #7A7A7A;
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bc-viewer {
  position: relative;
}

.bc-viewer-header {
  color: #00d9ff;
  font-weight: 600;
  font-size: 13px;
  text-shadow: 0 0 8px rgba(0, 217, 255, 0.5);
  margin-bottom: 8px;
}

.bc-canvas {
  width: 100%;
  height: 400px;
  border-radius: 6px;
  background: #0a0a0a;
  border: 1px solid #3a3a3a;
}

.bc-controls {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: center;
}

.bc-btn {
  background: #00d9ff;
  color: #000;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s;
}

.bc-btn:hover {
  background: #00b8d4;
}

.bc-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.bc-checkbox input[type="checkbox"] {
  cursor: pointer;
}

.bc-empty {
  text-align: center;
  padding: 24px;
  color: #666;
  font-size: 13px;
}

.inspector-toggle {
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4A9EFF;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.7;
}

.inspector-toggle:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: rgba(74, 158, 255, 0.5);
  opacity: 1;
}
</style>
