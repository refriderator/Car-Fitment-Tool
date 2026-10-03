/* ===== Fitment core. No DOM, no three.js: runs in the page and under Node for checks.
   Body frame: x lateral (+ = left side of the car), y up, z forward. Mesh is in metres; everything in here is millimetres and degrees.
   Wheel-local: u along the axle (+ = outboard), r radial. ET is the distance from the wheel centre plane to the mounting face, + = face outboard. ===== */
(function (G) {
  const IN = 25.4, D2R = Math.PI / 180;
  const FLANGE_H = 17.5;   // J flange height above the bead seat
  const FLANGE_T = 12;     // flange thickness outside the measured rim width, each side

  /* ---- car list. Factory numbers are published; start numbers are the fitment the page opens with. ---- */
  const CARS = {
    nb: {
      name: "Mazda Roadster", code: "NB8C", note: "Garage Vary body", file: "cars/nb.json", wheelbase: 2265,
      factory: { F: { track: 1415, d: 15, j: 6, et: 40, tw: 195, ar: 50 }, R: { track: 1440, d: 15, j: 6, et: 40, tw: 195, ar: 50 } },
      start: { F: { d: 16, j: 7, et: 20, tw: 205, ar: 40, camber: -2.3, rh: 300 }, R: { d: 16, j: 7, et: 22, tw: 205, ar: 40, camber: -1.5, rh: 302 } },
      susp: { F: { type: "Double wishbone", lbj: [73.8, -97.7, 10.2], top: [95.3, 111.9, -10.0] }, R: { type: "Double wishbone", lbj: [136.9, -99.1, 0], top: [151.9, 120.1, 36.9] } },
      maxSteer: 36
    },
    gr: {
      name: "Toyota GR86", code: "ZN8", note: "Premium, stock body", file: "cars/gr.json", wheelbase: 2575,
      factory: { F: { track: 1520, d: 18, j: 7.5, et: 48, tw: 215, ar: 40 }, R: { track: 1550, d: 18, j: 7.5, et: 48, tw: 215, ar: 40 } },
      start: { F: { d: 18, j: 7.5, et: 48, tw: 215, ar: 40, camber: -0.5, rh: null }, R: { d: 18, j: 7.5, et: 48, tw: 215, ar: 40, camber: -1.5, rh: null } },
      susp: { F: { type: "Strut", lbj: [88.1, -118.2, 9.3], top: [245.9, 451.2, -49.8] }, R: { type: "Double wishbone", lbj: [148.5, -127.8, -42.2], top: [187.7, 137.4, 57.4] } },
      maxSteer: 36
    },
    is: {
      name: "Lexus IS300", code: "JCE10", note: "Sedan, aftermarket aero", file: "cars/is.json", wheelbase: 2670,
      factory: { F: { track: 1495, d: 17, j: 7, et: 50, tw: 215, ar: 45 }, R: { track: 1485, d: 17, j: 7, et: 50, tw: 215, ar: 45 } },
      start: { F: { d: 18, j: 9, et: 42, tw: 235, ar: 35, camber: -1.0, rh: 325 }, R: { d: 18, j: 9, et: 52, tw: 235, ar: 35, camber: -1.0, rh: 325 } },
      susp: { F: { type: "Double wishbone", lbj: [55, -150, 30], top: [150, 385, -50] }, R: { type: "Double wishbone", lbj: [66, -140, -2], top: [76, 90, -2] } },
      maxSteer: 36
    }
  };
  const CAR_ORDER = ["nb", "gr", "is"];

  /* ---- tyre and wheel sizes ---- */
  /* Measuring rim: the rim width a tyre's section width is quoted on. Rule of thumb after the ETRTO tables, rounded to the half inch. */
  function measuringRim(tw, ar) {
    const k = ar >= 70 ? 0.70 : ar >= 60 ? 0.75 : ar >= 50 ? 0.80 : ar >= 45 ? 0.85 : ar >= 30 ? 0.90 : 0.92;
    return Math.round(tw * k / IN * 2) / 2;
  }
  function wheelDims(s) {
    const rimR = s.d * IN / 2, SH = s.tw * s.ar / 100, OD = s.d * IN + 2 * SH, jm = measuringRim(s.tw, s.ar);
    const sec = s.tw + 0.4 * (s.j - jm) * IN;                 // section width grows or shrinks about 5 mm per half inch of rim
    const rimOuter = s.j * IN + 2 * FLANGE_T;
    const tread = Math.max(40, Math.min(0.86 * s.tw, sec - 14));
    const back = s.j * IN / 2 + FLANGE_T + s.et;               // backspacing to the inner lip
    return { rimR, SH, OD, R: OD / 2, jm, sec, rimOuter, tread, back, stretch: s.j - jm };
  }
  /* Tyre cross-section from inner bead to outer bead as [u, r] pairs. */
  function tyreProfile(s, n) {
    const d = wheelDims(s), half = [], N = n || 6;
    const A = [s.j * IN / 2 + 3, d.rimR + 15], B = [d.sec / 2, d.rimR + 0.5 * d.SH], C = [d.tread / 2, d.R - Math.max(3, 0.09 * d.SH)];
    half.push([s.j * IN / 2 - 1, d.rimR + 1]);
    for (let i = 0; i <= N; i++) { const t = i / N; half.push([A[0] + (B[0] - A[0]) * Math.sin(t * Math.PI / 2), A[1] + (B[1] - A[1]) * t]); }
    for (let i = 1; i <= N; i++) { const t = i / N; half.push([C[0] + (B[0] - C[0]) * Math.cos(t * Math.PI / 2), B[1] + (C[1] - B[1]) * Math.sin(t * Math.PI / 2)]); }
    for (let i = 1; i <= 4; i++) { const t = i / 4, u = C[0] * (1 - t); half.push([u, d.R - (d.R - C[1]) * (u / C[0]) * (u / C[0])]); }
    const out = half.map(p => [-p[0], p[1]]);                  // inboard half, bead to crown
    for (let i = half.length - 2; i >= 0; i--) out.push([half[i][0], half[i][1]]);
    return out;
  }
  /* Rim barrel cross-section, inner lip to outer lip. */
  function rimProfile(s) {
    const r = s.d * IN / 2, w = s.j * IN / 2, t = FLANGE_T, h = FLANGE_H, well = Math.min(22, r * 0.09);
    const half = [[w + t, r + h], [w + t, r + h - 5], [w + 2, r + 2], [w - 4, r], [w - 22, r - 3], [w - 34, r - well], [0, r - well]];
    const out = half.map(p => [-p[0], p[1]]);
    for (let i = half.length - 2; i >= 0; i--) out.push([half[i][0], half[i][1]]);
    return out;
  }

  /* ---- corner position. Left side; mirror x for the right. ----
     The upright pivots about the lower ball joint. Camber is what an alignment rack reads. A longer lower arm moves the ball joint out.
     Pivot heights come from each model's physics file, taken relative to the factory wheel centre. */
  function corner(car, ax, spec, wcY, steerDeg) {
    const f = car.factory[ax], su = car.susp[ax];
    const c0 = f.track / 2, hub0 = c0 + f.et;
    const lbj0 = [c0 - su.lbj[0], su.lbj[1], su.lbj[2]], top0 = [c0 - su.top[0], su.top[1], su.top[2]];
    const arm = spec.arm || 0, sp = spec.sp || 0, phi = -(spec.camber || 0) * D2R, cs = Math.cos(phi), sn = Math.sin(phi);
    const a = hub0 + sp - spec.et - lbj0[0], b = -lbj0[1];
    const rot = (x, y) => [x * cs - y * sn, x * sn + y * cs];
    const wcRel = rot(a, b), hubRel = rot(hub0 + sp - lbj0[0], b), hub0Rel = rot(hub0 - lbj0[0], b), topRel = rot(top0[0] - lbj0[0], top0[1] - lbj0[1]);
    const lbj = [lbj0[0] + arm, wcY - wcRel[1], lbj0[2]];
    let wc = [lbj[0] + wcRel[0], wcY, 0], axis = [cs, sn, 0];
    let hub = [lbj[0] + hubRel[0], lbj[1] + hubRel[1], 0], hubBare = [lbj[0] + hub0Rel[0], lbj[1] + hub0Rel[1], 0];
    const top = [lbj[0] + topRel[0], lbj[1] + topRel[1], top0[2]];
    const delta = (steerDeg || 0) * D2R;
    if (delta) {
      let k = [top[0] - lbj[0], top[1] - lbj[1], top[2] - lbj[2]]; const kl = Math.hypot(k[0], k[1], k[2]); k = k.map(v => v / kl);
      const c = Math.cos(delta), s = Math.sin(delta);
      const R = v => { const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2], cx = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]; return [v[0] * c + cx[0] * s + k[0] * d * (1 - c), v[1] * c + cx[1] * s + k[1] * d * (1 - c), v[2] * c + cx[2] * s + k[2] * d * (1 - c)]; };
      const about = p => { const v = R([p[0] - lbj[0], p[1] - lbj[1], p[2] - lbj[2]]); return [lbj[0] + v[0], lbj[1] + v[1], lbj[2] + v[2]]; };
      wc = about(wc); hub = about(hub); hubBare = about(hubBare); axis = R(axis);
    }
    return { wc, axis, hub, hubBare, lbj, top, camberFromArm: -Math.asin(Math.max(-1, Math.min(1, arm / Math.max(60, top0[1] - lbj0[1])))) / D2R };
  }
  /* Points on the tyre and the rim lips in the body frame, for clearance. Returns flat [x, y, z, u, alpha] rows. z is relative to the axle line. */
  function wheelPoints(c, spec, stepDeg) {
    const prof = tyreProfile(spec, 4), d = wheelDims(spec), lipU = spec.j * IN / 2 + FLANGE_T, lipR = d.rimR + FLANGE_H;
    prof.push([lipU, lipR], [-lipU, lipR]);
    const ax = c.axis; let e1 = [-ax[2], 0, ax[0]]; const l1 = Math.hypot(e1[0], e1[2]); e1 = [e1[0] / l1, 0, e1[2] / l1];   // horizontal, forward
    const e2 = [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]];
    if (e2[1] < 0) { e2[0] = -e2[0]; e2[1] = -e2[1]; e2[2] = -e2[2]; }
    const out = [], st = stepDeg || 6;
    for (let al = 0; al < 360; al += st) {
      const ca = Math.cos(al * D2R), sa = Math.sin(al * D2R);
      for (const p of prof) out.push(c.wc[0] + ax[0] * p[0] + p[1] * (ca * e1[0] + sa * e2[0]), c.wc[1] + ax[1] * p[0] + p[1] * (ca * e1[1] + sa * e2[1]), c.wc[2] + ax[2] * p[0] + p[1] * (ca * e1[2] + sa * e2[2]), p[0], al);
    }
    return out;
  }

  /* ---- clearance map from the body mesh ----
     For the left wheel of one axle: slice the body with planes x = const every 5 mm, then from the axle line (at the modelled wheel centre)
     cast a ray every 3 degrees in each slice. d[j][i] is the distance to the first body surface. theta: 0 = forward, 90 = up. */
  const MAP = { x0: 420, dx: 5, nx: 130, dth: 3, nth: 120, far: 9999 };
  function buildMap(tris, zc, yc) {
    // tris: Float32Array of triangles in mm (9 numbers each), already limited to the region around the wheel
    const { x0, dx, nx, dth, nth, far } = MAP, segs = Array.from({ length: nx }, () => []);
    for (let t = 0; t < tris.length; t += 9) {
      const ax = tris[t], bx = tris[t + 3], cx = tris[t + 6], lo = Math.min(ax, bx, cx), hi = Math.max(ax, bx, cx);
      let j0 = Math.ceil((lo - x0) / dx), j1 = Math.floor((hi - x0) / dx); if (j1 < 0 || j0 >= nx) continue; j0 = Math.max(0, j0); j1 = Math.min(nx - 1, j1);
      for (let j = j0; j <= j1; j++) {
        const X = x0 + j * dx + 0.0137, pt = [];
        for (let e = 0; e < 3; e++) {
          const p = t + e * 3, q = t + ((e + 1) % 3) * 3, xa = tris[p], xb = tris[q];
          if ((xa - X) * (xb - X) < 0) { const f = (X - xa) / (xb - xa); pt.push(tris[p + 2] + f * (tris[q + 2] - tris[p + 2]) - zc, tris[p + 1] + f * (tris[q + 1] - tris[p + 1]) - yc); }
        }
        if (pt.length === 4) segs[j].push(pt[0], pt[1], pt[2], pt[3]);
      }
    }
    const d = new Float32Array(nx * nth).fill(far);
    for (let j = 0; j < nx; j++) {
      const s = segs[j]; if (!s.length) continue;
      for (let i = 0; i < nth; i++) {
        const th = (i * dth - 90) * D2R, cz = Math.cos(th), cy = Math.sin(th); let best = far;
        for (let k = 0; k < s.length; k += 4) {
          const z1 = s[k], y1 = s[k + 1], ez = s[k + 2] - z1, ey = s[k + 3] - y1, den = cz * ey - cy * ez;
          if (Math.abs(den) < 1e-9) continue;
          const tt = (z1 * ey - y1 * ez) / den, uu = (z1 * cy - y1 * cz) / den;
          if (tt > 0 && tt < best && uu >= -1e-6 && uu <= 1 + 1e-6) best = tt;
        }
        d[j * nth + i] = best;
      }
    }
    return { d, segs, zc, yc };
  }
  function mapAt(map, x, thDeg) {
    const { x0, dx, nx, dth, nth, far } = MAP, j = Math.round((x - x0) / dx);
    if (j < 0 || j >= nx) return far;
    let f = ((thDeg + 90) % 360 + 360) % 360 / dth; const i0 = Math.floor(f) % nth, i1 = (i0 + 1) % nth; f -= Math.floor(f);
    const a = map.d[j * nth + i0], b = map.d[j * nth + i1];
    return (a >= far || b >= far) ? Math.min(a, b) : a + (b - a) * f;
  }
  /* The fender lip: the edge of the arch opening. At each angle: find the outermost slice with body within reach, take the lowest body edge
     in the outer 60 mm (r), and the outermost slice that reaches down to that edge (x). Wheel-well liners in these models are not true to
     the real cars, so only this edge is used for clearance. */
  function lipProfile(map, reach) {
    const { x0, dx, nx, dth, nth } = MAP, xl = new Float32Array(nth).fill(NaN), rl = new Float32Array(nth).fill(NaN);
    for (let i = 0; i < nth; i++) {
      const th = i * dth - 90; if (th < -35 || th > 215) continue;
      for (let j = nx - 1; j >= 0; j--) {
        if (map.d[j * nth + i] < reach) {
          let r = 1e9; const jl = Math.max(0, j - 12);
          for (let q = j; q >= jl; q--) r = Math.min(r, map.d[q * nth + i]);
          let je = j; while (je > jl && map.d[je * nth + i] > r + 12) je--;
          xl[i] = x0 + je * dx; rl[i] = r; break;
        }
      }
    }
    const med = a => { const o = new Float32Array(a.length).fill(NaN); for (let i = 0; i < a.length; i++) { const w = []; for (let q = -2; q <= 2; q++) { const v = a[i + q]; if (v === v) w.push(v); } if (a[i] === a[i] && w.length) { w.sort((p, q2) => p - q2); o[i] = w[w.length >> 1]; } } return o; };
    const X = med(xl), Rr = med(rl);
    // keep one continuous run through the top of the arch; anything that jumps is underbody or bumper, not the lip
    { const iTop = Math.round(180 / dth); let c = -1; for (let q = 0; q < 8 && c < 0; q++) for (const k of [iTop + q, iTop - q]) if (X[k] === X[k] && Rr[k] > 150) { c = k; break; }
      const ok = new Uint8Array(nth); if (c >= 0) { ok[c] = 1; for (const dir of [1, -1]) { let p = c; for (let k = c + dir; k >= 0 && k < nth; k += dir) { if (!(X[k] === X[k]) || Rr[k] < 150 || Math.abs(X[k] - X[p]) > 45 || Math.abs(Rr[k] - Rr[p]) > 45) break; ok[k] = 1; p = k; } } }
      for (let i = 0; i < nth; i++) if (!ok[i]) { X[i] = NaN; Rr[i] = NaN; } }
    let thMin = 999, thMax = -999; for (let i = 0; i < nth; i++) if (X[i] === X[i]) { thMin = Math.min(thMin, i * dth - 90); thMax = Math.max(thMax, i * dth - 90); }
    const at = (arr, th) => { if (thMin > thMax) return NaN; const t = Math.max(thMin, Math.min(thMax, th)), f = (t + 90) / dth, i0 = Math.floor(f), i1 = Math.min(nth - 1, i0 + 1), a = arr[i0], b = arr[i1]; return a === a && b === b ? a + (b - a) * (f - i0) : a === a ? a : b; };
    const topX = [], topR = []; for (let th = 78; th <= 102; th += dth) { const a = at(X, th), b = at(Rr, th); if (a === a && b === b) { topX.push(a); topR.push(b); } }
    topX.sort((p, q) => p - q); topR.sort((p, q) => p - q);
    return { x: X, r: Rr, xAt: th => at(X, th), rAt: th => at(Rr, th), topX: topX[topX.length >> 1], topR: topR[topR.length >> 1], thMin, thMax };
  }

  /* ---- fender flare: push the outer skin around the arch outward. Returns the lateral shift in mm for a body point (left side). ---- */
  function flareShift(lip, zc, yc, x, y, z, F, style) {
    if (!F) return 0;
    const dz = z - zc, dy = y - yc, rho = Math.hypot(dz, dy); let th = Math.atan2(dy, dz) / D2R; if (th < -90) th += 360;
    if (th < lip.thMin - 14 || th > lip.thMax + 14) return 0;
    const Rl = lip.rAt(th), xl = lip.xAt(th);
    if (!(Rl === Rl)) return 0;
    const B = style === "bolt" ? 95 : 230, t = (rho - Rl) / B;
    if (t >= 1 || t < -120 / B) return 0;
    const sm = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
    let wr;
    if (t <= 0) wr = sm(1 + (rho - Rl + 30) / 90);                       // lip flange and the liner just inside follow, then fade
    else wr = style === "bolt" ? 1 - sm((t - 0.72) / 0.28) : 0.5 * (1 + Math.cos(Math.PI * t));
    const wx = sm((x - (xl - 130)) / 100);
    const wt = Math.min(sm((th - (lip.thMin - 14)) / 22), sm(((lip.thMax + 14) - th) / 22));
    return F * wr * wx * wt;
  }

  /* ---- fitment numbers for one axle ----
     lip0: lip of the body as modelled (sets ride height). lip: lip of the body as it is now, flares included.
     Ride height is entered as hub centre to fender lip, straight up. A tyre point is checked against the lip only where it sits under it:
     from the lip edge to LIP_DEPTH inboard. Further in, the wheel well is not checked. */
  const LIP_DEPTH = 22;
  function fitAxle(car, ax, spec, map, lip0, lip, steerDeg, opts) {
    const o = opts || {}, d = wheelDims(spec), f = car.factory[ax], fd = wheelDims(f);
    const wcY = map.yc + (lip0.topR - spec.rh);
    const c = corner(car, ax, spec, wcY, steerDeg || 0);
    const gapOf = (cc, lift) => {
      const pts = wheelPoints(cc, spec, 5); let g = 1e9, where = null;
      for (let i = 0; i < pts.length; i += 5) {
        const x = pts[i], y = pts[i + 1] + lift, z = pts[i + 2], dy = y - map.yc; let th = Math.atan2(dy, z) / D2R; if (th < -90) th += 360;
        if (th < lip.thMin || th > lip.thMax) continue;
        const xe = lip.xAt(th); if (!(xe === xe) || x > xe + 1 || x < xe - LIP_DEPTH) continue;
        const gp = lip.rAt(th) - Math.hypot(z, dy); if (gp < g) { g = gp; where = { x, y, z, th }; }
      }
      return { g, where };
    };
    const describe = w => !w ? "" : w.th < 60 ? "front of the arch" : w.th > 120 ? "rear of the arch" : "top of the arch";
    const st = gapOf(c, 0);
    const pts = wheelPoints(c, spec, 5); let outTop = -1e9, tyreTop = -1e9;
    for (let i = 0; i < pts.length; i += 5) { const al = pts[i + 4]; if (al >= 55 && al <= 125) outTop = Math.max(outTop, pts[i]); tyreTop = Math.max(tyreTop, pts[i + 1]); }
    const poke = outTop - lip.topX, archGap = map.yc + lip.topR - tyreTop, tucked = st.g > 1e8;
    let travel = null, travelWhere = "";
    if (!tucked && st.g <= 0) { travel = 0; travelWhere = describe(st.where); }
    else for (let k = 2; k <= 160; k += 2) { const r = gapOf(c, k); if (r.g <= 0) { travel = k; travelWhere = describe(r.where); break; } }
    let lock = null;
    if (ax === "F" && !o.noLock) {
      lock = { g: 1e9, at: 0, where: "" };
      for (let a = -car.maxSteer; a <= car.maxSteer + 0.01; a += 3) { const r = gapOf(corner(car, ax, spec, wcY, a), 0); if (r.g < lock.g) lock = { g: r.g, at: a, where: describe(r.where) }; }
    }
    const edge = (q, dd) => Math.max(dd.sec / 2, q.j * IN / 2 + FLANGE_T);
    const outerNew = (spec.sp || 0) - spec.et + edge(spec, d), outerOld = -f.et + edge(f, fd), innerNew = -(spec.sp || 0) + spec.et + edge(spec, d), innerOld = f.et + edge(f, fd);
    const rubs = !tucked && st.g <= 0;
    return {
      dims: d, corner: c, wcY, poke, archGap, tucked, lipGap: tucked ? null : st.g, lipWhere: describe(st.where), lipPoint: rubs ? st.where : null, travel, travelWhere, lock,
      outerVsFactory: outerNew - outerOld + (spec.arm || 0), innerVsFactory: innerNew - innerOld - (spec.arm || 0),
      odVsFactory: d.OD - fd.OD, speedo: (fd.OD / d.OD - 1) * 100, track: 2 * c.wc[0], lipX: lip.topX, lipY: map.yc + lip.topR, tyreTop, outTop,
      verdict: rubs ? "RUBS" : poke > 5 ? "POKE" : poke < -5 ? "TUCK" : "FLUSH"
    };
  }

  /* ---- mesh container: decode the packed car file ---- */
  function decodeCar(json, raw) {
    // raw: Uint8Array of the unzipped block. Returns groups with Float32 positions (metres), Float32 normals and indices.
    let o = 0; const groups = [];
    for (const g of json.groups) {
      const q = new Uint16Array(raw.buffer, raw.byteOffset + o, g.nv * 3); o += g.nv * 6; o += (4 - o % 4) % 4;
      const n8 = new Int8Array(raw.buffer, raw.byteOffset + o, g.nv * 3); o += g.nv * 3; o += (4 - o % 4) % 4;
      const idx = g.i32 ? new Uint32Array(raw.buffer, raw.byteOffset + o, g.ni) : new Uint16Array(raw.buffer, raw.byteOffset + o, g.ni); o += g.ni * (g.i32 ? 4 : 2); o += (4 - o % 4) % 4;
      const pos = new Float32Array(g.nv * 3), nrm = new Float32Array(g.nv * 3);
      for (let i = 0; i < g.nv * 3; i++) { pos[i] = json.min[i % 3] + q[i] / 65535 * json.size[i % 3]; nrm[i] = n8[i] / 127; }
      groups.push({ name: g.name, pos, nrm, idx, base: pos.slice(), baseN: nrm.slice() });
    }
    const wm = json.wheelsModel;
    return { groups, axle: { F: { y: wm.LF.y * 1000, z: wm.LF.z * 1000, x: wm.LF.x * 1000, rTyre: wm.LF.rTyre * 1000, camber: wm.LF.camber }, R: { y: wm.LR.y * 1000, z: wm.LR.z * 1000, x: wm.LR.x * 1000, rTyre: wm.LR.rTyre * 1000, camber: wm.LR.camber } } };
  }
  /* Triangles of the body near the left wheel of an axle, in mm, from the current (possibly flared) positions. */
  function regionTris(mesh, zc, yc) {
    const out = [];
    for (const g of mesh.groups) {
      const p = g.pos, ix = g.idx;
      for (let t = 0; t < ix.length; t += 3) {
        const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
        const xm = Math.max(p[a], p[b], p[c]) * 1000; if (xm < MAP.x0) continue;
        const z = p[a + 2] * 1000 - zc; if (z < -700 || z > 700) continue;
        const y = p[a + 1] * 1000 - yc; if (y > 800) continue;
        out.push(p[a] * 1000, p[a + 1] * 1000, p[a + 2] * 1000, p[b] * 1000, p[b + 1] * 1000, p[b + 2] * 1000, p[c] * 1000, p[c + 1] * 1000, p[c + 2] * 1000);
      }
    }
    return new Float32Array(out);
  }
  /* Apply flares to every group, both sides, from the unflared base. lips: {F, R} profiles taken from the unflared body. */
  function applyFlares(mesh, lips, flare, style) {
    const axs = [["F", mesh.axle.F], ["R", mesh.axle.R]];
    for (const g of mesh.groups) {
      const p = g.pos, b = g.base, n = g.nrm, bn = g.baseN;
      for (let i = 0; i < b.length; i += 3) {
        let x = b[i] * 1000; const y = b[i + 1] * 1000, z = b[i + 2] * 1000, sgn = x < 0 ? -1 : 1; x = Math.abs(x);
        let sh = 0, nx = bn[i], ny = bn[i + 1], nz = bn[i + 2];
        if (x > 500) for (const [k, a] of axs) {
          const F = flare[k]; if (!F || Math.abs(z - a.z) > 720) continue;
          const f0 = flareShift(lips[k], a.z, a.y, x, y, z, F, style); if (!f0) continue;
          sh = f0;
          const e = 3, fx = (flareShift(lips[k], a.z, a.y, x + e, y, z, F, style) - f0) / e, fy = (flareShift(lips[k], a.z, a.y, x, y + e, z, F, style) - f0) / e, fz = (flareShift(lips[k], a.z, a.y, x, y, z + e, F, style) - f0) / e;
          const nxs = nx * sgn, kk = nxs / (1 + fx); let mx = nxs - fx * kk, my = ny - fy * kk, mz = nz - fz * kk; const l = Math.hypot(mx, my, mz) || 1;
          nx = mx / l * sgn; ny = my / l; nz = mz / l;
        }
        p[i] = (x + sh) * sgn / 1000; n[i] = nx; n[i + 1] = ny; n[i + 2] = nz;
      }
    }
  }
  /* Outline of the body where a vertical plane across the car cuts it at the axle line: [x, y, x, y] segments in mm, left side. */
  function axleSection(mesh, zc) {
    const out = [];
    for (const g of mesh.groups) {
      const p = g.pos, ix = g.idx;
      for (let t = 0; t < ix.length; t += 3) {
        const v = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3], zz = v.map(q => p[q + 2] * 1000 - zc);
        if ((zz[0] > 0 && zz[1] > 0 && zz[2] > 0) || (zz[0] < 0 && zz[1] < 0 && zz[2] < 0)) continue;
        const pt = [];
        for (let e = 0; e < 3; e++) { const a = v[e], b = v[(e + 1) % 3], za = zz[e], zb = zz[(e + 1) % 3]; if (za * zb < 0) { const f = za / (za - zb); pt.push((p[a] + f * (p[b] - p[a])) * 1000, (p[a + 1] + f * (p[b + 1] - p[a + 1])) * 1000); } }
        if (pt.length === 4 && Math.max(pt[0], pt[2]) > 250) out.push(pt[0], pt[1], pt[2], pt[3]);
      }
    }
    return out;
  }

  G.FIT = { IN, FLANGE_H, FLANGE_T, LIP_DEPTH, CARS, CAR_ORDER, MAP, measuringRim, wheelDims, tyreProfile, rimProfile, corner, wheelPoints, buildMap, mapAt, lipProfile, flareShift, fitAxle, decodeCar, regionTris, applyFlares, axleSection };
})(typeof window !== "undefined" ? window : globalThis);
