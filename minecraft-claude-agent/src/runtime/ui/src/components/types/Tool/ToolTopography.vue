<template>
  <div class="tl-item__body tool-topography">
    <div class="tool-header">
      <span class="tool-name">Get Topography</span>
      <button class="view-toggle" @click="show3D = !show3D">
        {{ show3D ? '📊 List' : '🗺️ 3D' }}
      </button>
    </div>
    <div class="topo-row">
      <span class="topo-key">radius</span>
      <span class="topo-val">{{ radius }}</span>
    </div>

    <!-- 3D Terrain Viewer -->
    <div v-if="show3D" class="topo-3d-container">
      <div ref="canvasContainer" class="topo-canvas"></div>
      <div class="topo-3d-controls">
        <span class="control-hint">🖱️ Drag to rotate • Scroll to zoom</span>
      </div>
    </div>

    <!-- Text List View -->
    <div v-else>
      <div class="topo-summary" v-if="summary">
        <div class="summary-row">
          <span class="summary-label">Height Range:</span>
          <span class="summary-val">{{ summary.min }} to {{ summary.max }}</span>
        </div>
        <div class="summary-row" v-if="summary.flat_cells !== undefined">
          <span class="summary-label">Flat Cells:</span>
          <span class="summary-val">{{ summary.flat_cells }}</span>
        </div>
      </div>
      <div class="topo-slopes" v-if="slopeCount > 0">
        <div class="slopes-header">
          <span class="slopes-label">Terrain Analysis:</span>
          <span class="slopes-count">{{ slopeCount }} cells</span>
        </div>
        <div class="slopes-grid">
          <div v-for="[type, count] in slopeSummary" :key="type" class="slope-item">
            <span class="slope-type" :class="`slope-${type}`">{{ formatSlope(type) }}</span>
            <span class="slope-arrow">→</span>
            <span class="slope-count">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
  console.log('raw - initial output:', out, 'type:', typeof out);
  if (typeof out === 'string') {
    try {
      out = JSON.parse(out);
      console.log('raw - parsed JSON:', out);
    } catch (e) {
      console.error('raw - JSON parse error:', e);
    }
  }
  return out || {};
});
const radius = computed(()=> raw.value?.grid?.size?.[0] ? Math.floor(raw.value.grid.size[0] / 2) : (props.item.payload?.params_summary?.radius ?? props.item.payload?.input?.radius ?? '?'));
const summary = computed(()=> raw.value?.summary || null);
const slopes = computed(()=> {
  const s = raw.value?.slope;
  if (!s || typeof s !== 'object') return {};
  return s;
});
const slopeCount = computed(()=> Object.keys(slopes.value).length);
const slopeSummary = computed(()=> {
  const counts: Record<string, number> = {};
  for (const slope of Object.values(slopes.value)) {
    const s = String(slope);
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
});
const formatSlope = (type: string) => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// Get height grid data - topography returns heightmap keyed by "x,z"
const heightGrid = computed(() => {
  console.log('heightGrid computed - raw.value:', raw.value);

  const heightmap = raw.value?.heightmap;
  const grid = raw.value?.grid;

  console.log('heightmap:', heightmap, 'grid:', grid);

  if (!heightmap || typeof heightmap !== 'object') {
    console.warn('No valid heightmap found');
    return null;
  }

  const size = grid?.size || [13, 13]; // default for radius=6
  return { heightmap, size };
});

// Color based on height and slope
function getTerrainColor(height: number, minHeight: number, maxHeight: number, slope?: string): number {
  const range = maxHeight - minHeight || 1;
  const normalized = (height - minHeight) / range;

  // Color by slope type if available
  if (slope) {
    if (slope.includes('steep')) return 0xFF6B6B;
    if (slope.includes('down')) return 0xFFB86C;
    if (slope.includes('gentle')) return 0x7CFC00;
    if (slope.includes('flat')) return 0x4A9EFF;
  }

  // Otherwise color by height (low=brown, mid=green, high=white)
  if (normalized < 0.3) return 0x8B4513; // Brown (low)
  if (normalized < 0.6) return 0x228B22; // Green (mid)
  return 0xE8E8E8; // Light gray (high)
}

function init3DViewer() {
  console.log('init3DViewer called', {
    hasContainer: !!canvasContainer.value,
    heightGrid: heightGrid.value,
    raw: raw.value
  });

  if (!canvasContainer.value || !heightGrid.value) {
    console.warn('Cannot init 3D viewer: missing container or heightGrid');
    return;
  }

  cleanup3DViewer();

  const container = canvasContainer.value;
  const width = 800;
  const height = 600;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Camera
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  const gridSize = Math.max(heightGrid.value.size[0], heightGrid.value.size[1]);
  camera.position.set(gridSize * 0.8, gridSize * 0.8, gridSize * 0.8);
  camera.lookAt(0, 0, 0);

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

  // Create terrain mesh from heightmap with keys like "x,z"
  const { heightmap, size } = heightGrid.value;
  const [cols, rows] = size;
  const minHeight = summary.value?.min ?? 0;
  const maxHeight = summary.value?.max ?? 100;
  const radius = Math.floor(cols / 2);

  // Create a box for each heightmap entry
  for (const [key, h] of Object.entries(heightmap)) {
    const parts = String(key).split(',');
    if (parts.length !== 2) continue;
    const wx = parseInt(parts[0], 10);
    const wz = parseInt(parts[1], 10);
    const slope = slopes.value[key];

    // Height needs to be scaled appropriately
    const heightScale = Math.abs(h) > 0 ? Math.max(Math.abs(h) / 2, 0.5) : 0.1;
    const geometry = new THREE.BoxGeometry(0.9, heightScale, 0.9);
    const material = new THREE.MeshLambertMaterial({
      color: getTerrainColor(h, minHeight, maxHeight, slope)
    });
    const cube = new THREE.Mesh(geometry, material);

    // Position cube
    // Place cubes in world X,Z plane (anchor at origin 0,0)
    cube.position.set(wx, h / 2, wz);

    // Add edge lines
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true }));
    cube.add(line);

    scene.add(cube);
  }

  // Add grid helper at y=0
  const gridHelper = new THREE.GridHelper(Math.max(cols, rows), Math.max(cols, rows), 0x444444, 0x222222);
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
</script>

