/* ---------------- HUD drawing ---------------- */
function project(v){
  const p = BABYLON.Vector3.Project(v, BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
  return p;
}
function drawOverlay(fwd){
  octx.clearRect(0,0,overlay.width,overlay.height);
  if (!started || !P.alive) return;
  const sx = overlay.width / engine.getRenderWidth();
  const sy = overlay.height / engine.getRenderHeight();
  octx.lineWidth = 1.2; octx.font = "11px 'Share Tech Mono'";
  for (const e of enemies){
    if (e.hp <= 0) continue;
    const rel = e.pos.subtract(camera.position);
    if (BABYLON.Vector3.Dot(rel, fwd) < 0) continue;     // behind
    const pr = project(e.pos);
    const x = pr.x*sx, y = pr.y*sy;
    const dist = BABYLON.Vector3.Distance(P.pos, e.pos);
    const s = Math.max(14, 900/dist);
    octx.strokeStyle = "rgba(255,90,77,0.9)";
    octx.strokeRect(x-s/2, y-s/2, s, s);
    octx.fillStyle = "rgba(255,178,77,0.9)";
    octx.fillText("RGM-79 GLB " + dist.toFixed(0) + "m", x + s/2 + 6, y);
    /* lead pip */
    const tof = dist / 320;
    const lead = e.pos.add(e.vel.scale(tof)).subtract(P.vel.scale(0.5*tof));
    const lp = project(lead);
    const lx = lp.x*sx, ly = lp.y*sy;
    octx.strokeStyle = "rgba(255,240,150,0.95)";
    octx.beginPath(); octx.arc(lx, ly, 5, 0, 7); octx.stroke();
    octx.beginPath(); octx.moveTo(lx-9, ly); octx.lineTo(lx-3, ly);
    octx.moveTo(lx+3, ly); octx.lineTo(lx+9, ly); octx.stroke();
  }
  /* velocity vector marker */
  if (P.vel.length() > 4){
    const vp = project(P.pos.add(P.vel.clone().normalize().scale(120)));
    const rel = BABYLON.Vector3.Dot(P.vel, fwd);
    if (rel > 0){
      const x = vp.x*sx, y = vp.y*sy;
      octx.strokeStyle = "rgba(160,220,255,0.8)";
      octx.beginPath(); octx.arc(x, y, 7, 0, 7); octx.stroke();
      octx.beginPath(); octx.moveTo(x, y-11); octx.lineTo(x, y-4); octx.stroke();
    }
  }
}
function drawRadar(fwd, right){
  const r = document.getElementById("radar").getContext("2d");
  r.clearRect(0,0,150,150);
  r.strokeStyle = "rgba(255,178,77,0.35)";
  r.beginPath(); r.arc(75,75,72,0,7); r.stroke();
  r.beginPath(); r.arc(75,75,36,0,7); r.stroke();
  r.beginPath(); r.moveTo(75,3); r.lineTo(75,147); r.moveTo(3,75); r.lineTo(147,75); r.stroke();
  const fFlat = V3(fwd.x, 0, fwd.z).normalize();
  const rFlat = V3(right.x, 0, right.z).normalize();
  r.fillStyle = "#fff"; r.fillRect(73,73,4,4);
  for (const e of enemies){
    if (e.hp <= 0) continue;
    const rel = e.pos.subtract(P.pos);
    const rx = BABYLON.Vector3.Dot(rel, rFlat) / 800 * 72;
    const rz = BABYLON.Vector3.Dot(rel, fFlat) / 800 * 72;
    const cl = Math.min(1, Math.hypot(rx,rz)/72);
    const px = 75 + (cl<1 ? rx : rx/Math.hypot(rx,rz)*70);
    const py = 75 - (cl<1 ? rz : rz/Math.hypot(rx,rz)*70);
    r.fillStyle = e.pos.y > P.pos.y + 20 ? "#ffd34d" : e.pos.y < P.pos.y - 20 ? "#ff7a4d" : "#ff3b30";
    r.fillRect(px-2, py-2, 4, 4);
  }
}
function updateHUD(){
  document.getElementById("hullI").style.transform = "scaleX(" + (P.hull/100) + ")";
  document.getElementById("boostI").style.transform = "scaleX(" + (P.boost/100) + ")";
  document.getElementById("velN").textContent = P.vel.length().toFixed(0);
}

/* ---------------- boot / restart ---------------- */
function begin(){
  audioInit();
  document.getElementById("titleScreen").classList.add("gone");
  document.getElementById("deathScreen").classList.add("gone");
  document.getElementById("hud").classList.add("on");
  /* reset */
  for (const e of enemies) disposeEnemySuit(e.suit);
  for (const b of bullets) b.mesh.dispose();
  for (const b of ebullets) b.mesh.dispose();
  enemies = []; bullets = []; ebullets = [];
  P.hull = 100; P.boost = 100; P.kills = 0; P.wave = 0;
  P.alive = true; P.inWave = false;
  P.pos.set(0, 0, -60); P.vel.set(0,0,0); P.yaw = 0; P.pitch = 0;
  playerSuit.root.setEnabled(true);
  document.getElementById("killN").textContent = "0";
  started = true;
  canvas.requestPointerLock && canvas.requestPointerLock();
  setTimeout(startWave, 1200);
}
document.getElementById("startBtn").addEventListener("click", begin);
document.getElementById("retryBtn").addEventListener("click", begin);

engine.runRenderLoop(() => scene.render());
