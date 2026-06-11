/* ---------------- the crimson commander unit ---------------- */
function buildSuit(primary, secondary, eyeColor, scale){
  const root = new BABYLON.TransformNode("suit", scene);
  const pm = new BABYLON.StandardMaterial("pm"+Math.random(), scene);
  pm.diffuseColor = primary; pm.specularColor = new BABYLON.Color3(0.3,0.25,0.25);
  const sm = new BABYLON.StandardMaterial("sm"+Math.random(), scene);
  sm.diffuseColor = secondary; sm.specularColor = new BABYLON.Color3(0.15,0.15,0.15);
  const em = new BABYLON.StandardMaterial("em"+Math.random(), scene);
  em.emissiveColor = eyeColor; em.diffuseColor = BABYLON.Color3.Black();

  const torso = BABYLON.MeshBuilder.CreateBox("torso", {width:2.4, height:2.2, depth:1.6}, scene);
  torso.parent = root; torso.position.y = 0.4; torso.material = pm;
  const cock = BABYLON.MeshBuilder.CreateBox("cock", {width:1.0, height:0.8, depth:0.5}, scene);
  cock.parent = root; cock.position.set(0, 0.3, 0.95); cock.material = sm;
  const head = BABYLON.MeshBuilder.CreateSphere("head", {diameter:1.1, segments:8}, scene);
  head.parent = root; head.position.y = 2.0; head.material = pm;
  const visor = BABYLON.MeshBuilder.CreateBox("visor", {width:0.9, height:0.3, depth:0.2}, scene);
  visor.parent = head; visor.position.set(0, 0.05, 0.5); visor.material = sm;
  const eye = BABYLON.MeshBuilder.CreateSphere("eye", {diameter:0.3}, scene);
  eye.parent = visor; eye.position.z = 0.08; eye.material = em;

  // shoulders — one shielded, one spiked
  const shL = BABYLON.MeshBuilder.CreateBox("shL", {width:1.1, height:1.4, depth:1.6}, scene);
  shL.parent = root; shL.position.set(-1.9, 1.0, 0); shL.material = sm;
  const shR = BABYLON.MeshBuilder.CreateSphere("shR", {diameter:1.5, segments:6}, scene);
  shR.parent = root; shR.position.set(1.8, 1.0, 0); shR.material = pm;
  for (let i = 0; i < 3; i++){
    const spk = BABYLON.MeshBuilder.CreateCylinder("spk", {diameterTop:0, diameterBottom:0.28, height:0.8}, scene);
    spk.parent = shR; spk.material = sm;
    spk.position.set(0.3, 0.45 - i*0.45, 0);
    spk.rotation.z = -0.9;
  }
  // arms, legs, backpack
  for (const sx of [-1.7, 1.7]){
    const arm = BABYLON.MeshBuilder.CreateCapsule("arm", {height:2.4, radius:0.34}, scene);
    arm.parent = root; arm.position.set(sx, -0.3, 0); arm.material = pm;
  }
  for (const sx of [-0.7, 0.7]){
    const leg = BABYLON.MeshBuilder.CreateCapsule("leg", {height:3.2, radius:0.48}, scene);
    leg.parent = root; leg.position.set(sx, -2.6, 0); leg.material = pm;
    const foot = BABYLON.MeshBuilder.CreateBox("foot", {width:0.9, height:0.5, depth:1.4}, scene);
    foot.parent = root; foot.position.set(sx, -4.2, 0.2); foot.material = sm;
  }
  const pack = BABYLON.MeshBuilder.CreateBox("pack", {width:2.0, height:1.8, depth:0.8}, scene);
  pack.parent = root; pack.position.set(0, 0.5, -1.2); pack.material = sm;
  const nozzles = [];
  for (const sx of [-0.6, 0.6]){
    const nz = BABYLON.MeshBuilder.CreateCylinder("nz", {diameterTop:0.5, diameterBottom:0.3, height:0.6}, scene);
    nz.parent = root; nz.position.set(sx, -0.4, -1.45); nz.rotation.x = Math.PI/2;
    nz.material = sm; nozzles.push(nz);
  }
  // rifle
  const rifle = BABYLON.MeshBuilder.CreateBox("rifle", {width:0.35, height:0.5, depth:3.4}, scene);
  rifle.parent = root; rifle.position.set(1.7, -1.2, 1.4); rifle.material = sm;

  if (scale !== 1) root.scaling = V3(scale, scale, scale);
  return { root, eye, mats: [pm, sm] };
}

/* ---- player unit: MS-06S Zaku II (uploaded); enemies: RGM-79 GM (uploaded).
        Primitive suits as fallback. ---- */
const playerSuit = { root: new BABYLON.TransformNode("playerRoot", scene), eye: null, mats: [] };
playerSuit.root.position = V3(0, 0, -60);
/* animation rig: child node we drive procedurally (hover bob / lean / recoil).
   The Zaku GLB is a static mesh (no baked clips), so the motion lives here. */
const zakuRig = new BABYLON.TransformNode("zakuRig", scene);
zakuRig.parent = playerSuit.root;
const rigState = { recoil: 0, t: Math.random()*10 };
let hasBakedIdle = false;
const MODEL_FILES = {
  zaku: "ms-06s_chars_zaku_ii.glb",
  gm: "rgm-79_gm.glb",
};
let enemyContainer = null;   // GM asset container, instantiated per spawn
function attachFallbackSuit(){
  const fb = buildSuit(
    new BABYLON.Color3(0.72, 0.16, 0.14),
    new BABYLON.Color3(0.12, 0.11, 0.13),
    new BABYLON.Color3(1, 0.35, 0.25), 1);
  fb.root.parent = zakuRig;
  playerSuit.eye = fb.eye;
}

