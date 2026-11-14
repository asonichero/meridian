// Project Meridian — the stage: a renderer drawing into a high-range buffer, soft bloom on the lights, then one grading pass (filmic tone curve,
// a moody split tone (cool steel shadows, warm amber highlights), a vignette and a little film grain). An orbiting camera that glides between shots.
//
//   const st = Stage.create(view, { fov });  st.scene.add(…);  st.start(dt => …);  st.go(pos, look, ms)
(function (root) {
'use strict';
const THREE = root.THREE;

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uShadow: { value: new THREE.Vector3(0.86, 0.96, 1.1) }, uHigh: { value: new THREE.Vector3(1.08, 1.0, 0.88) }, uSat: { value: 0.88 }, uVig: { value: 0.42 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uExposure, uTime, uSat, uVig; uniform vec2 uRes; uniform vec3 uShadow, uHigh; varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c *= mix(uShadow, uHigh, smoothstep(0.05, 0.7, l));
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  c *= 1.0 - uVig * smoothstep(0.35, 1.05, length(q));
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c += (h(vUv * uRes + uTime) - 0.5) * 0.022;
  gl_FragColor = vec4(c, 1.0);
}` };

function create(view, opts) {
  opts = opts || {};
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.keep });
  renderer.setPixelRatio(Math.min(1.5, root.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.LinearEncoding; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  view.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07090c);
  scene.fog = new THREE.FogExp2(0x0d1218, 0.06);
  const camera = new THREE.PerspectiveCamera(opts.fov || 38, 1, 0.05, 80);
  camera.position.set(2.2, 1.5, 2.6);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.4; controls.maxDistance = 9; controls.target.set(0, 0.8, 0);

  // The buffer: half-float, multisampled where WebGL2 allows.
  const gl2 = renderer.capabilities.isWebGL2, RT = gl2 && THREE.WebGLMultisampleRenderTarget ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
  const rt = new RT(4, 4, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, encoding: THREE.LinearEncoding });
  if (rt.samples !== undefined) rt.samples = 4;
  const composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.92); composer.addPass(bloom);
  const grade = new THREE.ShaderPass(GRADE); composer.addPass(grade);

  // On a tall screen (a phone held upright) the view widens so it takes in as much across as a square one would; and the picture is shifted by
  // half of what the controls cover (setInsets: at the bottom, or down one side), so what the camera looks at sits in the middle of what's left.
  const fov0 = camera.fov, insets = { top: 0, bottom: 0, left: 0, right: 0 }, DEG = Math.PI / 180;
  function resize() {
    const w = view.clientWidth || 800, h = view.clientHeight || 600, a = w / h;
    renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = a;
    camera.fov = a < 1 ? 2 * Math.atan(Math.tan(fov0 / 2 * DEG) / a) / DEG : fov0;
    const dx = Math.round((insets.right - insets.left) / 2), dy = Math.round((insets.bottom - insets.top) / 2);
    if (dx || dy) camera.setViewOffset(w, h, dx, dy, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio(); grade.uniforms.uRes.value.set(w * pr, h * pr);
  }
  function setInsets(o) {
    const n = { top: Math.round(o.top || 0), bottom: Math.round(o.bottom || 0), left: Math.round(o.left || 0), right: Math.round(o.right || 0) };
    if (Object.keys(n).some(k => n[k] !== insets[k])) { Object.assign(insets, n); resize(); }
  }
  root.addEventListener('resize', resize); resize();

  let tween = null;
  function go(pos, look, ms) {
    if (!ms) { camera.position.copy(pos); controls.target.copy(look); controls.update(); tween = null; return; }
    tween = { t0: performance.now(), ms, p0: camera.position.clone(), p1: pos.clone(), l0: controls.target.clone(), l1: look.clone() };
  }
  let running = false, last = 0;
  function frame(now, each) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (tween) { const k = Math.min(1, (now - tween.t0) / tween.ms), e = k * k * (3 - 2 * k); camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.l0, tween.l1, e); if (k >= 1) tween = null; }
    if (each) each(dt);
    controls.update(); draw(now);
  }
  function draw(now) { grade.uniforms.uTime.value = (now || performance.now()) * 0.001 % 100; composer.render(); }
  function start(each) {
    running = true; last = performance.now();
    const loop = now => { if (!running) return; frame(now, each); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  const api = { renderer, scene, camera, controls, composer, bloom, grade, resize, setInsets, start, go, draw, step: (ms, each) => { last = performance.now() - ms; frame(performance.now(), each); }, get moving() { return !!tween; } };
  return api;
}

root.Stage = { create, GRADE };
})(typeof window !== 'undefined' ? window : globalThis);
