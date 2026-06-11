/* ---------------- camera ---------------- */
const camera = new BABYLON.FreeCamera("cam", V3(0, 4, -80), scene);
camera.minZ = 0.5; camera.maxZ = 5000; camera.fov = 0.95;
camera.inputs.clear();

/* ---------------- game state ---------------- */
const P = {
  pos: playerSuit.root.position, vel: V3(0,0,0),
  yaw: 0, pitch: 0, roll: 0,
  hull: 100, boost: 100, fireCD: 0,
  alive: true, kills: 0, wave: 0, inWave: false, hitT: 0,
};
let bullets = [], ebullets = [], enemies = [];
let started = false;

/* ---------------- input ---------------- */
const keys = {};
addEventListener("keydown", e => { keys[e.code] = true;
  if (["Space","ShiftLeft","ControlLeft"].includes(e.code)) e.preventDefault(); });
addEventListener("keyup", e => keys[e.code] = false);
let firing = false;
document.addEventListener("mousedown", e => {
  if (document.pointerLockElement === canvas && e.button === 0) firing = true;
});
document.addEventListener("mouseup", e => { if (e.button === 0) firing = false; });
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement !== canvas) return;
  P.yaw += e.movementX * 0.0024;
  P.pitch += e.movementY * 0.0024;
  P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
});
canvas.addEventListener("click", () => {
  if (started && !document.pointerLockElement) canvas.requestPointerLock();
});

/* ---------------- weapons ---------------- */
const bulletMat = new BABYLON.StandardMaterial("bm", scene);
bulletMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
const ebulletMat = new BABYLON.StandardMaterial("ebm", scene);
ebulletMat.emissiveColor = new BABYLON.Color3(1, 0.3, 0.6);

function spawnBullet(pos, vel, mine){
  const b = BABYLON.MeshBuilder.CreateCapsule("b", {height: mine?2.4:1.6, radius:0.12}, scene);
  b.material = mine ? bulletMat : ebulletMat;
  b.position.copyFrom(pos);
  const dir = vel.clone().normalize();
  b.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionLH(dir, V3(0,1,0));
  b.rotate(BABYLON.Axis.X, Math.PI/2);
  (mine ? bullets : ebullets).push({ mesh: b, vel, life: 3 });
}

function explode(pos, big){
  boom(big ? 0.22 : 0.12);
  const ps = new BABYLON.ParticleSystem("exp", big?160:70, scene);
  ps.particleTexture = flameTex;
  ps.emitter = pos.clone();
  ps.color1 = new BABYLON.Color4(1,0.85,0.4,1);
  ps.color2 = new BABYLON.Color4(1,0.3,0.1,0.9);
  ps.colorDead = new BABYLON.Color4(0.15,0.1,0.1,0);
  ps.minSize = big?1.4:0.7; ps.maxSize = big?4.5:2;
  ps.minLifeTime = 0.25; ps.maxLifeTime = big?0.9:0.5;
  ps.emitRate = 2000; ps.targetStopDuration = 0.12;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  ps.minEmitPower = big?14:8; ps.maxEmitPower = big?34:18;
  ps.direction1 = V3(-1,-1,-1); ps.direction2 = V3(1,1,1);
  ps.disposeOnStop = true; ps.start();
}

/* scale a freshly instantiated model so it stands `height` units tall,
   centered on its wrap node (same math as mountContainer) */
function fitWrapToHeight(wrap, height){
  let min = null, max = null;
  for (const m of wrap.getChildMeshes()){
    if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
    m.computeWorldMatrix(true);
    const bi = m.getBoundingInfo && m.getBoundingInfo();
    if (!bi) continue;
    const lo = bi.boundingBox.minimumWorld, hi = bi.boundingBox.maximumWorld;
    if (!min){ min = lo.clone(); max = hi.clone(); }
    else { min = BABYLON.Vector3.Minimize(min, lo); max = BABYLON.Vector3.Maximize(max, hi); }
  }
  if (min && max){
    const size = max.subtract(min), center = min.add(max).scale(0.5);
    const s = size.y > 0.001 ? height / size.y : 1;
    wrap.scaling = V3(s, s, s);
    wrap.position = center.scale(-s);
  }
}

