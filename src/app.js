/* ===== Page: state, 3D view, read-outs. Uses window.FIT (core) and THREE. ===== */
(function () {
  const F = window.FIT, $ = id => document.getElementById(id), D2R = Math.PI / 180;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const state = { car: "nb", axle: "F", spec: null, flare: { F: 0, R: 0 }, fstyle: "pull", steer: 0, paint: "grey", body: "solid", view: "q" };
  let mesh = null, car = null, lips0 = null, maps = null, lips = null, sections = null, fit = { F: null, R: null }, flareDirty = true;
  const cache = {};
  try { const s = localStorage.getItem("fit.car"); if (s && F.CARS[s]) state.car = s; } catch (e) { }

  /* ---------- three ---------- */
  let renderer, scene, camera, controls, bodyG, bodyMeshes = [], mats, wheelG = [], lipLines = [], marks = [], needRender = true, glOK = true;
  const PAINT = { grey: 0xc9c9c6, red: 0xb30a0a, black: 0x1a1a1f };
  function initGL() {
    const host = $("view");
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { glOK = false; $("msg").textContent = "3D view needs WebGL. The numbers below still work."; return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.insertBefore(renderer.domElement, host.querySelector(".cp-scan"));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 2, 0.05, 60); camera.position.set(3.6, 1.35, 4.2);
    controls = new THREE.OrbitControls(camera, renderer.domElement); controls.target.set(0, 0.5, 0); controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minDistance = 0.6; controls.maxDistance = 14; controls.maxPolarAngle = Math.PI * 0.52; controls.addEventListener("change", () => needRender = true);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1416, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3.5, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 16 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-4, 2.5, -3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3); rim.position.set(5, 1.2, -2); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.55 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const std = o => new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide }, o));
    mats = {
      paint: std({ color: PAINT.grey, metalness: 0.35, roughness: 0.42 }), glass: std({ color: 0x08080a, metalness: 0.6, roughness: 0.15 }),
      trim: std({ color: 0x1d1d22, metalness: 0.1, roughness: 0.8 }), light: std({ color: 0xd9d9d6, metalness: 0.2, roughness: 0.3, emissive: 0x2a2a2a }),
      metal: std({ color: 0x97979b, metalness: 0.7, roughness: 0.35 }), tyre: std({ color: 0x141417, metalness: 0, roughness: 0.92 }),
      rim: std({ color: 0xd9d9d6, metalness: 0.75, roughness: 0.32 }), disc: std({ color: 0x77777c, metalness: 0.8, roughness: 0.45 }), cal: std({ color: 0xb30a0a, metalness: 0.3, roughness: 0.5 }),
      face: new THREE.MeshStandardMaterial({ map: faceTexture(null), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.5 }),
      lip: new THREE.LineBasicMaterial({ color: 0xff2a2a }), mark: new THREE.MeshBasicMaterial({ color: 0xff2a2a, depthTest: false, transparent: true, opacity: 0.9 })
    };
    bodyG = new THREE.Group(); scene.add(bodyG);
    for (let i = 0; i < 4; i++) { const g = new THREE.Group(); bodyG.add(g); wheelG.push(g); const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), mats.mark); m.renderOrder = 9; m.visible = false; bodyG.add(m); marks.push(m); }
    new ResizeObserver(resize).observe(host); resize();
    (function loop() { requestAnimationFrame(loop); if (anim) stepAnim(); controls.update(); if (needRender) { needRender = false; renderer.render(scene, camera); } })();
  }
  /* The wheel face is a picture laid flat on a disc. Without an upload it is a plain six-spoke drawing. */
  function faceTexture(img) {
    const N = 512, cv = document.createElement("canvas"); cv.width = cv.height = N; const g = cv.getContext("2d");
    if (img) { const s = Math.min(img.naturalWidth, img.naturalHeight); g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, 7); g.clip(); g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, N, N); g.restore(); }
    else {
      g.translate(N / 2, N / 2); g.fillStyle = "#d9d9d6"; g.strokeStyle = "#97979b"; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, N / 2 - 2, 0, 7); g.arc(0, 0, N / 2 - 30, 0, 7, true); g.fill("evenodd");
      for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(-26, -40); g.lineTo(-17, -N / 2 + 24); g.lineTo(17, -N / 2 + 24); g.lineTo(26, -40); g.closePath(); g.fill(); g.stroke(); g.restore(); }
      g.beginPath(); g.arc(0, 0, 66, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#1d1d22"; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  function setFace(img) { if (!glOK) return; const old = mats.face.map; mats.face.map = faceTexture(img); mats.face.needsUpdate = true; if (old) old.dispose(); needRender = true; }
  function resize() { if (!glOK) return; const h = $("view"), w = h.clientWidth, hh = h.clientHeight; renderer.setSize(w, hh, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = hh + "px"; camera.aspect = w / Math.max(1, hh); camera.fov = w < 600 ? 44 : 32; camera.updateProjectionMatrix(); needRender = true; }
  let anim = null;
  function goView(v, instant) {
    if (!glOK || !mesh) return; const zf = mesh.axle.F.z / 1000, zr = mesh.axle.R.z / 1000, P = {
      q: [[3.6, 1.35, 4.2], [0, 0.5, 0]], side: [[7.2, 0.7, 0], [0, 0.55, 0]], front: [[0, 0.8, 7], [0, 0.55, 0]], rear: [[0, 0.8, -7], [0, 0.55, 0]],
      line: [[1.02, 0.5, zf + 3.4], [0.84, 0.36, 0]], af: [[2.5, 0.55, zf + 0.9], [0.8, 0.34, zf]], ar: [[2.5, 0.55, zr - 0.9], [0.8, 0.34, zr]]
    }[v];
    const to = { p: new THREE.Vector3(...P[0]), t: new THREE.Vector3(...P[1]) };
    if (instant || matchMedia("(prefers-reduced-motion:reduce)").matches) { camera.position.copy(to.p); controls.target.copy(to.t); needRender = true; return; }
    anim = { p0: camera.position.clone(), t0: controls.target.clone(), to, k: 0 };
  }
  function stepAnim() { anim.k = Math.min(1, anim.k + 0.07); const e = 1 - Math.pow(1 - anim.k, 3); camera.position.lerpVectors(anim.p0, anim.to.p, e); controls.target.lerpVectors(anim.t0, anim.to.t, e); needRender = true; if (anim.k >= 1) anim = null; }

  function buildBody() {
    if (!glOK) return;
    for (const m of bodyMeshes) { bodyG.remove(m); m.geometry.dispose(); } bodyMeshes = [];
    for (const g of mesh.groups) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(g.pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(g.nrm, 3)); geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
      const m = new THREE.Mesh(geo, mats[g.name] || mats.trim); m.castShadow = true; m.userData.group = g.name; bodyG.add(m); bodyMeshes.push(m);
    }
  }
  function lathe(prof, seg) { return new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1] / 1000, p[0] / 1000)), seg); }   // axis = +Y = outboard
  function buildWheel(g, spec) {
    g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); while (g.children.length) g.remove(g.children[0]);
    const w = new THREE.Group(); g.add(w); g.userData.wheel = w;
    const add = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; (parent || w).add(m); return m; };
    add(lathe(F.tyreProfile(spec, 6), 56), mats.tyre); add(lathe(F.rimProfile(spec), 56), mats.rim);
    const rimR = spec.d * F.IN / 2;
    const face = add(new THREE.CircleGeometry((rimR + 4) / 1000, 56), mats.face); face.rotation.x = -Math.PI / 2; face.position.y = (spec.j * F.IN / 2 - 6) / 1000; face.castShadow = false;   // the wheel picture, flat on the outer face
    const h = new THREE.Group(); g.add(h); g.userData.hub = h;                         // brake: fixed to the upright, not to the wheel
    const dr = Math.min(rimR - 32, 165) / 1000; add(new THREE.CylinderGeometry(dr, dr, 0.024, 40), mats.disc, h).position.y = -0.026;
    const cal = add(new THREE.BoxGeometry(0.075, 0.07, 0.15), mats.cal, h); cal.position.set(0, -0.026, dr - 0.03);
  }
  function placeWheels() {
    if (!glOK) return;
    const up = new THREE.Vector3(0, 1, 0);
    [["F", 1], ["F", -1], ["R", 1], ["R", -1]].forEach(([ax, s], i) => {
      const spec = state.spec[ax], c = F.corner(car, ax, spec, fit[ax].wcY, ax === "F" ? state.steer * s : 0), zc = mesh.axle[ax].z, g = wheelG[i];
      const key = [spec.d, spec.j, spec.et, spec.tw, spec.ar].join(); if (g.userData.key !== key) { buildWheel(g, spec); g.userData.key = key; }
      const axis = new THREE.Vector3(c.axis[0] * s, c.axis[1], c.axis[2]).normalize(), q = new THREE.Quaternion().setFromUnitVectors(up, axis);
      g.userData.wheel.position.set(c.wc[0] * s / 1000, c.wc[1] / 1000, (zc + c.wc[2]) / 1000); g.userData.wheel.quaternion.copy(q);
      g.userData.hub.position.set(c.hubBare[0] * s / 1000, c.hubBare[1] / 1000, (zc + c.hubBare[2]) / 1000); g.userData.hub.quaternion.copy(q);
      const lp = fit[ax].lipPoint, m = marks[i]; m.visible = !!lp; if (lp) m.position.set(lp.x * s / 1000, lp.y / 1000, (zc + lp.z) / 1000);
    });
    // the body sits on its wheels: each axle's wheel centre ends up one tyre radius above the ground
    const o = {}; for (const ax of ["F", "R"]) { const sp = state.spec[ax], d = fit[ax].dims, ph = Math.abs(sp.camber) * D2R; o[ax] = (d.R * Math.cos(ph) + d.tread / 2 * Math.sin(ph) - fit[ax].wcY) / 1000; }
    const zf = mesh.axle.F.z / 1000, zr = mesh.axle.R.z / 1000, al = (o.R - o.F) / (zf - zr);
    bodyG.rotation.x = al; bodyG.position.y = o.F + zf * al; needRender = true;
  }
  function drawLips() {
    if (!glOK) return;
    for (const l of lipLines) { bodyG.remove(l); l.geometry.dispose(); } lipLines = [];
    for (const ax of ["F", "R"]) for (const s of [1, -1]) {
      const lp = lips[ax], a = mesh.axle[ax], pts = [];
      for (let th = lp.thMin; th <= lp.thMax; th += 3) { const x = lp.xAt(th), r = lp.rAt(th); if (x === x) pts.push(new THREE.Vector3((x + 3) * s / 1000, (a.y + r * Math.sin(th * D2R)) / 1000, (a.z + r * Math.cos(th * D2R)) / 1000)); }
      if (pts.length > 1) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mats.lip); bodyG.add(l); lipLines.push(l); }
    }
  }
  function paintBody() {
    if (!glOK) return; mats.paint.color.setHex(PAINT[state.paint]); const gh = state.body === "ghost";
    for (const k of ["paint", "trim", "light", "metal", "glass"]) { mats[k].transparent = gh; mats[k].opacity = gh ? (k === "paint" ? 0.28 : 0.18) : 1; mats[k].depthWrite = !gh; mats[k].needsUpdate = true; }
    for (const m of bodyMeshes) m.castShadow = !gh; needRender = true;
  }

  /* ---------- data ---------- */
  async function fetchCar(id) {
    if (cache[id]) return cache[id];
    const res = await fetch(F.CARS[id].file); if (!res.ok) throw new Error("file " + res.status);
    const json = await res.json(), bin = Uint8Array.from(atob(json.gz), c => c.charCodeAt(0));
    let raw;
    if (typeof DecompressionStream !== "undefined") raw = new Uint8Array(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    else {                                                   // older browsers: fetch a small unzip library on demand
      if (!window.pako) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"; s.onload = ok; s.onerror = () => no(new Error("this browser cannot unpack the car file")); document.head.appendChild(s); });
      raw = window.pako.ungzip(bin);
    }
    return cache[id] = F.decodeCar(json, raw);
  }
  function startSpec(lp) { const s = {}; for (const ax of ["F", "R"]) { s[ax] = Object.assign({ sp: 0, arm: 0 }, car.start[ax]); if (s[ax].rh == null) s[ax].rh = Math.round(lp[ax].topR / 5) * 5; } return s; }
  async function loadCar(id, keep) {
    $("msg").hidden = false; $("msg").textContent = "Loading ●";
    try { mesh = await fetchCar(id); } catch (e) { $("msg").textContent = "Could not load this car (" + e.message + "). Pick another, or reload."; return; }
    state.car = id; car = F.CARS[id]; try { localStorage.setItem("fit.car", id); } catch (e) { }
    for (const g of mesh.groups) { g.pos.set(g.base); g.nrm.set(g.baseN); }
    lips0 = {}; for (const ax of ["F", "R"]) { const a = mesh.axle[ax]; lips0[ax] = F.lipProfile(F.buildMap(F.regionTris(mesh, a.z, a.y), a.z, a.y), a.rTyre + 230); }
    if (!keep) { state.spec = startSpec(lips0); state.flare = { F: 0, R: 0 }; state.steer = 0; }
    flareDirty = true; buildBody(); for (const g of wheelG) g.userData.key = "";
    $("steer").max = car.maxSteer; $("steer").min = -car.maxSteer;
    $("kCar").textContent = car.code; $("hudCar").textContent = car.name + " / " + car.code; $("carNote").textContent = car.note + ". Wheelbase " + car.wheelbase + " mm.";
    $("msg").hidden = glOK; syncForm(); update(); goView(state.view, true); srcTable();
  }

  /* ---------- update ---------- */
  function update() {
    if (!mesh) return;
    if (flareDirty) {
      F.applyFlares(mesh, lips0, state.flare, state.fstyle);
      maps = {}; lips = {}; sections = {};
      for (const ax of ["F", "R"]) { const a = mesh.axle[ax]; maps[ax] = F.buildMap(F.regionTris(mesh, a.z, a.y), a.z, a.y); lips[ax] = F.lipProfile(maps[ax], a.rTyre + 230 + state.flare[ax]); sections[ax] = F.axleSection(mesh, a.z); }
      for (const m of bodyMeshes) { m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.normal.needsUpdate = true; m.geometry.computeBoundingSphere(); }
      drawLips(); flareDirty = false;
    }
    for (const ax of ["F", "R"]) fit[ax] = F.fitAxle(car, ax, state.spec[ax], maps[ax], lips0[ax], lips[ax], 0);
    placeWheels(); readouts(); drawCut("F"); drawCut("R");
  }
  const mm = (v, sign) => (sign && v > 0 ? "+" : "") + Math.round(v) + " mm";
  function wheelTxt(s) { return s.d + "x" + s.j + " ET" + (s.et > 0 ? "+" : "") + s.et + (s.sp ? " + " + s.sp + " mm spacer" : ""); }
  function tyreTxt(s) { return s.tw + "/" + s.ar + "R" + s.d; }
  function badge(v) { return '<span class="cp-badge label ' + (v === "RUBS" ? "cp-badge-red" : v === "FLUSH" ? "cp-badge-highlight" : "") + '">' + v + "</span>"; }
  function readouts() {
    let tags = "";
    for (const ax of ["F", "R"]) {
      const r = fit[ax], s = state.spec[ax], d = r.dims, rows = [];
      const row = (k, v, bad) => rows.push("<dt>" + k + "</dt><dd" + (bad ? ' class="bad"' : "") + ">" + v + "</dd>");
      row("Wheel", wheelTxt(s)); row("Tire", tyreTxt(s));
      row(r.poke >= 0 ? "Poke" : "Tuck", mm(Math.abs(r.poke)));
      row("Tire top to lip", r.archGap >= 0 ? mm(r.archGap) + " below" : mm(-r.archGap) + " above");
      if (r.tucked) row("Tire to lip", "inside the lip");
      else row("Tire to lip", r.lipGap > 0 ? mm(r.lipGap) : "overlaps " + mm(-r.lipGap) + ", " + r.lipWhere, r.lipGap <= 0);
      row("Bump to lip", r.travel === 0 ? "touching" : r.travel == null ? "over 160 mm" : r.travel + " mm, " + r.travelWhere, r.travel === 0);
      if (r.lock) row("At lock", r.lock.g > 1e8 ? "inside the lip" : r.lock.g > 0 ? mm(r.lock.g) + " at " + Math.abs(r.lock.at) + "°" : "overlaps " + mm(-r.lock.g) + " at " + Math.abs(r.lock.at) + "°", r.lock.g <= 0);
      row("Outer vs factory", mm(r.outerVsFactory, true)); row("Inner vs factory", r.innerVsFactory > 0 ? mm(r.innerVsFactory) + " closer in" : r.innerVsFactory < 0 ? mm(-r.innerVsFactory) + " further out" : "same");
      row("Tire on rim", Math.abs(d.stretch) < 0.01 ? "on its measuring rim" : Math.abs(d.stretch).toFixed(1) + " in " + (d.stretch > 0 ? "stretched" : "pinched"), Math.abs(d.stretch) > 1.5);
      row("Section width", mm(d.sec)); row("Diameter", Math.round(d.OD) + " mm, " + (r.odVsFactory >= 0 ? "+" : "") + (r.odVsFactory / (d.OD - r.odVsFactory) * 100).toFixed(1) + " %");
      row("Speedo reads", (r.speedo >= 0 ? "+" : "") + r.speedo.toFixed(1) + " %"); row("Track", Math.round(r.track) + " mm");
      $("out" + ax).innerHTML = rows.join(""); $("v" + ax).innerHTML = badge(r.verdict);
      tags += "<span>" + (ax === "F" ? "FR" : "RR") + "</span>" + badge(r.verdict);
    }
    $("hudTags").innerHTML = tags;
    const ax = state.axle, c = fit[ax].corner, su = car.susp[ax];
    $("stanceNote").textContent = "As stored in the 3D file: " + Math.round(lips0[ax].topR) + " mm. " + su.type + ". " + (state.spec[ax].arm ? "With the top mount left alone, this arm change alone would add about " + c.camberFromArm.toFixed(1) + "° of camber." : "");
    $("flareO").textContent = state.flare[ax] + " MM"; $("steerO").textContent = state.steer === 0 ? "STRAIGHT" : Math.abs(state.steer) + "° " + (state.steer > 0 ? "LEFT" : "RIGHT");
  }

  /* ---------- section drawing: a cut through the axle, seen from the front, left side of the car ---------- */
  function drawCut(ax) {
    const cv = $("cut" + ax), dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const r = fit[ax], s = state.spec[ax], c = r.corner, d = r.dims, ink = css("--ink"), muted = css("--ink-muted"), red = css("--red-ink"), line = css("--line"), steel = css("--steel");
    const y0 = c.wc[1] - d.R - 50, y1 = Math.max(r.lipY + 230, c.wc[1] + d.R + 60), xmid = (r.lipX + c.wc[0]) / 2 - 40, sc = Math.min(W / 640, H / (y1 - y0));
    const X = x => W / 2 + (x - xmid) * sc, Y = y => H - 14 - (y - y0) * sc;
    g.lineWidth = 1; g.strokeStyle = muted; g.beginPath(); const sg = sections[ax];
    for (let i = 0; i < sg.length; i += 4) { g.moveTo(X(sg[i]), Y(sg[i + 1])); g.lineTo(X(sg[i + 2]), Y(sg[i + 3])); } g.stroke();
    const gy = c.wc[1] - (d.R * Math.cos(s.camber * D2R) + d.tread / 2 * Math.sin(Math.abs(s.camber) * D2R));
    g.strokeStyle = line; g.beginPath(); g.moveTo(0, Y(gy)); g.lineTo(W, Y(gy)); g.stroke();
    const P = (u, rr) => [X(c.wc[0] + c.axis[0] * u - c.axis[1] * rr), Y(c.wc[1] + c.axis[1] * u + c.axis[0] * rr)];
    const poly = (prof, sgn, fill, stroke, close) => { g.beginPath(); prof.forEach((p, i) => { const q = P(p[0], p[1] * sgn); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); if (close) g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = stroke; g.stroke(); };
    const tp = F.tyreProfile(s, 6), rp = F.rimProfile(s);
    for (const sgn of [1, -1]) { poly(tp, sgn, css("--bg-200"), ink, true); g.lineWidth = 2; poly(rp, sgn, null, steel, false); g.lineWidth = 1; }
    // the hub face
    let a = P(s.et, 80), b = P(s.et, -80); g.strokeStyle = ink; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    // steering / camber axis
    g.lineWidth = 1; g.setLineDash([5, 4]); g.strokeStyle = muted; g.beginPath(); g.moveTo(X(c.lbj[0]), Y(c.lbj[1])); g.lineTo(X(c.top[0]), Y(c.top[1])); g.stroke(); g.setLineDash([]);
    // lip and poke
    g.strokeStyle = red; g.fillStyle = red; g.lineWidth = 2; g.beginPath(); g.moveTo(X(r.lipX), Y(r.lipY)); g.lineTo(X(r.lipX), Y(r.lipY + 150)); g.stroke();
    g.beginPath(); g.arc(X(r.lipX), Y(r.lipY), 4, 0, 7); g.fill();
    g.lineWidth = 1; g.beginPath(); g.moveTo(X(r.outTop), Y(r.lipY + 110)); g.lineTo(X(r.outTop), Y(c.wc[1] + d.rimR)); g.stroke();
    g.beginPath(); g.moveTo(X(r.lipX), Y(r.lipY + 110)); g.lineTo(X(r.outTop), Y(r.lipY + 110)); g.stroke();
    g.font = "20px " + css("--font-mono"); g.textBaseline = "bottom"; g.fillStyle = ink; g.textAlign = "left";
    g.fillText((r.poke >= 0 ? "POKE " : "TUCK ") + Math.round(Math.abs(r.poke)) + " MM", Math.min(W - 150, X(Math.max(r.lipX, r.outTop)) + 8), Y(r.lipY + 104));
    g.fillStyle = muted; g.fillText("INSIDE", 8, H - 16); g.textAlign = "right"; g.fillText("OUTSIDE", W - 8, H - 16);
  }

  /* ---------- form ---------- */
  const FIELDS = ["d", "j", "et", "sp", "tw", "ar", "rh", "camber", "arm"];
  function syncForm() {
    const s = state.spec[state.axle]; for (const k of FIELDS) $(k).value = s[k];
    $("flare").value = state.flare[state.axle]; $("steer").value = state.steer; $("car").value = state.car;
    $("copyAx").textContent = state.axle === "F" ? "Copy to rear" : "Copy to front";
    for (const [id, v] of [["axle", state.axle], ["paint", state.paint], ["body", state.body], ["views", state.view]]) $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v));
  }
  function seg(id, fn) { $(id).addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; fn(b.dataset.v); syncForm(); }); }
  function bind() {
    const sel = $("car"); for (const id of F.CAR_ORDER) { const o = document.createElement("option"); o.value = id; o.textContent = F.CARS[id].name + " " + F.CARS[id].code; sel.appendChild(o); }
    sel.addEventListener("change", () => loadCar(sel.value));
    for (const k of FIELDS) $(k).addEventListener("input", () => {
      const el = $(k), v = parseFloat(el.value); if (!isFinite(v)) return; const lo = +el.min, hi = +el.max; if (v < lo || v > hi) return;
      const s = state.spec[state.axle]; s[k] = v; if (s.ar * s.tw / 100 < 40) return; update();
    });
    $("flare").addEventListener("input", () => { state.flare[state.axle] = +$("flare").value; flareDirty = true; update(); });
    $("steer").addEventListener("input", () => { state.steer = +$("steer").value; placeWheels(); readouts(); });
    seg("axle", v => { state.axle = v; readoutsLater(); }); seg("paint", v => { state.paint = v; paintBody(); }); seg("body", v => { state.body = v; paintBody(); });
    seg("views", v => { state.view = v; goView(v); });
    $("copyAx").addEventListener("click", () => { const a = state.axle, b = a === "F" ? "R" : "F", keep = state.spec[b]; state.spec[b] = Object.assign({}, state.spec[a], { rh: keep.rh }); state.flare[b] = state.flare[a]; flareDirty = true; update(); });
    $("reset").addEventListener("click", () => loadCar(state.car));
    $("copy").addEventListener("click", () => {
      const L = [car.name + " " + car.code + " (" + car.note + ")"];
      for (const ax of ["F", "R"]) { const s = state.spec[ax], r = fit[ax]; L.push((ax === "F" ? "Front: " : "Rear: ") + wheelTxt(s) + ", " + tyreTxt(s) + ", camber " + s.camber + "°, hub to fender " + s.rh + " mm" + (s.arm ? ", lower arm +" + s.arm + " mm" : "") + (state.flare[ax] ? ", flare " + state.flare[ax] + " mm" : "") + " -> " + r.verdict + ", " + (r.poke >= 0 ? "poke " : "tuck ") + Math.round(Math.abs(r.poke)) + " mm"); }
      const txt = L.join("\n"), out = $("copyOut"), btn = $("copy"); out.value = txt;
      const fail = () => { out.hidden = false; out.focus(); out.select(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy spec", 1400); }, fail); else fail();
    });
    $("face").addEventListener("change", () => { const f = $("face").files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { setFace(im); $("faceNote").textContent = "Showing your photo on all four wheels."; }; im.onerror = () => { $("faceNote").textContent = "That file is not an image the browser can read. Try a PNG or JPG."; }; im.src = rd.result; }; rd.readAsDataURL(f); });
    $("faceOff").addEventListener("click", () => { $("face").value = ""; setFace(null); $("faceNote").textContent = "Square photo, wheel centered, taken straight on. A PNG with a clear background shows the brake behind."; });
    window.addEventListener("resize", () => { if (mesh) { drawCut("F"); drawCut("R"); } });
  }
  function readoutsLater() { if (mesh) readouts(); }
  function srcTable() {
    const row = (a, b, c) => "<tr><td>" + a + "</td><td>" + b + "</td><td>" + c + "</td></tr>", f = car.factory;
    const fw = q => q.d + "x" + q.j + " ET+" + q.et + ", " + q.tw + "/" + q.ar + "R" + q.d;
    const SRC = {
      nb: ['Track and tire: <a href="https://cars.japanesecartrade.com/detail/mazda/roadster/rs/167362">Japanese Car Trade, GF-NB8C RS</a>. Wheel width and offset: carried over from your suspension simulator, not re-checked today.'],
      gr: ['<a href="https://cars-japan.net/wheel/n001120892.html">Cars Japan, ZN8 wheel data</a> and <a href="https://spectank.jp/bdy/001120888.html">Spec Tank, ZN8 body data</a>.'],
      is: ['Track: <a href="https://s3.amazonaws.com/cms.ipressroom.com/197/files/20144/2002_IS_300_specs_eng.pdf">Lexus 2002 IS 300 specification sheet</a>. 17x7 with +50 offset: <a href="https://www.clublexus.com/forums/is-1st-gen-2001-2005/297455-wheel-offset.html">ClubLexus forum</a>, one source only.']
    }[state.car];
    $("src").innerHTML = "<tr><th>" + car.name + " " + car.code + "</th><th>Value</th><th>Source</th></tr>" +
      row("Factory track, front / rear", f.F.track + " / " + f.R.track + " mm", SRC[0]) + row("Factory wheel and tire", fw(f.F) + (fw(f.F) === fw(f.R) ? "" : " / " + fw(f.R)), "Same") +
      row("Starting wheels", wheelTxt(car.start.F) + " " + tyreTxt(car.start.F) + " / " + wheelTxt(car.start.R) + " " + tyreTxt(car.start.R), state.car === "gr" ? "Factory" : "Close to what the 3D file wears. A guess, not a record of the build.") +
      row("Suspension", car.susp.F.type + " / " + car.susp.R.type, "Physics data in the 3D file" + (state.car === "is" ? "; front type corrected from the Lexus sheet" : ""));
  }

  bind(); initGL(); paintBody(); loadCar(state.car);
})();
