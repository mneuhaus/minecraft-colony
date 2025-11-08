<template>
  <MessageBlock
    eyebrow="Spatial"
    title="Vox Snapshot"
    :tone="tone"
    padding="lg"
    :shadow="true"
  >
    <template #meta>
      <span class="vox-chip">radius {{ radius }}</span>
      <span class="vox-chip" v-if="grep.length">filter: {{ grep.join(', ') }}</span>
      <span class="vox-chip">blocks {{ blockCount }}</span>
    </template>
    <template #actions>
      <button class="view-toggle" @click="toggleView">
        {{ show3D ? '📊 List' : '🎮 3D' }}
      </button>
    </template>

    <p class="tool-hint">
      3D voxel snapshot of the nearby world for precise navigation. Shows exact block IDs and positions around the bot.
    </p>

    <div class="vox-row">
      <span class="vox-key">radius</span>
      <span class="vox-val">{{ radius }}</span>
      <span class="vox-key" v-if="grep.length">filter</span>
      <span class="vox-val" v-if="grep.length">{{ grep.join(', ') }}</span>
    </div>

    <div v-if="show3D" class="vox-3d-container">
      <div ref="canvasContainer" class="vox-canvas"></div>
      <div class="vox-3d-controls">
        <span class="control-hint">🖱️ Drag to rotate • Scroll to zoom</span>
      </div>
    </div>

    <div v-else>
      <div class="vox-blocks" v-if="blockCount > 0">
        <div class="blocks-header">
          <span class="blocks-label">Blocks</span>
          <span class="blocks-count">{{ blockCount }}</span>
        </div>
        <div class="blocks-grid">
          <div v-for="[sel, block] in blocks.slice(0, maxBlocks)" :key="sel" class="block-item">
            <span class="block-sel">{{ sel }}</span>
            <span class="block-arrow">→</span>
            <span class="block-id">{{ block.replace('minecraft:', '') }}</span>
          </div>
          <div v-if="blockCount > maxBlocks" class="block-item block-more">
            +{{ blockCount - maxBlocks }} more...
          </div>
        </div>
      </div>
    </div>

    <div class="vox-hazards" v-if="hazards.length">
      <span class="hazards-label">Hazards</span>
      <span class="hazards-list">{{ hazards.join(', ') }}</span>
    </div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import MessageBlock from '../../MessageBlock.vue';

const props = defineProps<{ item: any }>();
const show3D = ref(false); // Default to list view
const canvasContainer = ref<HTMLDivElement | null>(null);

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let animationId: number | null = null;

const raw = computed(()=> {
  let out = props.item.payload?.output;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch {} }
  return out || {};
});

const radius = computed(()=> raw.value?.window?.radius ?? (props.item.payload?.params_summary?.radius ?? props.item.payload?.input?.radius ?? '?'));
const hazards = computed(()=> Array.isArray(raw.value?.predicates?.HAZARDS) ? raw.value.predicates.HAZARDS : []);
const grep = computed(()=> {
  const p = props.item.payload?.params_summary ?? props.item.payload?.input ?? {};
  const g = p.grep || p.filter || raw.value?.grep;
  if (Array.isArray(g)) return g;
  return [];
});
const blocks = computed(()=> {
  if (Array.isArray(raw.value?.voxels)) {
    return raw.value.voxels.map((v: any) => [ `(${v.x},${v.y},${v.z})`, v.id ]);
  }
  const vox = raw.value?.vox;
  if (!vox || typeof vox !== 'object') return [];
  return Object.entries(vox);
});
const blockCount = computed(()=> blocks.value.length);
const maxBlocks = 12;
const tone = computed(() => hazards.value.length ? 'warning' : 'info');

// Legacy selector parsing removed; voxels now provided as world coordinates

// Get color for block type
function getBlockColor(blockName: string): number {
  const name = blockName.replace('minecraft:', '').toLowerCase();

  // Common block colors
  const colors: Record<string, number> = {
    stone: 0x808080,
    granite: 0xa07060,
    dirt: 0x8B4513,
    grass_block: 0x7CFC00,
    sand: 0xE4D96F,
    sandstone: 0xC2B280,
    oak_log: 0x6F4E37,
    oak_leaves: 0x228B22,
    birch_log: 0xD7CEB2,
    spruce_log: 0x5C4033,
    water: 0x4A9EFF,
    lava: 0xFF6600,
    gravel: 0x808080,
    cobblestone: 0x7D7D7D,
    bedrock: 0x333333,
  };

  return colors[name] ?? 0xCCCCCC; // Default gray
}

