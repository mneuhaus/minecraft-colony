<template>
  <div class="tl-item__body tool-blueprint">
    <div class="tool-header">
      <span class="tool-name">Blueprint</span>
      <button class="view-toggle" @click="show3D = !show3D">{{ show3D ? '📊 List' : '🎮 3D' }}</button>
    </div>

    <div class="bp-meta" v-if="bp">
      <div class="bp-row"><span class="bp-k">name</span><span class="bp-v">{{ bp.name }}</span></div>
      <div class="bp-row"><span class="bp-k">description</span><span class="bp-v">{{ bp.description || '—' }}</span></div>
      <div class="bp-row"><span class="bp-k">voxels</span><span class="bp-v">{{ voxCount }}</span></div>
      <div class="bp-row" v-if="issues.length"><span class="bp-k">issues</span><span class="bp-v">{{ issues.join(', ') }}</span></div>
    </div>

    <!-- 3D viewer -->
    <div v-if="show3D" class="bp-3d-container">
      <div ref="canvasContainer" class="bp-canvas"></div>
      <div class="bp-3d-controls"><span class="control-hint">🖱️ Drag to rotate • Scroll to zoom</span></div>
    </div>

    <!-- Summary list view -->
    <div v-else>
      <div class="bp-summary" v-if="Object.keys(summary).length">
        <div class="summary-row" v-for="(cnt, id) in summary" :key="id">
          <span class="summary-id">{{ id }}</span>
          <span class="summary-count">{{ cnt }}</span>
        </div>
      </div>
      <div v-else class="bp-empty">No voxels</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
</script>

<style scoped>
.tool-header { display:flex; justify-content: space-between; align-items:center; font-weight:600; color:#EAEAEA; margin-bottom:8px; font-size:13px; }
.view-toggle { background: rgba(74,158,255,0.1); border:1px solid rgba(74,158,255,0.3); color:#4A9EFF; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; transition:all .2s; }
.bp-meta { display:grid; grid-template-columns: auto 1fr; gap:4px 8px; margin-bottom:8px; }
.bp-row { display: contents; }
.bp-k { color:#B3B3B3; font-size:11px; }
.bp-v { color:#EAEAEA; font-size:11px; font-family:'Monaco','Courier New',monospace; }
.bp-3d-container { margin-top:8px; border:1px solid #2E2E2E; border-radius:6px; overflow:hidden; }
.bp-canvas { width:800px; height:600px; background:#1a1a1a; }
.bp-3d-controls { background:#202020; padding:6px 10px; border-top:1px solid #2E2E2E; color:#7A7A7A; font-size:10px; }
.bp-summary { border:1px solid #2E2E2E; border-radius:6px; }
.summary-row { display:grid; grid-template-columns: 1fr 60px; padding:6px 8px; border-bottom:1px solid #2E2E2E; }
.summary-row:last-child { border-bottom:none; }
.summary-id { color:#EAEAEA; font-size:12px; }
.summary-count { text-align:right; font-family:'Monaco','Courier New',monospace; }
.bp-empty { color:#7A7A7A; font-size:12px; }
</style>

