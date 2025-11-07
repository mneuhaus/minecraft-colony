<template>
  <div v-if="!embedded" class="bp-detail__backdrop" @click.self="$emit('close')">
    <div class="bp-detail">
      <div class="bp-detail__hdr">
        <div class="bp-detail__title">Blueprint: {{ data?.blueprint?.name || '—' }}</div>
        <button class="bp-detail__close" @click="$emit('close')">×</button>
      </div>

      <div class="bp-detail__section" v-if="data">
        <div class="bp-kv"><span class="bp-k">Description</span><span class="bp-v">{{ data.blueprint?.description || '—' }}</span></div>
        <div class="bp-kv"><span class="bp-k">Voxels</span><span class="bp-v">{{ voxelCount }}</span></div>
        <div class="bp-kv"><span class="bp-k">Updated</span><span class="bp-v">{{ data.blueprint?.meta?.updated_at || '—' }}</span></div>
        <div class="bp-val" v-if="!data.ok">
          <div class="bp-issues">
            <div class="bp-issues__title">Validation Issues</div>
            <ul>
              <li v-for="i in data.issues" :key="i">{{ i }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="bp-detail__section">
        <div class="bp-subtitle">Block Summary</div>
        <div class="bp-table" v-if="Object.keys(blockSummary).length">
          <div class="bp-row bp-row--hdr"><div>Block</div><div>Count</div></div>
          <div class="bp-row" v-for="(cnt, id) in blockSummary" :key="id"><div>{{ id }}</div><div>{{ cnt }}</div></div>
        </div>
        <div v-else class="bp-empty">No voxels</div>
      </div>

      <div class="bp-detail__section">
        <div class="bp-subtitle">Preview</div>
        <div class="bp-preview-toggles">
          <button class="bp-btn" :class="show3D ? 'bp-btn--active' : ''" @click="show3D=true">🎮 3D</button>
          <button class="bp-btn" :class="!show3D ? 'bp-btn--active' : ''" @click="show3D=false">📊 List</button>
        </div>
        <div v-if="show3D" class="bp-3d-wrap">
          <div class="bp-3d-title">Blueprint (origin view)</div>
          <div ref="canvasBlueprint" class="bp-canvas"></div>
          <div v-if="instantiated" class="bp-3d-title">Instantiated (world coords)</div>
          <div v-if="instantiated" ref="canvasInst" class="bp-canvas"></div>
          <div class="bp-3d-controls"><span class="control-hint">🖱️ Drag to rotate • Scroll to zoom</span></div>
        </div>
        <div v-else>
          <div class="bp-subsubtitle">Blueprint Voxels</div>
          <div class="bp-kv"><span class="bp-k">Count</span><span class="bp-v">{{ voxelCount }}</span></div>
          <pre class="bp-pre">{{ listPreview }}</pre>
        </div>
      </div>

      <div class="bp-detail__section">
        <div class="bp-subtitle">Instantiate</div>
        <div class="bp-form">
          <label>Origin X <input v-model.number="origin.x" type="number" /></label>
          <label>Y <input v-model.number="origin.y" type="number" /></label>
          <label>Z <input v-model.number="origin.z" type="number" /></label>
          <label>Rotation
            <select v-model.number="rotation">
              <option :value="0">0°</option>
              <option :value="90">90°</option>
              <option :value="180">180°</option>
              <option :value="270">270°</option>
            </select>
          </label>
          <button class="bp-btn" @click="instantiate" :disabled="instantiating">{{ instantiating ? 'Instantiating…' : 'Instantiate' }}</button>
        </div>
        <div v-if="instantiated" class="bp-preview">
          <div class="bp-kv"><span class="bp-k">Preview voxels</span><span class="bp-v">{{ instantiated.count }} total</span></div>
          <pre class="bp-pre">{{ previewText }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const props = defineProps<{ name: string; data: any | null }>();
const emits = defineEmits(['close']);

const data = computed(()=> props.data);
const voxelCount = computed(()=> Number(props.data?.blueprint?.vox?.length || 0));
const blockSummary = computed(()=> {
  const m: Record<string, number> = {};
  const vox = (props.data?.blueprint?.vox || []) as any[];
  for (const v of vox) m[v.id] = (m[v.id] || 0) + 1;
  return m;
});

const origin = reactive({ x: 0, y: 0, z: 0 });
const rotation = ref<number>(0);
const instantiating = ref(false);
const instantiated = ref<any|null>(null);
const show3D = ref(true);
const canvasBlueprint = ref<HTMLDivElement|null>(null);
const canvasInst = ref<HTMLDivElement|null>(null);
let sceneBP: THREE.Scene | null = null;
let cameraBP: THREE.PerspectiveCamera | null = null;
let rendererBP: THREE.WebGLRenderer | null = null;
let controlsBP: OrbitControls | null = null;
let sceneInst: THREE.Scene | null = null;
let cameraInst: THREE.PerspectiveCamera | null = null;
let rendererInst: THREE.WebGLRenderer | null = null;
let controlsInst: OrbitControls | null = null;
let animBP: number | null = null;
let animInst: number | null = null;

const previewText = computed(()=> {
  if (!instantiated.value) return '';
  const vox = (instantiated.value.voxels || []).slice(0, 40);
  return JSON.stringify({ count: instantiated.value.count, sample: vox }, null, 2);
});
const listPreview = computed(()=> {
  const vox = ((props.data?.blueprint?.vox)||[]).slice(0, 40);
  return JSON.stringify({ count: voxelCount.value, sample: vox }, null, 2);
});

function colorFor(id: string): number {
  const n = String(id||'').replace('minecraft:','').toLowerCase();
  const map: Record<string, number> = {
    stone:0x808080, dirt:0x8B4513, grass_block:0x7CFC00, sand:0xE4D96F, oak_log:0x6F4E37, oak_planks:0x9c7f4e, glass:0x88ccee,
    water:0x4A9EFF, lava:0xFF6600, cobblestone:0x7D7D7D
  };
  return map[n] ?? 0xCCCCCC;
}

function cleanupOne(kind: 'bp'|'inst'){
  const c = kind==='bp' ? controlsBP : controlsInst; if (c) c.dispose();
  if (kind==='bp') controlsBP=null; else controlsInst=null;
  const r = kind==='bp' ? rendererBP : rendererInst;
  const host = kind==='bp' ? canvasBlueprint.value : canvasInst.value;
  if (r) { r.dispose(); if (host && r.domElement.parentNode===host) host.removeChild(r.domElement); }
  if (kind==='bp') rendererBP=null; else rendererInst=null;
  if (kind==='bp') { sceneBP=null; cameraBP=null; if (animBP){ cancelAnimationFrame(animBP); animBP=null; } }
  else { sceneInst=null; cameraInst=null; if (animInst){ cancelAnimationFrame(animInst); animInst=null; } }
}

function fitAndCamera(bounds: {minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}){
  const size = Math.max(8, bounds.maxX-bounds.minX+1, bounds.maxY-bounds.minY+1, bounds.maxZ-bounds.minZ+1);
  const dist = size * 1.8;
  return { size, dist };
}

function initViewer(kind: 'bp'|'inst'){
  const host = kind==='bp' ? canvasBlueprint.value : canvasInst.value;
  if (!host) return;
  cleanupOne(kind);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1a1a);
  const camera = new THREE.PerspectiveCamera(50, 800/600, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(800, 600); renderer.setPixelRatio(window.devicePixelRatio);
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping=true; controls.dampingFactor=0.05;
  scene.add(new THREE.AmbientLight(0xffffff, 0.6)); const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(10,10,10); scene.add(dl);
  const vox = kind==='bp' ? ((props.data?.blueprint?.vox)||[]) : ((instantiated.value?.voxels)||[]);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for (const v of vox){ if (v.x<minX) minX=v.x; if (v.x>maxX) maxX=v.x; if (v.y<minY) minY=v.y; if (v.y>maxY) maxY=v.y; if (v.z<minZ) minZ=v.z; if (v.z>maxZ) maxZ=v.z; }
  const { dist, size } = fitAndCamera({minX,maxX,minY,maxY,minZ,maxZ});
  camera.position.set(dist, dist, dist); camera.lookAt(0,0,0);
  for (const v of vox){
    const geom = new THREE.BoxGeometry(0.98,0.98,0.98);
    const mat = new THREE.MeshLambertMaterial({ color: colorFor(v.id) });
    const mesh = new THREE.Mesh(geom, mat); mesh.position.set(v.x, v.y, v.z);
    const edges = new THREE.EdgesGeometry(geom);
    mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true })));
    scene.add(mesh);
  }
  const grid = new THREE.GridHelper(size*2, size*2, 0x444444, 0x222222); scene.add(grid);
  const animate = () => { if (kind==='bp') animBP = requestAnimationFrame(animate); else animInst = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
  animate();
  if (kind==='bp'){ sceneBP=scene; cameraBP=camera; rendererBP=renderer; controlsBP=controls; } else { sceneInst=scene; cameraInst=camera; rendererInst=renderer; controlsInst=controls; }
}

