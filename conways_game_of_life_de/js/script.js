(function() {
  const BASE_CELL = 12;
  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
  let zoomIdx = 2; // starts at 1.0

  const wrap = document.getElementById('gol-canvas-wrap');
  const canvas = document.getElementById('gol-canvas');
  const ctx = canvas.getContext('2d');

  let COLS, ROWS, grid, nextGrid, gen = 0, running = false, rafId = null, lastTime = 0, fps = 10;

  function cellSize() { return Math.round(BASE_CELL * ZOOM_STEPS[zoomIdx]); }

  function initSize() {
    const CELL = cellSize();
    const w = wrap.offsetWidth || 640;
    const baseW = w;
    if (!COLS) {
      COLS = Math.floor(w / BASE_CELL);
      ROWS = Math.floor((w * 0.55) / BASE_CELL);
    }
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    wrap.style.height = Math.floor(w * 0.55) + 'px';
    wrap.style.overflow = 'auto';
  }

  function makeGrid() { return Array.from({length: ROWS}, () => new Uint8Array(COLS)); }

  function isDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }

  function draw() {
    const CELL = cellSize();
    const bg = isDark() ? '#1a1a1a' : '#ffffff';
    const cellColor = isDark() ? '#e0e0e0' : '#1a1a1a';
    const gridColor = isDark() ? '#2a2a2a' : '#f0f0f0';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = gridColor;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
      }
    }
    ctx.fillStyle = cellColor;
    let alive = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) {
          ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
          alive++;
        }
      }
    }
    document.getElementById('stat-gen').textContent = gen;
    document.getElementById('stat-alive').textContent = alive;
  }

  function neighbors(r, c) {
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = (r + dr + ROWS) % ROWS, nc = (c + dc + COLS) % COLS;
      n += grid[nr][nc];
    }
    return n;
  }

  function step() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const n = neighbors(r, c), alive = grid[r][c];
      nextGrid[r][c] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
    }
    [grid, nextGrid] = [nextGrid, grid];
    gen++;
    draw();
  }

  function loop(ts) {
    if (!running) return;
    if (ts - lastTime >= 1000 / fps) { step(); lastTime = ts; }
    rafId = requestAnimationFrame(loop);
  }

  function setPlay(on) {
    running = on;
    document.getElementById('btn-play').textContent = on ? '⏸ Pause' : '▶ Start';
    document.getElementById('btn-play').classList.toggle('active', on);
    if (on) { lastTime = 0; rafId = requestAnimationFrame(loop); }
    else if (rafId) { cancelAnimationFrame(rafId); }
  }

  function clear() { setPlay(false); grid = makeGrid(); nextGrid = makeGrid(); gen = 0; draw(); }

  function random() {
    setPlay(false); gen = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = Math.random() < 0.3 ? 1 : 0;
    draw();
  }

  function stamp(pattern, offR, offC) {
    pattern.forEach(([r, c]) => {
      const nr = (r + offR + ROWS) % ROWS, nc = (c + offC + COLS) % COLS;
      grid[nr][nc] = 1;
    });
  }

  function glider() {
    clear();
    stamp([[0,1],[1,2],[2,0],[2,1],[2,2]], 2, 2);
    draw();
  }

  function pulsar() {
    clear();
    const p = [];
    [-6,-1,1,6].forEach(r => [-4,-3,-2,2,3,4].forEach(c => p.push([r,c])));
    [-4,-3,-2,2,3,4].forEach(r => [-6,-1,1,6].forEach(c => p.push([r,c])));
    stamp(p, Math.floor(ROWS/2), Math.floor(COLS/2));
    draw();
  }

  function updateZoom() {
    const pct = Math.round(ZOOM_STEPS[zoomIdx] * 100);
    document.getElementById('gol-zoom-label').textContent = pct + '%';
    document.getElementById('gol-zoom-out').disabled = zoomIdx === 0;
    document.getElementById('gol-zoom-in').disabled = zoomIdx === ZOOM_STEPS.length - 1;
    initSize();
    draw();
  }

  document.getElementById('gol-zoom-in').addEventListener('click', () => {
    if (zoomIdx < ZOOM_STEPS.length - 1) { zoomIdx++; updateZoom(); }
  });
  document.getElementById('gol-zoom-out').addEventListener('click', () => {
    if (zoomIdx > 0) { zoomIdx--; updateZoom(); }
  });

  wrap.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0 && zoomIdx < ZOOM_STEPS.length - 1) { zoomIdx++; updateZoom(); }
      else if (e.deltaY > 0 && zoomIdx > 0) { zoomIdx--; updateZoom(); }
    }
  }, { passive: false });

  let painting = false, paintVal = 1;

  function cellAt(e) {
    const CELL = cellSize();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return [Math.floor(y / CELL), Math.floor(x / CELL)];
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    painting = true;
    const [r, c] = cellAt(e);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      if (e.button === 2) {
        paintVal = 0;
        grid[r][c] = 0;
      } else {
        paintVal = grid[r][c] ? 0 : 1;
        grid[r][c] = paintVal;
      }
      draw();
    }
  });
  canvas.addEventListener('mousemove', e => {
    if (!painting) return;
    const [r, c] = cellAt(e);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { grid[r][c] = paintVal; draw(); }
  });
  document.addEventListener('mouseup', () => painting = false);

  document.getElementById('btn-play').addEventListener('click', () => setPlay(!running));
  document.getElementById('btn-step').addEventListener('click', () => { setPlay(false); step(); });
  document.getElementById('btn-clear').addEventListener('click', clear);
  document.getElementById('btn-random').addEventListener('click', random);
  document.getElementById('btn-glider').addEventListener('click', glider);
  document.getElementById('btn-pulsar').addEventListener('click', pulsar);
  document.getElementById('gol-speed').addEventListener('input', e => {
    fps = parseInt(e.target.value);
    document.getElementById('gol-fps-out').textContent = fps;
  });

  initSize();
  grid = makeGrid(); nextGrid = makeGrid();
  random();
})();