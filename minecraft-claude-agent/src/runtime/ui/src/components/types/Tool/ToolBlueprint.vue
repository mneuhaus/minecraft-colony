<template>
  <MessageBlock
    eyebrow="Blueprint"
    title="Blueprint"
    :tone="issues.length ? 'warning' : 'info'"
    padding="lg"
    :shadow="true"
  >
    <template #meta>
      <span v-if="bp" class="bp-chip">{{ bp.name }}</span>
      <span class="bp-chip">{{ voxCount }} vox</span>
      <span class="bp-chip" v-if="issues.length">{{ issues.length }} issues</span>
    </template>
    <template #actions>
      <button class="view-toggle" @click="toggleView">{{ show3D ? '📊 List' : '🎮 3D' }}</button>
    </template>

    <div class="bp-meta" v-if="bp">
      <div class="bp-row"><span class="bp-k">description</span><span class="bp-v">{{ bp.description || '—' }}</span></div>
    </div>

    <div v-if="show3D" class="bp-3d-container">
      <div ref="canvasContainer" class="bp-canvas"></div>
      <div class="bp-3d-controls"><span class="control-hint">🖱️ Drag to rotate • Scroll to zoom</span></div>
    </div>

    <div v-else>
      <div class="bp-summary" v-if="Object.keys(summary).length">
        <div class="summary-row" v-for="(cnt, id) in summary" :key="id">
          <span class="summary-id">{{ id }}</span>
          <span class="summary-count">{{ cnt }}</span>
        </div>
      </div>
      <div v-else class="bp-empty">No voxels</div>
    </div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import MessageBlock from '../../MessageBlock.vue';

const props = defineProps<{ item: any }>();

const raw = computed(() => {
  const o = props.item?.payload?.output;
  if (typeof o === 'string') { try { return JSON.parse(o); } catch { return o; } }
  return o ?? {};
});

const bp = computed(() => {
  const r = raw.value;
  if (r && typeof r === 'object') {
    if (r.blueprint) return r.blueprint;
    // create/update return the blueprint directly
    if (r.name && r.vox) return r;
  }
  return null as any;
});

const issues = computed(()=> Array.isArray(raw.value?.issues) ? raw.value.issues : []);
const vox = computed(()=> Array.isArray(bp.value?.vox) ? bp.value.vox : []);
const voxCount = computed(()=> vox.value.length);
const summary = computed(()=> {
  const s: Record<string, number> = {};
  for (const v of vox.value) s[v.id] = (s[v.id] || 0) + 1;
  return s;
});

const show3D = ref(true);
const canvasContainer = ref<HTMLDivElement|null>(null);
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let animationId: number | null = null;

function cleanup(){
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  if (controls) controls.dispose();
  controls = null;
  if (renderer) {
    renderer.dispose();
    if (canvasContainer.value && renderer.domElement.parentNode === canvasContainer.value) canvasContainer.value.removeChild(renderer.domElement);
  }
  renderer = null; scene = null; camera = null;
}

function init3D(){
  if (!canvasContainer.value) return;
  cleanup();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  camera = new THREE.PerspectiveCamera(50, 800/600, 0.1, 5000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(800, 600);
  renderer.setPixelRatio(window.devicePixelRatio);
  canvasContainer.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera!, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.05;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(10,10,10); scene.add(dl);

  // bounds
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity, minZ=Infinity, maxZ=-Infinity;
  for (const v of vox.value) { if (v.x<minX) minX=v.x; if (v.x>maxX) maxX=v.x; if (v.y<minY) minY=v.y; if (v.y>maxY) maxY=v.y; if (v.z<minZ) minZ=v.z; if (v.z>maxZ) maxZ=v.z; }
  const size = Math.max(8, maxX-minX+1, maxY-minY+1, maxZ-minZ+1);
  const dist = size * 1.8; camera!.position.set(dist, dist, dist); camera!.lookAt(0,0,0);

  const colors: Record<string, number> = { stone:0x808080, dirt:0x8B4513, grass_block:0x7CFC00, sand:0xE4D96F, oak_log:0x6F4E37, oak_planks:0x9c7f4e, glass:0x88ccee };
  const colorFor = (id: string) => { const n = id.replace('minecraft:','').toLowerCase(); return colors[n] ?? 0xCCCCCC; };

  for (const v of vox.value) {
    const geom = new THREE.BoxGeometry(0.98,0.98,0.98);
    const mat = new THREE.MeshLambertMaterial({ color: colorFor(v.id) });
    const cube = new THREE.Mesh(geom, mat);
    cube.position.set(v.x, v.y, v.z);
    const edges = new THREE.EdgesGeometry(geom);
    cube.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true })));
    scene!.add(cube);
  }

  const grid = new THREE.GridHelper(size*2, size*2, 0x444444, 0x222222);
  scene!.add(grid);

  function animate(){ animationId = requestAnimationFrame(animate); if (controls) controls.update(); if (renderer && scene && camera) renderer.render(scene, camera); }
  animate();
}

onMounted(()=> { if (show3D.value) setTimeout(init3D, 30); });
onBeforeUnmount(()=> cleanup());
watch(show3D, (v)=> { if (v) setTimeout(init3D, 30); else cleanup(); });
watch(vox, ()=> { if (show3D.value) setTimeout(init3D, 30); });

function toggleView() {
  show3D.value = !show3D.value;
}
</script>

<style scoped>
.view-toggle {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-primary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}
.bp-chip {
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.bp-meta { display: grid; grid-template-columns: auto 1fr; gap: var(--spacing-xs) var(--spacing-md); margin-bottom: var(--spacing-sm); }
.bp-row { display: contents; }
.bp-k { color: var(--color-text-muted); font-size: var(--font-xs); text-transform: uppercase; }
.bp-v { color: var(--color-text-primary); font-size: var(--font-sm); }

.bp-3d-container {
  margin-top: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.bp-canvas {
  width: 100%;
  height: 360px;
  background: #0f1115;
}
.bp-3d-controls {
  background: rgba(255,255,255,0.02);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-xs);
  color: var(--color-text-muted);
}
.bp-summary {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-md);
}
.summary-row {
  display: grid;
  grid-template-columns: 1fr 60px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-subtle);
}
.summary-row:last-child { border-bottom: none; }
.summary-id { color: var(--color-text-primary); font-size: var(--font-sm); }
.summary-count { text-align: right; font-family: 'Monaco','Courier New',monospace; }
.bp-empty { color: var(--color-text-muted); font-size: var(--font-sm); margin-top: var(--spacing-md); }
</style>