/* ---------------- enemies ---------------- */
function disposeEnemySuit(suit){
  for (const g of (suit.animGroups || [])) g.dispose();
  for (const s of (suit.skeletons || [])) s.dispose();
  for (const m of (suit.flashMats || [])) m.dispose(false, false);
  for (const m of (suit.mats || [])) m.dispose(false, false);
  suit.root.dispose(false, false);
}
function spawnEnemy(){
  let suit;
  let faceDirSign = 1;
  if (enemyContainer){
    const root = new BABYLON.TransformNode("enemyRoot", scene);
    const tag = "_e" + (Math.random()*1e6 | 0);
    const entries = enemyContainer.instantiateModelsToScene(
      n => n + tag, false, { doNotInstantiate: true });
    const wrap = new BABYLON.TransformNode("enemyWrap" + tag, scene);
    for (const r of entries.rootNodes) r.parent = wrap;
    fitWrapToHeight(wrap, 9.0);
    wrap.parent = root;
    const flashMats = [];
    for (const child of root.getChildMeshes()){
      child.setEnabled(true);
      if (child.material){
        child.material = child.material.clone(child.material.name + tag);
        if ("metallic" in child.material) child.material.metallic = 0.25;
        if ("roughness" in child.material) child.material.roughness = 0.55;
        if (flashMats.indexOf(child.material) === -1) flashMats.push(child.material);
      }
    }
    /* baked skeletal clips: idle loop now, rifle on bursts */
    for (const g of entries.animationGroups) g.stop();
    const idle  = entries.animationGroups.find(g => /01-IDLE/i.test(g.name))
               || entries.animationGroups[0];
    const rifle = entries.animationGroups.find(g => /02-RIFLE/i.test(g.name));
    if (idle){
      idle.play(true);
      idle.goToFrame(idle.from + Math.random() * (idle.to - idle.from)); // desync
      idle.speedRatio = 0.9 + Math.random() * 0.25;
    }
    suit = { root, mats: [], flashMats,
             anims: { idle, rifle },
             animGroups: entries.animationGroups,
             skeletons: entries.skeletons };
    faceDirSign = -1;
  } else {
    suit = buildSuit(
      new BABYLON.Color3(0.28, 0.42, 0.3),
      new BABYLON.Color3(0.14, 0.16, 0.15),
      new BABYLON.Color3(0.4, 1, 0.6), 0.95);
  }
  const a = Math.random()*Math.PI*2, el = (Math.random()-0.5)*1.2;
  const d = 380 + Math.random()*180;
  suit.root.position = P.pos.add(V3(
    Math.cos(a)*Math.cos(el)*d, Math.sin(el)*d, Math.sin(a)*Math.cos(el)*d));
  enemies.push({ suit, pos: suit.root.position, vel: V3(0,0,0),
    hp: 3, t: Math.random()*9, fireT: 1.5+Math.random()*2, burst: 0, flash: 0,
    faceDirSign });
}
function startWave(){
  P.wave++; P.inWave = true;
  document.getElementById("waveN").textContent = P.wave;
  const n = 1 + P.wave;
  for (let i = 0; i < n; i++) spawnEnemy();
  const w = document.getElementById("wave");
  w.textContent = "WAVE " + P.wave + " — " + n + " CONTACTS";
  w.style.opacity = 1;
  setTimeout(() => w.style.opacity = 0, 2400);
  blip(520, .3, "sine", .06, 760);
}