async function loadGlbContainer(scene, b64){
  const explicitDataUri = "data:model/gltf-binary;base64," + b64;
  try {
    return await BABYLON.SceneLoader.LoadAssetContainerAsync(
      "", explicitDataUri, scene, undefined, ".glb");
  } catch (firstErr) {
    // Fallback path for environments that fail on inline data URIs.
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "model/gltf-binary" }));
    try {
      return await BABYLON.SceneLoader.LoadAssetContainerAsync(
        "", blobUrl, scene, undefined, ".glb");
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
}

async function loadPreferredGlb(scene, localFile){
  const container = await BABYLON.SceneLoader.LoadAssetContainerAsync("./", localFile, scene);
  return { container, source: "local" };
}

/* add container to scene under one node, centered on origin, scaled to `height` */
function mountContainer(cont, name, height){
  cont.addAllToScene();
  const inner = new BABYLON.TransformNode(name, scene);
  for (const t of cont.transformNodes){
    if (!t.parent && t !== inner) t.parent = inner;
  }
  for (const m of cont.meshes) if (!m.parent) m.parent = inner;
  let min = null, max = null;
  for (const m of cont.meshes){
    if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
    m.computeWorldMatrix(true);
    const bi = m.getBoundingInfo && m.getBoundingInfo();
    if (!bi) continue;
    const lo = bi.boundingBox.minimumWorld;
    const hi = bi.boundingBox.maximumWorld;
    if (!min){ min = lo.clone(); max = hi.clone(); }
    else {
      min = BABYLON.Vector3.Minimize(min, lo);
      max = BABYLON.Vector3.Maximize(max, hi);
    }
  }
  if (min && max){
    const size = max.subtract(min);
    const center = min.add(max).scale(0.5);
    const s = size.y > 0.001 ? height / size.y : 1;
    inner.scaling = V3(s, s, s);
    inner.position = center.scale(-s);
  }
  /* crisper read under the sun + slight spec like painted armor */
  for (const m of cont.meshes){
    if (m.material){
      if ("metallic" in m.material) m.material.metallic = 0.25;
      if ("roughness" in m.material) m.material.roughness = 0.55;
    }
  }
  return inner;
}

(async () => {
  /* player: Zaku II */
  try {
    const playerAsset = await loadPreferredGlb(scene, MODEL_FILES.zaku);
    const inner = mountContainer(playerAsset.container, "playerZakuInner", 9.5);
    inner.parent = zakuRig;
    /* play the baked idle clip if the GLB ships one */
    const idle = (playerAsset.container.animationGroups || []).find(g => /IDLE/i.test(g.name));
    if (idle){ idle.play(true); hasBakedIdle = true; }
    document.getElementById("unitTag").textContent =
      playerAsset.source === "local"
        ? "UNIT MS-06S ZAKU GLB // LOCAL FILE LINK"
        : "UNIT MS-06S ZAKU GLB // EMBEDDED LINK";
  } catch (err) {
    console.warn("MS-06S model failed to load, using fallback suit", err);
    attachFallbackSuit();
    document.getElementById("unitTag").textContent =
      "UNIT MS-06S ZAKU II // FALLBACK FRAME";
  }
  /* enemies: RGM-79 GM — instantiated per spawn so every clone gets its own
     skeleton + animation groups (the GLB ships 01-IDLE / 02-RIFLE / 03-SABER). */
  try {
    const enemyAsset = await loadPreferredGlb(scene, MODEL_FILES.gm);
    enemyContainer = enemyAsset.container;
  } catch (err) {
    console.warn("RGM-79 model failed to load, enemies will use fallback suits", err);
    enemyContainer = null;
  }
})();

/* thruster flames */
const flameTex = (() => {
  const dt = new BABYLON.DynamicTexture("flame", {width:64,height:64}, scene, false);
  const c = dt.getContext();
  const g = c.createRadialGradient(32,32,2,32,32,30);
  g.addColorStop(0,"rgba(255,240,200,1)"); g.addColorStop(0.4,"rgba(255,160,80,0.8)");
  g.addColorStop(1,"rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(0,0,64,64); dt.update(); dt.hasAlpha = true;
  return dt;
})();
const thrPS = new BABYLON.ParticleSystem("thr", 400, scene);
thrPS.particleTexture = flameTex;
thrPS.emitter = playerSuit.root;
thrPS.minEmitBox = V3(-0.7, -0.5, -1.6); thrPS.maxEmitBox = V3(0.7, -0.3, -1.6);
thrPS.color1 = new BABYLON.Color4(1, 0.8, 0.4, 0.9);
thrPS.color2 = new BABYLON.Color4(1, 0.4, 0.15, 0.8);
thrPS.colorDead = new BABYLON.Color4(0.2, 0.1, 0.3, 0);
thrPS.minSize = 0.4; thrPS.maxSize = 1.1;
thrPS.minLifeTime = 0.12; thrPS.maxLifeTime = 0.3;
thrPS.emitRate = 0;
thrPS.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
thrPS.isLocal = true;
thrPS.direction1 = V3(-0.3, -0.2, -6); thrPS.direction2 = V3(0.3, 0.2, -10);
thrPS.start();
