/* ---------------- audio ---------------- */
let AC = null, thrGain = null;
function audioInit(){
  if (AC) return;
  try{
    AC = new (window.AudioContext||window.webkitAudioContext)();
    const len = AC.sampleRate;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320;
    thrGain = AC.createGain(); thrGain.gain.value = 0;
    src.connect(lp); lp.connect(thrGain); thrGain.connect(AC.destination);
    src.start();
  }catch(e){}
}
function blip(f, dur, type, vol, slide){
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = f;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime+dur);
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+dur);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime+dur);
}
function boom(vol){
  if (!AC) return;
  const len = AC.sampleRate*0.5, buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1)*(1-i/len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type="lowpass"; f.frequency.value=900;
  f.frequency.exponentialRampToValueAtTime(120, AC.currentTime+0.5);
  const g = AC.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(AC.destination); s.start();
}
const sGun  = () => blip(190, .07, "square", .05, 70);
const sHitE = () => blip(420, .08, "sawtooth", .05, 140);
const sHurt = () => { blip(110,.25,"sawtooth",.08,40); };