/* ---------------- update ---------------- */
scene.onBeforeRenderObservable.add(() => {
  const dt = Math.min(engine.getDeltaTime()/1000, 0.05);
  if (!started) return;

  /* orientation */
  const rotQ = BABYLON.Quaternion.RotationYawPitchRoll(P.yaw, P.pitch, P.roll);
  const rotM = new BABYLON.Matrix();
  rotQ.toRotationMatrix(rotM);
  const fwd = BABYLON.Vector3.TransformNormal(V3(0,0,1), rotM);
  const right = BABYLON.Vector3.TransformNormal(V3(1,0,0), rotM);
  const up = BABYLON.Vector3.TransformNormal(V3(0,1,0), rotM);

  if (P.alive){
    /* thrust */
    const boosting = keys["ShiftLeft"] && P.boost > 0;
    const acc = boosting ? 95 : 42;
    let thrust = V3(0,0,0), thrusting = false;
    if (keys["KeyW"]) { thrust.addInPlace(fwd); thrusting = true; }
    if (keys["KeyS"]) { thrust.subtractInPlace(fwd); thrusting = true; }
    if (keys["KeyD"]) { thrust.addInPlace(right); thrusting = true; }
    if (keys["KeyA"]) { thrust.subtractInPlace(right); thrusting = true; }
    if (keys["Space"]) { thrust.addInPlace(up); thrusting = true; }
    if (keys["ControlLeft"]) { thrust.subtractInPlace(up); thrusting = true; }
    if (thrust.lengthSquared() > 0) P.vel.addInPlace(thrust.normalize().scale(acc*dt));
    P.vel.scaleInPlace(Math.pow(0.4, dt));            // space-sim damping
    const vmax = boosting ? 130 : 62;
    if (P.vel.length() > vmax) P.vel.normalize().scaleInPlace(vmax);
    P.pos.addInPlace(P.vel.scale(dt));

    /* propellant */
    if (boosting && thrusting) P.boost = Math.max(0, P.boost - 26*dt);
    else P.boost = Math.min(100, P.boost + 14*dt);

    /* thruster fx + sound */
    thrPS.emitRate = thrusting ? (boosting ? 320 : 120) : 18;
    if (thrGain) thrGain.gain.value = thrusting ? (boosting ? 0.10 : 0.045) : 0.012;
    camera.fov += (((boosting && thrusting) ? 1.06 : 0.95) - camera.fov) * 0.08;

    /* soft arena boundary */
    const dCenter = P.pos.length();
    document.getElementById("warn").style.display = dCenter > 750 ? "block" : "none";
    document.getElementById("warn").textContent = dCenter > 750 ? "LEAVING COMBAT ZONE" : "";
    if (dCenter > 850) P.vel.addInPlace(P.pos.clone().normalize().scale(-60*dt));

    /* asteroid pushout */
    for (const A of asteroids){
      const d = P.pos.subtract(A.mesh.position), L = d.length(), min = A.r + 4;
      if (L < min){
        P.pos.addInPlace(d.normalize().scale(min - L));
        P.vel.scaleInPlace(0.5);
      }
    }

    /* fire autocannon */
    P.fireCD -= dt;
    if (firing && P.fireCD <= 0){
      P.fireCD = 0.12;
      const muzzle = P.pos.add(fwd.scale(4)).add(right.scale(1.6)).add(up.scale(-1.0));
      const spread = V3((Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4);
      spawnBullet(muzzle, fwd.scale(320).add(P.vel.scale(0.5)).add(spread), true);
      sGun();
      rigState.recoil = Math.min(1, rigState.recoil + 0.45);
    }
  }

  /* suit follows aim */
  playerSuit.root.rotationQuaternion = playerSuit.root.rotationQuaternion || rotQ.clone();
  BABYLON.Quaternion.SlerpToRef(playerSuit.root.rotationQuaternion, rotQ, 0.18,
    playerSuit.root.rotationQuaternion);
  /* banking from strafe */
  P.roll += (((keys["KeyA"]?1:0) - (keys["KeyD"]?1:0)) * 0.16 - P.roll) * 0.06;
  /* mono-eye scan */
  if (playerSuit.eye) playerSuit.eye.position.x = Math.sin(performance.now()*0.002)*0.18;

  /* ---- procedural Zaku animation: hover bob, thrust lean, recoil ---- */
  {
    rigState.t += dt;
    rigState.recoil = Math.max(0, rigState.recoil - dt*6);
    /* player velocity expressed in suit-local space */
    const invQ = BABYLON.Quaternion.Inverse(rotQ);
    const lv = P.vel.clone();
    lv.rotateByQuaternionToRef(invQ, lv);
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    /* lean into motion + recoil pitch-up */
    const leanX = clamp(lv.z/130) * 0.22 - clamp(lv.y/130) * 0.10 - rigState.recoil * 0.06;
    const leanZ = clamp(lv.x/130) * -0.28;
    /* idle hover bob + sway, fading out as speed rises */
    const calm = hasBakedIdle ? 0 : 1 / (1 + P.vel.length()*0.08);
    const bobY  = Math.sin(rigState.t*1.7) * 0.35 * calm;
    const swayZ = Math.sin(rigState.t*1.1) * 0.05 * calm;
    const swayY = Math.sin(rigState.t*0.9) * 0.03 * calm;
    const k = Math.min(1, dt*7);
    zakuRig.rotation.x += (leanX - zakuRig.rotation.x) * k;
    zakuRig.rotation.z += (leanZ + swayZ - zakuRig.rotation.z) * k;
    zakuRig.rotation.y += (swayY - zakuRig.rotation.y) * Math.min(1, dt*5);
    zakuRig.position.y += (bobY - zakuRig.position.y) * Math.min(1, dt*5);
    zakuRig.position.z += (-rigState.recoil*0.9 - zakuRig.position.z) * Math.min(1, dt*10);
  }

  /* camera chase */
  const camGoal = P.pos.subtract(fwd.scale(16)).add(up.scale(5.5));
  camera.position = BABYLON.Vector3.Lerp(camera.position, camGoal, 0.14);
  let shakeV = V3(0,0,0);
  if (P.hitT > 0){ P.hitT -= dt;
    shakeV = V3((Math.random()-0.5), (Math.random()-0.5), 0).scale(P.hitT*2.5); }
  camera.setTarget(P.pos.add(fwd.scale(60)).add(shakeV));

  /* bullets */
  for (const b of bullets){
    b.life -= dt; b.mesh.position.addInPlace(b.vel.scale(dt));
    for (const e of enemies){
      if (e.hp <= 0) continue;
      if (BABYLON.Vector3.Distance(b.mesh.position, e.pos) < 4.5){
        e.hp--; e.flash = 0.12; b.life = 0; sHitE();
        explode(b.mesh.position, false);
        if (e.hp <= 0){
          P.kills++; document.getElementById("killN").textContent = P.kills;
          explode(e.pos, true);
          disposeEnemySuit(e.suit);
        }
        break;
      }
    }
    for (const A of asteroids)
      if (b.life > 0 && BABYLON.Vector3.Distance(b.mesh.position, A.mesh.position) < A.r){
        b.life = 0; explode(b.mesh.position, false); break;
      }
    if (b.life <= 0) b.mesh.dispose();
  }
  bullets = bullets.filter(b => b.life > 0);

  for (const b of ebullets){
    b.life -= dt; b.mesh.position.addInPlace(b.vel.scale(dt));
    if (P.alive && BABYLON.Vector3.Distance(b.mesh.position, P.pos) < 3.2){
      b.life = 0; damagePlayer(8);
      explode(b.mesh.position, false);
    }
    if (b.life <= 0) b.mesh.dispose();
  }
  ebullets = ebullets.filter(b => b.life > 0);

  /* enemy AI */
  let living = 0;
  for (const e of enemies){
    if (e.hp <= 0) continue;
    living++;
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.suit.mats && e.suit.mats[0]){
      e.suit.mats[0].emissiveColor = e.flash > 0
        ? new BABYLON.Color3(0.8,0.8,0.8) : BABYLON.Color3.Black();
    }
    if (e.suit.flashMats){
      const flash = e.flash > 0 ? new BABYLON.Color3(0.35,0.35,0.35) : BABYLON.Color3.Black();
      for (const mat of e.suit.flashMats) if ("emissiveColor" in mat) mat.emissiveColor = flash;
    }

    const toP = P.pos.subtract(e.pos), dist = toP.length();
    const dirP = toP.scale(1/Math.max(dist,0.01));
    const tangent = BABYLON.Vector3.Cross(dirP, V3(0,1,0)).normalize()
      .scale(Math.sin(e.t*0.7) * 26);
    let desire = tangent;
    if (dist > 130) desire = desire.add(dirP.scale(38));
    else if (dist < 70) desire = desire.subtract(dirP.scale(30));
    e.vel.addInPlace(desire.subtract(e.vel).scale(0.6*dt));
    if (e.vel.length() > 46) e.vel.normalize().scaleInPlace(46);
    e.pos.addInPlace(e.vel.scale(dt));

    const lookDir = e.faceDirSign < 0 ? dirP.scale(-1) : dirP;
    const eq = BABYLON.Quaternion.FromLookDirectionLH(lookDir, V3(0,1,0));
    e.suit.root.rotationQuaternion = e.suit.root.rotationQuaternion || eq.clone();
    BABYLON.Quaternion.SlerpToRef(e.suit.root.rotationQuaternion, eq, 0.08,
      e.suit.root.rotationQuaternion);

    /* fire control */
    if (P.alive && dist < 420){
      e.fireT -= dt;
      if (e.fireT <= 0 && e.burst === 0){
        e.burst = 4; e.bt = 0;
        const A = e.suit.anims;
        if (A && A.rifle){
          if (A.idle) A.idle.stop();
          A.rifle.stop();
          A.rifle.play(false);
          A.rifle.onAnimationGroupEndObservable.addOnce(() => {
            if (e.hp > 0 && A.idle) A.idle.play(true);
          });
        }
      }
      if (e.burst > 0){
        e.bt -= dt;
        if (e.bt <= 0){
          e.bt = 0.14; e.burst--;
          if (e.burst === 0) e.fireT = 2.2 + Math.random()*2;
          const tof = dist / 150;
          const aim = P.pos.add(P.vel.scale(tof * (0.6+Math.random()*0.5)))
            .add(V3((Math.random()-0.5)*8,(Math.random()-0.5)*8,(Math.random()-0.5)*8));
          const dir = aim.subtract(e.pos).normalize();
          spawnBullet(e.pos.add(dir.scale(5)), dir.scale(150), false);
        }
      }
    }
  }
  /* next wave */
  if (P.inWave && living === 0 && P.alive){
    P.inWave = false;
    setTimeout(startWave, 2600);
  }

  drawOverlay(fwd, right, up);
  drawRadar(fwd, right);
  updateHUD();
});

function damagePlayer(n){
  if (!P.alive) return;
  P.hull -= n; P.hitT = 0.4; sHurt();
  const d = document.getElementById("dmg");
  d.style.opacity = 0.9; setTimeout(() => d.style.opacity = 0, 160);
  if (P.hull <= 0){
    P.hull = 0; P.alive = false;
    explode(P.pos, true); explode(P.pos.add(V3(2,1,0)), true);
    playerSuit.root.setEnabled(false);
    thrPS.emitRate = 0; if (thrGain) thrGain.gain.value = 0;
    document.getElementById("deathStats").textContent =
      "WAVE " + P.wave + " // " + P.kills + " CONFIRMED KILLS";
    setTimeout(() => {
      document.exitPointerLock && document.exitPointerLock();
      document.getElementById("deathScreen").classList.remove("gone");
    }, 1400);
  }
}