function init3DViewer() {
  if (!canvasContainer.value) return;

  // Clear existing renderer
  cleanup3DViewer();

  const container = canvasContainer.value;
  const width = container.clientWidth || 640;
  const height = Math.max(320, Math.min(520, width * 0.6));

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Camera (fit to voxel bounds)
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Add voxels (world coordinates → center relative to origin)
  const voxels = Array.isArray(raw.value?.voxels) ? raw.value.voxels : [];
  const origin = (raw.value?.window?.origin) ? raw.value.window.origin : { x: 0, y: 0, z: 0 };

  // Compute bounds for camera fitting
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of voxels) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }
  const sizeX = (isFinite(minX) ? (maxX - minX + 1) : 8);
  const sizeY = (isFinite(minY) ? (maxY - minY + 1) : 8);
  const sizeZ = (isFinite(minZ) ? (maxZ - minZ + 1) : 8);
  const maxDim = Math.max(sizeX, sizeY, sizeZ, 8);

  // Place camera at a distance proportional to scene size
  const dist = maxDim * 1.8;
  camera.position.set(dist, dist, dist);
  camera.lookAt(0, 0, 0);

  for (const v of voxels) {
    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const material = new THREE.MeshLambertMaterial({ color: getBlockColor(String(v.id)) });
    const cube = new THREE.Mesh(geometry, material);
    const rx = v.x - origin.x;
    const ry = v.y - origin.y;
    const rz = v.z - origin.z;
    cube.position.set(rx, ry, rz);

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true }));
    cube.add(line);

    scene.add(cube);
  }

  // Add grid helper at y=0 (centered)
const gridSize = Math.max(10, maxDim * 2);
  const gridHelper = new THREE.GridHelper(gridSize, gridSize, 0x444444, 0x222222);
  scene.add(gridHelper);

  // Animation loop
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  animate();
}

function cleanup3DViewer() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (controls) {
    controls.dispose();
    controls = null;
  }
  if (renderer) {
    renderer.dispose();
    if (canvasContainer.value && renderer.domElement.parentNode === canvasContainer.value) {
      canvasContainer.value.removeChild(renderer.domElement);
    }
    renderer = null;
  }
  scene = null;
  camera = null;
}

onMounted(() => {
  if (show3D.value) {
    setTimeout(() => init3DViewer(), 50);
  }
});

watch(show3D, (newVal) => {
  if (newVal) {
    setTimeout(() => init3DViewer(), 50);
  } else {
    cleanup3DViewer();
  }
});

onBeforeUnmount(() => {
  cleanup3DViewer();
});

function toggleView() {
  show3D.value = !show3D.value;
}
</script>

<style scoped>
.view-toggle {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  color: var(--color-text-primary);
}
.tool-hint {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  margin-bottom: var(--spacing-sm);
}
.vox-chip {
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
}
.vox-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: baseline;
  margin-bottom: var(--spacing-sm);
}
.vox-key { color: var(--color-text-muted); font-size: var(--font-xs); text-transform: uppercase; }
.vox-val { color: var(--color-text-primary); font-size: var(--font-sm); font-family: 'Monaco','Courier New',monospace; }

.vox-3d-container {
  margin-top: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.vox-canvas {
  width: 100%;
  height: 360px;
  background: #0f1115;
}
.vox-3d-controls {
  background: rgba(255,255,255,0.02);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: 1px solid var(--color-border-subtle);
}
.control-hint { font-size: var(--font-xs); color: var(--color-text-muted); }

.vox-blocks {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-subtle);
}
.blocks-header {
  display: flex;
  gap: var(--spacing-xs);
  align-items: baseline;
  margin-bottom: var(--spacing-xs);
}
.blocks-label { color: var(--color-accent); font-size: var(--font-xs); font-weight: 600; }
.blocks-count { color: var(--color-text-muted); font-size: var(--font-xs); }
.blocks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-xs);
  font-size: var(--font-xs);
}
.block-item {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 6px;
  background: rgba(255,255,255,0.02);
  border-radius: var(--radius-sm);
}
.block-sel { color: var(--color-accent); font-family: 'Monaco','Courier New',monospace; font-weight: 600; }
.block-id { color: var(--color-text-primary); font-family: 'Monaco','Courier New',monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.block-more { grid-column: 1 / -1; justify-content: center; color: var(--color-text-muted); font-style: italic; }

.vox-hazards {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-subtle);
}
.hazards-label { color: var(--color-warning); font-size: var(--font-xs); font-weight: 600; text-transform: uppercase; }
.hazards-list { color: var(--color-text-primary); font-size: var(--font-sm); }
</style>