onMounted(()=> { if (show3D.value){ setTimeout(()=>{ initViewer('bp'); if (instantiated.value) initViewer('inst'); }, 30); } });
onBeforeUnmount(()=> { cleanupOne('bp'); cleanupOne('inst'); });
watch(show3D, v=> { if (v) setTimeout(()=>{ initViewer('bp'); if (instantiated.value) initViewer('inst'); }, 30); else { cleanupOne('bp'); cleanupOne('inst'); } });
watch(() => props.data?.blueprint?.vox, () => { if (show3D.value) setTimeout(()=>initViewer('bp'), 30); });
watch(instantiated, () => { if (show3D.value && instantiated.value) setTimeout(()=>initViewer('inst'), 30); });

async function instantiate(){
  if (!props.name) return;
  instantiating.value = true;
  try {
    const res = await fetch(`/api/blueprints/${encodeURIComponent(props.name)}/instantiate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, rotation: rotation.value })
    });
    instantiated.value = await res.json();
  } finally {
    instantiating.value = false;
  }
}
</script>

<style scoped>
.bp-detail__backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index: 200; }
.bp-detail { width: 800px; max-height: 90vh; overflow: auto; background:#202020; border:1px solid #2e2e2e; border-radius: 10px; padding: 12px; }
.bp-detail__hdr { display:flex; justify-content: space-between; align-items:center; margin-bottom:8px; }
.bp-detail__title { font-weight:600; }
.bp-detail__close { background:none; border:none; color:#eaeaea; font-size:22px; cursor:pointer; }
.bp-detail__section { margin-top: 10px; }
.bp-kv { display:flex; gap:8px; align-items:baseline; }
.bp-k { color:#b3b3b3; font-size:12px; min-width: 120px; }
.bp-v { font-family:'Monaco','Courier New',monospace; font-size:12px; }
.bp-subtitle { font-weight:600; margin-bottom:6px; }
.bp-subsubtitle { font-weight:600; margin: 6px 0; font-size: 12px; color:#b3b3b3; }
.bp-table { border:1px solid #2e2e2e; border-radius:6px; }
.bp-row { display:grid; grid-template-columns: 1fr 80px; padding:6px 8px; border-bottom:1px solid #2e2e2e; }
.bp-row--hdr { background:#262626; font-weight:600; }
.bp-row:last-child { border-bottom:none; }
.bp-form { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:6px; align-items:center; }
.bp-form label { display:flex; flex-direction:column; gap:2px; font-size:12px; color:#b3b3b3; }
.bp-form input, .bp-form select { background:#2a2a2a; color:#eaeaea; border:1px solid #2e2e2e; border-radius:6px; padding:6px; }
.bp-btn { background:#2a2a2a; color:#eaeaea; border:1px solid #2e2e2e; border-radius:6px; padding:6px 10px; cursor:pointer; }
.bp-btn--active { border-color:#4A9EFF; color:#4A9EFF; background: rgba(74,158,255,0.08); }
.bp-preview { margin-top:8px; }
.bp-pre { background:#181818; border:1px solid #2e2e2e; border-radius:6px; padding:8px; max-height: 220px; overflow:auto; font-size:11px; }
.bp-issues { background:#2a1a1a; border:1px solid #4a2a2a; border-radius:6px; padding:8px; }
.bp-issues__title { color:#ffb86c; font-weight:600; margin-bottom:4px; }
.bp-empty { color:#7a7a7a; font-size:12px; }
.bp-3d-wrap { border:1px solid #2e2e2e; border-radius:6px; overflow:hidden; }
.bp-canvas { width:800px; height:600px; background:#1a1a1a; }
.bp-3d-title { background:#262626; border-bottom:1px solid #2e2e2e; padding:6px 10px; font-size:12px; color:#b3b3b3; }
.bp-3d-controls { background:#202020; padding:6px 10px; border-top:1px solid #2E2E2E; color:#7A7A7A; font-size:10px; }
.bp-preview-toggles { display:flex; gap:6px; margin-bottom:8px; }
</style>
