import { createAuthStarWeave } from './authStarWeave'
// Canvas projection and palette adapted from the confirmed v7 role-entry prototype.
type Galaxy = {
  id: string
  cx: number
  cy: number
  cz: number
  scale: number
  spin: number
  phase: number
  wobble: number
  drift: number
  far: boolean
  label: string | null
  orbit?: number
  orbitPhase?: number
  orbitSpeed?: number
  orbitY?: number
  currentDepth?: number
}

type Position = { x: number; y: number; z: number; r: number }
type NodeSpec = Position & {
  id: string
  c: 'gold' | 'lilac' | 'teal' | 'slate'
  label?: string
  hot?: boolean
  hub?: boolean
}
type GalaxyNode = NodeSpec & {
  gx: Galaxy
  base: Position
  appearance: number
}
type RingNode = [string, number, number, number, number, NodeSpec['c']]
type Palette = { a: string; b: string; c: string; d: string }

export function mountRoleSelectGalaxy(
  cv: HTMLCanvasElement,
  viewport: HTMLDivElement,
  scrollArea: HTMLDivElement,
  statement: HTMLDivElement,
) {
  const context = cv.getContext('2d')
  if (!context) {
    viewport.style.setProperty('--auth-reveal', '1')
    viewport.dataset.authReady = 'true'
    return
  }
  const ctx = context
  const auth = createAuthStarWeave(viewport, ctx)
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motion.matches
  const events = new AbortController()
  const options = { passive: true, signal: events.signal }
  let animationFrame = 0

  let W = 0, H = 0, DPR = 1;

  const PAL = {
    gold:  {a:'#FFEDB8', b:'#F2C468', c:'#B98325', d:'#66440E'},
    lilac: {a:'#F1E8FF', b:'#C6AEF7', c:'#896ED0', d:'#43307A'},
    teal:  {a:'#E0FFF8', b:'#86D9C8', c:'#3E978A', d:'#13403A'},
    slate: {a:'#EFF3FB', b:'#BDC8DB', c:'#78849C', d:'#222A39'}
  };

  let seed = 20261117;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rr = (a: number, b: number) => a + (b - a) * rnd();

  /* ── 数据结构 ──
     每个星图是独立的 group：有自己的中心、自转相位、整体缩放。
     galaxies[0] 是中央大图，其余是远处的小星图。 */
  const galaxies: Galaxy[] = [];
  const nodes: GalaxyNode[] = [];
  const edges: [string, string, number][] = [];

  function makeGalaxy(cfg: Partial<Galaxy> & Pick<Galaxy, 'id'>) {
    const g: Galaxy = {
      id: cfg.id,
      cx: cfg.cx || 0,
      cy: cfg.cy || 0,
      cz: cfg.cz || 0,
      scale: cfg.scale || 1,
      spin: rr(-1, 1) * (cfg.spin ?? .34),   /* 自转角速度 */
      phase: rr(0, Math.PI * 2),
      wobble: rr(.6, 1.5),

      drift: cfg.drift ?? 1,                  /* 浮动幅度 */
      far: !!cfg.far,
      label: cfg.label || null,

    };
    galaxies.push(g);
    return g;
  }

  /* 中央大图 */
  const MAIN = makeGalaxy({id:'main', scale:1, spin:.16, drift:1, cy: 40});

  const add = (gx: Galaxy, n: NodeSpec) => {
    const appearance = Array.from(n.id).reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 7);
    nodes.push({ ...n, gx, base: {x: n.x, y: n.y, z: n.z, r: n.r}, appearance });
    return n.id;
  };

  /* ── 中央大图的节点 ── */
  add(MAIN, {id:'core', x:0, y:0, z:0, r:34, c:'gold', label:'数据分析师', hot:true});

  const ringA: RingNode[] = [
    ['Python',   -172, -98, 104, 14, 'teal'],
    ['机器学习',    35, -164, -150, 12, 'lilac'],
    ['统计建模',  164, -52, 106, 17, 'lilac'],
    ['A/B 实验',  85, 115, -190, 14, 'gold'],
    ['Tableau',    -68, 161, 112, 11, 'gold'],
    ['沟通',     -176, 45, -112,  9, 'lilac'],
    ['SQL',      134, 78, 185, 10, 'slate']
  ];
  const idsA = ringA.map(([label, x, y, z, r, c], i) =>
    add(MAIN, {id:'a'+i, x, y, z, r, c, label}));
  idsA.forEach(id => edges.push(['core', id, 1]));
  edges.push(['a0','a2',.5],['a2','a1',.5],['a3','a4',.5],['a5','a6',.5],['a6','a0',.35],['a3','a2',.35]);

  const ringB: RingNode[] = [
    ['产品经理', -215, -180, -130, 8, 'gold'],
    ['数据工程',  255, -135, -73, 7, 'teal'],
    ['BI 看板',   158, 191, 191, 7, 'gold'],
    ['因果推断',  -28, 250, -123, 6, 'lilac'],
    ['NLP',      -265, 90, 112, 7, 'lilac'],
    ['云计算',   -170, -18, -250, 5, 'slate'],
    ['前端',      106, -235, 148, 5, 'teal'],
    ['用户研究', -90, -240, 100, 6, 'teal'],
    ['可视化',    257, 65, 112, 5, 'slate'],
    ['R',        -119, 185, 232, 4, 'slate'],
    ['Spark',     114, 160, -254, 4, 'slate'],
    ['埋点',      94, -93, -267, 5, 'teal']
  ];
  const idsB = ringB.map(([label, x, y, z, r, c], i) =>
    add(MAIN, {id:'b'+i, x, y, z, r, c, label}));
  idsB.forEach((id, i) => {
    edges.push([idsA[i % idsA.length], id, .5]);
    if (i % 2 === 0) edges.push([idsA[(i + 3) % idsA.length], id, .28]);
  });

  /* ── 周围的小星图：每个都有自己的中心、自转、若干节点 ── */
  /* 外围星图均匀分布在立体球壳上，保留前后景深与各自的自转。
     远端仍能看见图的结构，旋转和悬停时四周的星域保持可辨认。 */
  const SATELLITES = [
    {label:'算法工程',   orb:560, y:-150, ph:0.15, sp:0.055, scale:.62, n:7, s:104},
    {label:'产品与设计', orb:700, y:  60, ph:1.05, sp:0.043, scale:.70, n:8, s:116},
    {label:'数据平台',   orb:620, y:-260, ph:2.00, sp:0.062, scale:.52, n:6, s: 92},
    {label:'前端工程',   orb:760, y: 210, ph:3.05, sp:0.038, scale:.56, n:6, s: 96},
    {label:'行业洞察',   orb:880, y:-100, ph:4.10, sp:0.033, scale:.46, n:5, s: 84},
    {label:'后端架构',   orb:640, y: 140, ph:5.15, sp:0.058, scale:.58, n:6, s: 98},
    {label:'云原生',     orb:820, y:-220, ph:0.72, sp:0.040, scale:.48, n:5, s: 86},
    {label:'测试质量',   orb:700, y: 300, ph:1.62, sp:0.047, scale:.50, n:6, s: 90},
    {label:'智能应用',   orb:900, y:  40, ph:2.55, sp:0.030, scale:.54, n:7, s: 94},
    {label:'运营增长',   orb:560, y:-320, ph:3.48, sp:0.064, scale:.44, n:5, s: 82},
    {label:'数据治理',   orb:780, y: 360, ph:4.45, sp:0.036, scale:.48, n:5, s: 88},
    {label:'交互设计',   orb:660, y:-380, ph:5.60, sp:0.052, scale:.52, n:6, s: 92},
    {label:'信息安全',   orb:880, y: 150, ph:0.40, sp:0.035, scale:.45, n:5, s: 84},
    {label:'数字运营',   orb:940, y:-190, ph:1.50, sp:0.028, scale:.48, n:6, s: 90},
    {label:'软件研发',   orb:780, y: 340, ph:2.72, sp:0.041, scale:.46, n:5, s: 86},
    {label:'智能制造',   orb:920, y:-330, ph:3.76, sp:0.032, scale:.42, n:5, s: 80},
    {label:'知识工程',   orb:860, y: -70, ph:4.80, sp:0.037, scale:.46, n:6, s: 88},
    {label:'用户体验',   orb:960, y: 260, ph:5.86, sp:0.026, scale:.44, n:5, s: 82},
    {label:'数据应用',   orb:820, y:-360, ph:2.25, sp:0.039, scale:.42, n:5, s: 82},
    {label:'系统架构',   orb:940, y: 100, ph:5.00, sp:0.029, scale:.44, n:5, s: 84},
    {label:'自然语言',   orb:830, y:0, ph:0.25, sp:0.042, scale:.50, n:6, s:96},
    {label:'计算机视觉', orb:920, y:0, ph:0.65, sp:0.036, scale:.56, n:7, s:104},
    {label:'推荐系统',   orb:780, y:0, ph:0.90, sp:0.045, scale:.46, n:6, s:90},
    {label:'数据可视化', orb:860, y:0, ph:0.35, sp:0.034, scale:.52, n:6, s:98},
    {label:'移动开发',   orb:940, y:0, ph:0.70, sp:0.041, scale:.48, n:5, s:94},
    {label:'质量工程',   orb:810, y:0, ph:0.15, sp:0.033, scale:.50, n:6, s:96},
    {label:'云端运维',   orb:900, y:0, ph:0.55, sp:0.039, scale:.46, n:5, s:92},
    {label:'商业分析',   orb:850, y:0, ph:0.80, sp:0.044, scale:.54, n:7, s:102},
    {label:'隐私计算',   orb:930, y:0, ph:0.30, sp:0.031, scale:.48, n:5, s:90},
    {label:'知识检索',   orb:800, y:0, ph:0.60, sp:0.037, scale:.52, n:6, s:98},
    {label:'嵌入式开发', orb:880, y:0, ph:0.95, sp:0.043, scale:.46, n:5, s:94},
    {label:'机器学习',   orb:950, y:0, ph:0.45, sp:0.035, scale:.54, n:7, s:104},
    {label:'业务建模',   orb:820, y:0, ph:0.10, sp:0.040, scale:.50, n:6, s:96},
    {label:'交付协作',   orb:910, y:0, ph:0.75, sp:0.032, scale:.48, n:5, s:92},
    {label:'数据挖掘',   orb:840, y:0, ph:0.50, sp:0.038, scale:.52, n:6, s:100},
    {label:'智能交互',   orb:960, y:0, ph:0.20, sp:0.046, scale:.50, n:6, s:98}
  ];

  SATELLITES.forEach((s, si) => {
    const g = makeGalaxy({
      id: 'g' + si,
      cx: 0, cy: s.y, cz: 0,
      scale: s.scale, far: true, label: s.label,
      spin: .22 + si * .035, drift: 1.2
    });
    g.orbit = 620 + (s.orb - 560) * .15;
    g.orbitPhase = si * Math.PI * (3 - Math.sqrt(5));
    g.orbitSpeed = s.sp;
    g.orbitY = 1 - 2 * (si + .5) / SATELLITES.length;

    /* 中心小核 */
    const hub = add(g, {
      id: 'g' + si + '_hub', x:0, y:0, z:0,
      r: 11, c: (['gold','lilac','teal'] as const)[si % 3], hub:true
    });

    for (let i = 0; i < s.n; i++){
      const a = (i / s.n) * Math.PI * 2 + rr(-.3, .3);
      const rad = s.s * rr(.55, 1.15);
      const id = add(g, {
        id: `g${si}_${i}`,
        x: Math.cos(a) * rad,
        y: Math.sin(a) * rad * rr(.55, .95),
        z: rr(-70, 70),
        r: i === 0 ? 6.5 : rr(2.2, 4.4),
        c: (['gold','lilac','teal','slate'] as const)[(i + si) % 4]
      });
      edges.push([hub, id, .55]);
      if (i > 1 && i % 2 === 0) edges.push([`g${si}_${i-1}`, id, .3]);
    }
  });

  const dust = Array.from({length:230}, () => ({
    x: rnd(), y: rnd(), r: rr(.35, 1.5), ph: rr(0, 6.28), sp: rr(.2, 1)
  }));

  function resize(){
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = viewport.clientWidth; H = viewport.clientHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ── 指针：视差 + 悬停判定 + 拖拽旋转 ── */
  let px = 0, py = 0, tpx = 0, tpy = 0;
  let mx = -1e4, my = -1e4;             /* 屏幕坐标 */
  let hoverId: string | null = null;                    /* 当前悬停的星图 id */
  const hoverAmt: Record<string, number> = {};                   /* 每个星图的悬停进度 0→1 */

  /* 拖拽：暂停自动摆动，改为跟随指针手动旋转；松手后平滑回到自动摆动 */
  let dragging = false, dragX = 0, dragY = 0;
  let rotYaw = 0, rotPitch = 0;          /* 手动旋转叠加量 */
  let yawVel = 0, pitchVel = 0;          /* 松手后的惯性 */

  let pointerId: number | null = null
  viewport.addEventListener('pointermove', e => {
    if (reduced || e.pointerType !== 'mouse') return
    const bounds = viewport.getBoundingClientRect()
    mx = e.clientX - bounds.left
    my = e.clientY - bounds.top
    tpx = (mx / W - .5) * 80
    tpy = (my / H - .5) * 50
    if (pointerId !== e.pointerId) return

    yawVel = (e.clientX - dragX) * .0045
    pitchVel = (e.clientY - dragY) * .003
    dragX = e.clientX
    dragY = e.clientY
    rotYaw += yawVel
    rotPitch = Math.max(-.55, Math.min(.55, rotPitch + pitchVel))
  }, options)

  viewport.addEventListener('pointerdown', e => {
    if (reduced || e.pointerType !== 'mouse' || e.button !== 0) return
    const target = e.target
    if (!(target instanceof Element) || target.closest('a, button, input, label, .auth-panel, .block, .feats, .foot')) return
    pointerId = e.pointerId
    dragging = true
    dragX = e.clientX
    dragY = e.clientY
    yawVel = pitchVel = 0
    viewport.classList.add('dragging')
    viewport.setPointerCapture(e.pointerId)
  }, options)

  function endDrag(event?: PointerEvent) {
    if (event && event.pointerId !== pointerId) return
    if (pointerId !== null && viewport.hasPointerCapture(pointerId)) {
      viewport.releasePointerCapture(pointerId)
    }
    pointerId = null
    dragging = false
    viewport.classList.remove('dragging')
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    viewport.addEventListener(type, endDrag, options)
  }
  viewport.addEventListener('pointerleave', () => {
    tpx = tpy = 0
    mx = my = -1e4
  }, options)

  const FOCAL = 1000, CAM = 1380;        /* CAM 拉远，把外围的小星图也收进画面 */
  let rotY = 0, tiltX = 0;

  /* 每个星图的自转角 */
  function galaxySpin(g: Galaxy, time: number) {
    return g.phase + (reduced ? 0 : time * .00028 * g.spin * 20);
  }

  function project(n: GalaxyNode, focal: number, time: number) {
    const g = n.gx;
    const sp = galaxySpin(g, time);
    const cs = Math.cos(sp), ss = Math.sin(sp);

    /* 星图内部自转（绕自身 Y 轴） */
    const lx = n.base.x * cs - n.base.z * ss;
    const lz = n.base.x * ss + n.base.z * cs;
    const ly = n.base.y;

    let gx = g.cx, gy = g.cy, gz = g.cz, scale = g.scale;

    /* 黄金角球面采样：各纬度都有星图，整体公转不会缩成同一个平面。 */
    if (g.orbit) {
      const drift = reduced ? 0 : time * .000024 + Math.sin(time * .000006 * ((g.orbitSpeed ?? .04) / .04)) * .07;
      const ang = (g.orbitPhase ?? 0) + drift;
      const height = g.orbitY ?? 0;
      const latitudeRadius = Math.sqrt(Math.max(0, 1 - height * height));
      gx = Math.cos(ang) * latitudeRadius * g.orbit;
      gy = height * g.orbit;
      gz = Math.sin(ang) * latitudeRadius * g.orbit;
      const depthK = (Math.sin(ang) * latitudeRadius + 1) / 2;
      scale = g.scale * (.62 + depthK * .48);
      g.currentDepth = depthK;
      }

    /* 星图整体的轻微前后摆动 */
    const bob = reduced ? 0 : Math.sin(time * .0004 * g.wobble + g.phase) * 8 * g.drift;

    const growK = 1 + (hoverAmt[g.id] || 0) * .16;

    /* 局部坐标 → 世界坐标 */
    const wx = gx + lx * scale * growK;
    const wy = gy + ly * scale + bob;
    const wz = gz + lz * scale;

    /* 全局视角旋转（整页共享） */
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    let x0 = wx * cy - wz * sy;
    const z0 = wx * sy + wz * cy;
    const cx2 = Math.cos(tiltX), sx2 = Math.sin(tiltX);
    let y0 = wy * cx2 - z0 * sx2;
    let zr = wy * sx2 + z0 * cx2;

    if (g.far) {
      /* 只让球壳中心适配视口，局部星图保持原比例。
         先旋转球面、后适配宽高，宽屏和手动旋转时两侧都保留空间覆盖。 */
      const centerX = gx * cy - gz * sy;
      const centerZ = gx * sy + gz * cy;
      const centerY = gy * cx2 - centerZ * sx2;
      const centerDepth = gy * sx2 + centerZ * cx2;
      x0 += centerX * (W * .425 * CAM / (focal * 660) - 1);
      y0 += centerY * (H * .405 * CAM / (focal * 660) - 1);
      zr += centerDepth * (.23 - 1);
    }

    const d = zr + CAM;
    if (d < 150) return null;
    const s = focal / d;
    return {
      x: W / 2 + x0 * s + px,
      y: H / 2 + y0 * s + py,
      s, depth: zr,
      /* 星图整体的屏幕半径，用于悬停命中 */
      gr: 130 * g.scale * s,
      gid: g.id
    };
  }

  function drawStar(n: GalaxyNode, x: number, y: number, radius: number, alpha: number, light: boolean, angle: number) {
    const tint = {
      gold: { glow: '#D2BAD9', body: '#8B709B', white: '#FFF5F2' },
      lilac: { glow: '#BBA7E5', body: '#79659E', white: '#F6EEFF' },
      teal: { glow: '#A4D5D3', body: '#577F91', white: '#ECFDFA' },
      slate: { glow: '#AFBEDF', body: '#687D9B', white: '#F0F5FF' },
    }[n.c];
    const hot = Boolean(n.hot);
    const form = hot ? 1 : n.appearance % 7;
    const phase = (n.appearance % 97) / 97 * Math.PI * 2;
    const r = Math.max(.7, radius * (hot ? .70 : .88) * (light ? 1.16 : 1));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * .37 + phase);
    ctx.globalAlpha = alpha;

    // A broad, transparent fringe integrates each star with the existing fog.
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.3);
    halo.addColorStop(0, tint.glow + (light ? '75' : '4D'));
    halo.addColorStop(.35, tint.glow + (light ? '24' : '20'));
    halo.addColorStop(1, tint.glow + '00');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.3, 0, Math.PI * 2);
    ctx.fill();

    // Low-detail stars stay as grains. Larger stars have individually curved
    // outlines, with occasional short rays and elongated, cloudlike bodies.
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 16 * Math.PI * 2;
      const irregular = 1 + .12 * Math.sin(t * 3 + phase) + .07 * Math.cos(t * 5 - phase);
      const ray = form === 1 || form === 4 ? .46 + .66 * Math.pow(Math.abs(Math.cos(t * 2)), 7) : 1;
      const stretch = form === 2 || form === 5 ? 1.32 : 1;
      points.push({ x: Math.cos(t) * r * irregular * ray * stretch, y: Math.sin(t) * r * irregular * ray / stretch });
    }
    ctx.beginPath();
    const first = points[0], last = points[points.length - 1];
    ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    points.forEach((point, i) => {
      const next = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    });
    ctx.closePath();
    const core = ctx.createRadialGradient(-r * .10, -r * .12, 0, 0, 0, r * 1.25);
    core.addColorStop(0, light ? tint.body + 'FA' : tint.white + 'FA');
    core.addColorStop(.22, light ? tint.body + 'D4' : tint.white + 'D9');
    core.addColorStop(.48, tint.glow + (light ? 'B0' : 'BA'));
    core.addColorStop(.78, tint.glow + '2B');
    core.addColorStop(1, tint.glow + '00');
    ctx.fillStyle = core;
    ctx.fill();

    if (radius > 5) {
      ctx.globalAlpha = alpha * (light ? .28 : .40);
      ctx.fillStyle = light ? tint.body : tint.white;
      ctx.beginPath();
      ctx.ellipse(-r * .09, -r * .08, r * .13, r * .09, -.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const occupiedLabels: { l: number; r: number; t: number; b: number }[] = [];

  function pill(x: number, y: number, text: string, a: number, light: boolean, strong?: boolean) {
    ctx.font = '500 12.4px "PingFang SC","Microsoft YaHei",sans-serif';
    const w = ctx.measureText(text).width + 22, h = 26;
    const box = { l: x - w / 2 - 4, r: x + w / 2 + 4, t: y - h / 2 - 3, b: y + h / 2 + 3 };
    if (box.l < 8 || box.r > W - 8 || box.t < 70 || box.b > H - 8) return false;
    if (occupiedLabels.some(b => box.l < b.r && box.r > b.l && box.t < b.b && box.b > b.t)) return false;
    occupiedLabels.push(box);
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, h, 7);
    ctx.fillStyle = light
      ? `rgba(255,255,255,${strong ? .96 : .90})`
      : `rgba(7,10,17,${strong ? .92 : .82})`;
    ctx.fill();
    ctx.strokeStyle = light ? 'rgba(11,16,25,.12)' : `rgba(255,255,255,${strong ? .22 : .13})`;
    ctx.lineWidth = strong ? 1.2 : .8; ctx.stroke();
    ctx.fillStyle = light ? '#3B4356' : '#C6D0E0';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + .5);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    return true;
  }

  function sectorPill(x: number, y: number, text: string, a: number, light: boolean) {
    ctx.font = '600 13.5px "PingFang SC","Microsoft YaHei",sans-serif';
    const w = ctx.measureText(text).width + 26, h = 30;
    const box = { l: x - w / 2 - 5, r: x + w / 2 + 5, t: y - h / 2 - 5, b: y + h / 2 + 5 };
    if (box.l < 8 || box.r > W - 8 || box.t < 70 || box.b > H - 8) return;
    if (occupiedLabels.some(b => box.l < b.r && box.r > b.l && box.t < b.b && box.b > b.t)) return;
    occupiedLabels.push(box);
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, h, 9);
    ctx.fillStyle = light ? 'rgba(255,255,255,.94)' : 'rgba(8,12,22,.86)';
    ctx.fill();
    ctx.strokeStyle = light ? 'rgba(11,16,25,.13)' : 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = light ? '#2E3648' : '#DCE6FA';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + .5);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  /* 左栏说明文字的保留区：图谱标签落进来就让位 */
  function labelAvoidBox() {
    const bounds = viewport.getBoundingClientRect();
    const r = statement.getBoundingClientRect();
    if (r.bottom < bounds.top || r.top > bounds.bottom) return null;
    return {
      l: r.left - bounds.left - 28, r: r.right - bounds.left + 56,
      t: r.top - bounds.top - 24, b: r.bottom - bounds.top + 24,
    };
  }

  /* 滚动进度：放慢。首屏完全不动，之后用两个视口的高度慢慢显现 */
  function focusT(){
    const vh = H;
    return viewport.dataset.authRoute === 'login' ? 0 : Math.max(0, Math.min(1, (scrollArea.scrollTop - vh * .42) / (vh * 1.55)));
  }

  const readingAreas = Array.from(viewport.querySelectorAll<HTMLElement>('.hero h1, .hero .lede, .cards, .admin, .nav'));

  function frame(t: number) {
    if (!W || !H) return;
    const time = reduced ? 2600 : t;
    const light = viewport.dataset.roleTheme === 'light';
    const ft = focusT();
    const authAmount = auth.update(t, reduced);

    px += (tpx * (1 - ft * .5) - px) * .045;
    py += (tpy * (1 - ft * .5) - py) * .045;

    if (reduced) { rotY = .3; tiltX = -.1; }
    else if (!dragging) {
      /* 松手后惯性衰减；自然摆动始终存在，手动旋转叠加其上 */
      yawVel *= .94; pitchVel *= .94;
      rotYaw += yawVel;
      rotPitch += pitchVel;
      rotPitch = Math.max(-.55, Math.min(.55, rotPitch));

      rotY = Math.sin(time * .000038) * .42 + rotYaw;
      tiltX = -0.09 + Math.sin(time * .00005) * .045 + rotPitch;
    } else {
      rotY = Math.sin(time * .000038) * .42 + rotYaw;
      tiltX = -0.09 + Math.sin(time * .00005) * .045 + rotPitch;
    }

    const focal = FOCAL * (1 + ft * .10) * Math.min(1, W / 640) * Math.max(1, Math.min(1.42, H / 900));

    ctx.clearRect(0, 0, W, H);

    /* 星尘 */
    dust.forEach(d => {
      const tw = reduced ? 1 : .6 + Math.sin(time * .001 * d.sp + d.ph) * .4;
      ctx.globalAlpha = tw * (light ? .13 : .34) * (1 - ft * .18);
      ctx.fillStyle = light ? '#59739F' : '#FFFFFF';
      ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r, 0, 6.2832); ctx.fill();
    });

    /* 先投影，才能做悬停判定 */
    const proj: { n: GalaxyNode; p: NonNullable<ReturnType<typeof project>> }[] = [];
    let mainIndex = 0;
    nodes.forEach(n => {
      const projected = project(n, focal, time);
      const p = projected && !n.gx.far ? auth.morph(projected, n.hot ? 0 : mainIndex++, !!n.hot) : projected;
      if (p) proj.push({n, p});
    });

    /* ── 悬停判定：落在哪个星图的半径内就选中哪个 ── */
    let hit = null, hitDist = 1e9;
    if (mx > -1e3) {
      const centers: Record<string, { x: number; y: number; r: number }> = {};
      proj.forEach(({n, p}) => {
        const c = centers[p.gid];
        if (!c || n.hub || n.id === 'core') {
          centers[p.gid] = { x: p.x, y: p.y, r: p.gr };
        }
      });
      Object.entries(centers).forEach(([gid, c]) => {
        const d = Math.hypot(mx - c.x, my - c.y);
        if (d < c.r * 1.05 && d < hitDist) { hitDist = d; hit = gid; }
      });
    }
    hoverId = hit;

    /* 悬停进度平滑过渡 */
    galaxies.forEach(g => {
      const target = hoverId === g.id ? 1 : 0;
      hoverAmt[g.id] = (hoverAmt[g.id] || 0) + (target - (hoverAmt[g.id] || 0)) * .10;
    });

    /* 主图的中心（用于画光晕） */
    const coreP = proj.find(o => o.n.id === 'core');
    const mainHover = hoverAmt[MAIN.id] || 0;

    if (coreP) {
      const pulse = reduced ? .16 : .15 + Math.sin(time * .0009) * .04;
      const R = Math.min(W, H) * (.46 + mainHover * .10);
      const halo = ctx.createRadialGradient(coreP.p.x, coreP.p.y, 20, coreP.p.x, coreP.p.y, R);
      halo.addColorStop(0, `rgba(238,190,96,${(pulse + mainHover * .06).toFixed(3)})`);
      halo.addColorStop(.32, `rgba(196,146,60,${(pulse * .42).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(150,110,40,0)');
      ctx.globalAlpha = (1 - ft * .22) * (1 - authAmount);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(coreP.p.x, coreP.p.y, R, 0, 6.2832); ctx.fill();
    }

    /* 悬停的星图：外围柔光 */
    if (hoverId && hoverAmt[hoverId] > .02) {
      const c = proj.find(o => o.p.gid === hoverId);
      if (c) {
        const gx = c.p.x, gy = c.p.y;
        const R = c.p.gr * 1.9;
        const glow = ctx.createRadialGradient(gx, gy, 10, gx, gy, R);
        const a = hoverAmt[hoverId] * (light ? .10 : .18);
        glow.addColorStop(0, `rgba(180,200,255,${a.toFixed(3)})`);
        glow.addColorStop(1, 'rgba(180,200,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(gx, gy, R, 0, 6.2832); ctx.fill();
      }
    }

    /* 连线：远的先画 */
    proj.sort((a, b) => b.p.depth - a.p.depth);
    const projectedById = new Map(proj.map(o => [o.n.id, o]));
    edges.forEach(([ia, ib, w]) => {
      const A = projectedById.get(ia), B = projectedById.get(ib);
      if (!A || !B) return;
      const near = Math.min(A.p.s, B.p.s);
      const far = A.n.gx.far || B.n.gx.far;
      const ha = Math.max(hoverAmt[A.p.gid] || 0, hoverAmt[B.p.gid] || 0);

      let a = Math.min(.46, near * .5 * w) * (far ? .34 : 1) * (far ? 1 : 1 - authAmount);
      if (far) a *= Math.min(auth.backgroundOpacity(A.p), auth.backgroundOpacity(B.p));
      a *= (hoverId ? (ha > .1 ? 1 + ha * .9 : far ? .72 : .30) : 1);
      if (a < .010) return;

      ctx.globalAlpha = a * (light ? .62 : 1);
      ctx.strokeStyle = light ? '#3F5372' : '#D2E2FF';
      ctx.lineWidth = near > .6 ? .9 : .6;
      ctx.beginPath(); ctx.moveTo(A.p.x, A.p.y); ctx.lineTo(B.p.x, B.p.y); ctx.stroke();
    });

    /* 节点 */
    proj.forEach(({n, p}) => {
      const g = n.gx;
      const ha = hoverAmt[g.id] || 0;
      const dim = hoverId && hoverId !== g.id ? (g.far ? .82 : .40) : 1;

      /* 悬停的星图整体放大 */
      const grow = 1 + ha * .22;
      let r = n.base.r * p.s * g.scale * grow * 1.0;
      if (!g.far) r *= 1 - authAmount * (n.hot ? .65 : .84);

      if (r < .3) return;
      const pal = PAL[n.c] || PAL.slate;

      let a = g.far
        ? Math.max(.06, Math.min(.34, p.s * .5)) * (1 + ft * .45)
        : Math.max(.14, Math.min(1, .34 + p.s * .8));

      a *= dim;
      if (g.far) a *= auth.backgroundOpacity(p);
      else a *= auth.nodeOpacity(!!n.hot);
      a = Math.min(1, a * (1 + ha * .35));

      drawStar(n, p.x, p.y, r, a, light, galaxySpin(g, time));
    });

    auth.draw(time, light, reduced);
    const avoid = viewport.dataset.authRoute === 'login' ? null : labelAvoidBox();
    occupiedLabels.length = 0;
    if (avoid) occupiedLabels.push(avoid);
    if (viewport.dataset.authRoute !== 'login') {
      const bounds = viewport.getBoundingClientRect();
      readingAreas.forEach(element => {
        const r = element.getBoundingClientRect();
        if (r.bottom < bounds.top || r.top > bounds.bottom) return;
        occupiedLabels.push({l:r.left-bounds.left-12,r:r.right-bounds.left+12,t:r.top-bounds.top-12,b:r.bottom-bounds.top+12});
      });
    }

    /* 小星图的分区名称：只在转到近端、且远离中央主图时才显示 */
    galaxies.filter(g => g.far && g.label).forEach(g => {
      const c = proj.find(o => o.p.gid === g.id && o.n.hub);
      if (!c) return;
      const depthK = g.currentDepth ?? 1;
      const morph = Math.max(0, Math.min(1, (depthK - .45) / .40));
      if (morph <= .01) return;

      /* 离屏幕中心太近就隐藏，避免和中央主图的标签打架 */
      const distC = Math.hypot(c.p.x - W / 2, c.p.y - H / 2);
      const minDist = Math.min(W, H) * .30;
      if (distC < minDist) return;
      const distFade = Math.min(1, (distC - minDist) / (Math.min(W, H) * .12));

      const eased = morph * morph * (3 - 2 * morph);
      const ha = hoverAmt[g.id] || 0;
      let a = eased * distFade * (0.34 + ha * 0.55) * (hoverId && hoverId !== g.id ? .45 : 1);
      a *= 1 - authAmount;
      if (a < .03) return;
      /* 与左栏说明文字重叠就让位 */
      const lp = avoid;
      const ly = c.p.y - c.p.gr * .82;
      if (lp && c.p.x > lp.l && c.p.x < lp.r && ly > lp.t && ly < lp.b) a *= .08;
      if (a < .03) return;
      if (g.label) sectorPill(c.p.x, ly, g.label, a, light);
    });

    const inAvoid = (x: number, y: number) => avoid && x > avoid.l && x < avoid.r && y > avoid.t && y < avoid.b;

    /* 主图节点标签：随滚动缓慢接力淡入 */
    if (ft > .01 && authAmount < .01) {
      proj
        .filter(o => o.n.label && !o.n.gx.far && o.p.s > .5)
        .sort((a, b) => a.p.s - b.p.s)
        .forEach(({n, p}, idx, arr) => {
          /* 每个标签有自己的出现起点，越靠后越晚 */
          const start = .06 + (idx / Math.max(1, arr.length)) * .52;
          const local = Math.max(0, Math.min(1, (ft - start) / .40));
          /* 缓入：先慢后快再停 */
          const eased = local * local * (3 - 2 * local);
          let a = eased * Math.min(1, (p.s - .5) * 3);
          if (a <= .015) return;
          const isMain = hoverAmt[MAIN.id] || 0;
          const off = n.base.r * p.s + (n.hot ? 20 : 14) + (1 - eased) * 10;
          const ly = p.y + off;
          /* 与左栏文字重叠时淡出，而不是硬消失 */
          if (inAvoid(p.x, ly)) a *= .06;
          if (a <= .015) return;
          if (n.label) {
            const alpha = a * .96 * (1 + isMain * .1);
            if (!pill(p.x, ly, n.label, alpha, light, n.hot)) {
              pill(p.x, p.y - off, n.label, alpha, light, n.hot);
            }
          }
        });
    }

    ctx.globalAlpha = 1;
  }

  function tick(time: number) {
    animationFrame = 0
    frame(time)
    if (!reduced) animationFrame = requestAnimationFrame(tick)
  }

  function refresh() {
    if (!animationFrame) animationFrame = requestAnimationFrame(tick)
  }

  const observer = new ResizeObserver(() => {
    resize()
    refresh()
  })
  observer.observe(viewport)
  const themeObserver = new MutationObserver(refresh)
  themeObserver.observe(viewport, { attributes: true, attributeFilter: ['data-role-theme', 'data-auth-route'] })
  const authObserver = new ResizeObserver(refresh)
  const authContent = viewport.querySelector('.auth-overlay')
  if (authContent) authObserver.observe(authContent)
  const authMutations = new MutationObserver(() => {
    const panel = viewport.querySelector('[data-auth-panel]')
    if (panel) authObserver.observe(panel)
    refresh()
  })
  if (authContent) {
    authMutations.observe(authContent, { childList: true, subtree: true })
    const panel = authContent.querySelector('[data-auth-panel]')
    if (panel) authObserver.observe(panel)
    authContent.addEventListener('scroll', refresh, options)
  }
  scrollArea.addEventListener('scroll', refresh, options)
  motion.addEventListener('change', () => {
    reduced = motion.matches
    if (reduced) {
      endDrag()
      mx = my = -1e4
      px = py = tpx = tpy = 0
      for (const id of Object.keys(hoverAmt)) delete hoverAmt[id]
    }
    refresh()
  }, options)

  resize()
  refresh()
  return () => {
    events.abort()
    observer.disconnect()
    themeObserver.disconnect()
    authObserver.disconnect()
    authMutations.disconnect()
    cancelAnimationFrame(animationFrame)
    endDrag()
  }
}