<style scoped>
.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 8px;
  font-size: 13px;
}
.view-toggle {
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4A9EFF;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}
.view-toggle:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: rgba(74, 158, 255, 0.5);
}
.topo-3d-container {
  margin-top: 8px;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  overflow: hidden;
}
.topo-canvas {
  width: 800px;
  height: 600px;
  background: #1a1a1a;
}
.topo-3d-controls {
  background: #202020;
  padding: 6px 10px;
  border-top: 1px solid #2E2E2E;
}
.control-hint {
  font-size: 10px;
  color: #7A7A7A;
}
.topo-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
}
.topo-key {
  color: #B3B3B3;
  font-size: 11px;
}
.topo-val {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
}
.topo-summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2E2E2E;
}
.summary-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 4px;
}
.summary-label {
  color: #B3B3B3;
  font-size: 11px;
  min-width: 80px;
}
.summary-val {
  color: #EAEAEA;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
}
.topo-slopes {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2E2E2E;
}
.slopes-header {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin-bottom: 6px;
}
.slopes-label {
  color: #4A9EFF;
  font-size: 11px;
  font-weight: 600;
}
.slopes-count {
  color: #7A7A7A;
  font-size: 10px;
}
.slopes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  font-size: 10px;
}
.slope-item {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}
.slope-type {
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
  min-width: 80px;
  font-size: 10px;
}
.slope-gentle_up {
  color: #7CFC00;
}
.slope-down {
  color: #FF6B6B;
}
.slope-flat {
  color: #4A9EFF;
}
.slope-steep {
  color: #FFB86C;
}
.slope-arrow {
  color: #4A4A4A;
  font-size: 9px;
}
.slope-count {
  color: #EAEAEA;
  font-family: 'Monaco', 'Courier New', monospace;
}
</style>
