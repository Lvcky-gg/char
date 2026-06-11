/* ---------------- environment ---------------- */
function makeStars(){
  const dt = new BABYLON.DynamicTexture("stars", {width:2048, height:1024}, scene, false);
  const c = dt.getContext();
  c.fillStyle = "#04060c"; c.fillRect(0,0,2048,1024);
  for (let i = 0; i < 1400; i++){
    const x = Math.random()*2048, y = Math.random()*1024, r = Math.random();
    c.fillStyle = r > .97 ? "#ffd9a0" : r > .93 ? "#a0c8ff" : "rgba(255,255,255,"+(0.3+r*0.7)+")";
    const s = r > .95 ? 2.2 : 1.2;
    c.fillRect(x, y, s, s);
  }
  dt.update();
  const sky = BABYLON.MeshBuilder.CreateSphere("sky", {diameter: 4000, sideOrientation: BABYLON.Mesh.BACKSIDE}, scene);
  const m = new BABYLON.StandardMaterial("skym", scene);
  m.emissiveTexture = dt; m.diffuseColor = BABYLON.Color3.Black();
  m.specularColor = BABYLON.Color3.Black(); m.disableLighting = true;
  sky.material = m; sky.infiniteDistance = true;
  return sky;
}
makeStars();

const sun = new BABYLON.DirectionalLight("sun", V3(-0.5, -0.3, 0.8), scene);
sun.intensity = 1.4; sun.diffuse = new BABYLON.Color3(1, 0.95, 0.85);
const fillL = new BABYLON.HemisphericLight("fill", V3(0,1,0), scene);
fillL.intensity = 0.25; fillL.diffuse = new BABYLON.Color3(0.4,0.5,0.8);
fillL.groundColor = new BABYLON.Color3(0.1,0.08,0.12);

const glow = new BABYLON.GlowLayer("glow", scene, { blurKernelSize: 32 });
glow.intensity = 0.8;

/* distant O'Neill cylinder colony */
(function colony(){
  const root = new BABYLON.TransformNode("colony", scene);
  root.position = V3(900, 250, 1400);
  root.rotation = V3(0.3, 0.6, 0.4);
  const dt = new BABYLON.DynamicTexture("colt", {width:512, height:512}, scene, false);
  const c = dt.getContext();
  c.fillStyle = "#22262e"; c.fillRect(0,0,512,512);
  for (let i = 0; i < 3; i++){
    c.fillStyle = "rgba(150,190,255,0.85)";
    c.fillRect(0, 40 + i*170, 512, 60);
  }
  for (let i = 0; i < 400; i++){
    c.fillStyle = "rgba(255,220,150,"+(Math.random()*0.6)+")";
    c.fillRect(Math.random()*512, Math.random()*512, 2, 2);
  }
  dt.update();
  const body = BABYLON.MeshBuilder.CreateCylinder("colbody", {diameter: 180, height: 560, tessellation: 28}, scene);
  body.parent = root;
  const m = new BABYLON.StandardMaterial("colm", scene);
  m.diffuseTexture = dt; m.emissiveTexture = dt;
  m.emissiveColor = new BABYLON.Color3(0.35,0.35,0.4);
  body.material = m;
  const ring = BABYLON.MeshBuilder.CreateTorus("colring", {diameter: 320, thickness: 18, tessellation: 32}, scene);
  ring.parent = root; ring.position.y = -320; ring.material = m;
  scene.onBeforeRenderObservable.add(() => { root.rotation.y += 0.0003; });
})();

/* asteroid shoal */
const asteroids = [];
(function rocks(){
  const m = new BABYLON.StandardMaterial("rock", scene);
  m.diffuseColor = new BABYLON.Color3(0.32,0.3,0.3);
  m.specularColor = new BABYLON.Color3(0.05,0.05,0.05);
  for (let i = 0; i < 46; i++){
    const r = 6 + Math.random()*22;
    const a = BABYLON.MeshBuilder.CreateSphere("ast"+i, {diameter: r*2, segments: 3}, scene);
    a.convertToFlatShadedMesh();
    a.scaling = V3(1, 0.6+Math.random()*0.8, 0.6+Math.random()*0.8);
    let p;
    do {
      p = V3((Math.random()-0.5)*1300, (Math.random()-0.5)*500, (Math.random()-0.5)*1300);
    } while (p.length() < 120);
    a.position = p; a.material = m;
    a.rotation = V3(Math.random()*3, Math.random()*3, Math.random()*3);
    const spin = V3((Math.random()-0.5)*0.002,(Math.random()-0.5)*0.002,(Math.random()-0.5)*0.002);
    asteroids.push({ mesh: a, r: r, spin });
  }
  scene.onBeforeRenderObservable.add(() => {
    for (const A of asteroids) A.mesh.rotation.addInPlace(A.spin);
  });
})();
