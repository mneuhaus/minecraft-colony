#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from './botControl.js';

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killPort(port: number) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    if (!out) return;
    const pids = out.split(/\s+/).filter(Boolean).map((v) => Number(v));
    if (pids.length === 0) return;
    console.log(`[preflight] Port ${port} is busy by PID(s): ${pids.join(', ')} — sending SIGTERM`);
    for (const p of pids) {
      try { process.kill(p, 'SIGTERM'); } catch {}
    }
    // brief grace period
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    // send SIGKILL to remaining
    const rem = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`).toString().trim();
    if (rem) {
      const r = rem.split(/\s+/).filter(Boolean).map((v) => Number(v));
      for (const p of r) { try { process.kill(p, 'SIGKILL'); } catch {} }
      console.log(`[preflight] Killed stubborn PID(s) on port ${port}: ${r.join(', ')}`);
    }
  } catch (e: any) {
    console.warn(`[preflight] Failed to inspect/kill port ${port}: ${e?.message || e}`);
  }
}

function cleanPidFile(file: string) {
  try {
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, 'utf-8').trim();
    const pid = Number(raw);
    if (!pid || !pidAlive(pid)) {
      fs.unlinkSync(file);
      console.log(`[preflight] Removed stale PID file: ${file}`);
    }
  } catch (e: any) {
    console.warn(`[preflight] Failed to clean PID file ${file}: ${e?.message || e}`);
  }
}

function main() {
  const dashboardPort = Number(process.env.DASHBOARD_PORT || 4242);
  const bots = loadConfig();
  const viewerPorts: number[] = [];
  for (const b of bots) {
    if (b.viewer_port && typeof b.viewer_port === 'number') viewerPorts.push(b.viewer_port);
  }

  // Kill processes bound to dashboard and viewer ports (rogue instances)
  killPort(dashboardPort);
  for (const vp of viewerPorts) killPort(vp);

  // Clean stale PID files
  const colonyPid = path.resolve('colony-runtime.pid');
  cleanPidFile(colonyPid);

  for (const b of bots) {
    try {
      const pidPath = path.resolve(b.logs_dir, 'pids', `${b.name}.pid`);
      cleanPidFile(pidPath);
    } catch {}
  }
}

main();

