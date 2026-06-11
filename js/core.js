"use strict";
/* ============================================================
   COMET PROTOCOL — a small mobile suit combat sim
   ============================================================ */
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { adaptToDeviceRatio: true });
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.012, 0.016, 0.03, 1);

const overlay = document.getElementById("overlay");
const octx = overlay.getContext("2d");
function sizeOverlay(){ overlay.width = innerWidth; overlay.height = innerHeight; }
addEventListener("resize", () => { engine.resize(); sizeOverlay(); }); sizeOverlay();

const V3 = (x,y,z) => new BABYLON.Vector3(x,y,z);
