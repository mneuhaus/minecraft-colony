<template>
  <div>
    <div v-if="changes.length > 0">
      <div class="bc-entries">
        <div
          v-for="(change, idx) in changes"
          :key="idx"
          class="bc-entry"
          :class="`bc-entry--${change.action}`"
        >
          <div class="bc-entry-header">
            <span class="bc-action" :data-action="change.action">{{ change.action.toUpperCase() }}</span>
            <span class="bc-block">{{ change.block_id.replace('minecraft:', '') }}</span>
            <span class="bc-pos">@ {{ change.x }}, {{ change.y }}, {{ change.z }}</span>
            <span v-if="change.command" class="bc-cmd">{{ change.command }}</span>
          </div>
        </div>
      </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
const tone = computed(() => totalChanges.value > 0 ? 'info' : 'neutral');

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
.bc-chip {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  opacity: 0.65;
}

.bc-entries {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}
.bc-entry {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 4px 8px;
  font-size: 14px;
}
.bc-entry--destroyed { border-color: rgba(248,113,113,0.4); }
.bc-entry--placed { border-color: rgba(52,211,153,0.4); }
.bc-entry-header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bc-action {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 13px;
}
.bc-action[data-action="placed"] { color: var(--color-success); }
.bc-action[data-action="destroyed"] { color: var(--color-danger); }
.bc-block { font-family: 'Courier New', monospace; ; }
.bc-pos { font-size: 13px; opacity: 0.65; }
.bc-cmd { font-size: 13px; color: var(--color-accent); }

.bc-viewer {
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 12px;
  background: rgba(0,0,0,0.2);
}
.bc-viewer-header {
  font-weight: 600;
  margin-bottom: 8px;
}
.bc-canvas {
  width: 100%;
  height: 260px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #0f1115;
}
.bc-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.bc-btn {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  ;
  border-radius: 6px;
  padding: 4px 8px;
}
.bc-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.bc-empty {
  margin: 0;
  padding: 12px;
  text-align: center;
  opacity: 0.65;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.inspector-toggle {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  padding: 4px 8px;
  border-radius: 6px;
  ;
}
</style>
