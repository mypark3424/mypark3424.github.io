(() => {
  const root = document.querySelector('[data-game-root]');
  if (!root) return;
  const canvas = root.querySelector('[data-game-board]');
  const ctx = canvas.getContext('2d');
  const status = root.querySelector('[data-game-status]');
  const scoreEl = root.querySelector('[data-score]');
  const bestEl = root.querySelector('[data-best]');
  const startButton = root.querySelector('[data-game-start]');
  const pauseButton = root.querySelector('[data-game-pause]');
  const restartButton = root.querySelector('[data-game-restart]');
  const cell = 24;
  const columns = canvas.width / cell;
  const rows = canvas.height / cell;
  const directions = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const initialSnake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }];
  let snake = initialSnake.map(segment => ({ ...segment }));
  let direction = directions.right;
  let queuedDirection = direction;
  let food = { x: 14, y: 7, kind: 'signal' };
  let score = 0;
  let best = readBest();
  let timerId = null;
  let running = false;
  let paused = false;
  let effect = null;
  let touchStart = null;
  bestEl.textContent = String(best);

  function readBest() {
    try { return Number.parseInt(localStorage.getItem('signal-snake-best') || '0', 10) || 0; } catch { return 0; }
  }

  function saveBest() {
    try { localStorage.setItem('signal-snake-best', String(best)); } catch { /* storage is optional */ }
  }

  function setStatus(message) { status.textContent = message; }

  function isOpposite(next, current) { return next.x === -current.x && next.y === -current.y; }

  function chooseDirection(name) {
    const next = directions[name];
    if (!next || isOpposite(next, direction) || isOpposite(next, queuedDirection)) return;
    queuedDirection = next;
  }

  function randomFood() {
    const open = [];
    for (let y = 0; y < rows; y += 1) for (let x = 0; x < columns; x += 1) {
      if (!snake.some(segment => segment.x === x && segment.y === y)) open.push({ x, y });
    }
    const spot = open[Math.floor(Math.random() * open.length)] || { x: 14, y: 7 };
    const roll = Math.random();
    return { ...spot, kind: roll < 0.1 ? 'low-light' : roll < 0.22 ? 'zoom' : roll < 0.36 ? 'hdr' : 'signal' };
  }

  function resetState() {
    snake = initialSnake.map(segment => ({ ...segment }));
    direction = directions.right;
    queuedDirection = direction;
    food = { x: 14, y: 7, kind: 'signal' };
    score = 0;
    effect = null;
    paused = false;
    scoreEl.textContent = '0';
    pauseButton.textContent = 'Pause';
    pauseButton.disabled = true;
    draw();
  }

  function start() {
    if (running) return;
    if (!paused) resetState();
    running = true;
    paused = false;
    pauseButton.disabled = false;
    setStatus('Signal acquired. Use arrows or WASD.');
    if (timerId === null) timerId = window.setInterval(step, 125);
  }

  function pause() {
    if (!running) return;
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    setStatus(paused ? 'Paused - signal held.' : 'Signal resumed.');
  }

  function restart() {
    stopTimer();
    resetState();
    running = false;
    setStatus('Ready to calibrate.');
    start();
  }

  function stopTimer() {
    if (timerId !== null) { window.clearInterval(timerId); timerId = null; }
    running = false;
    pauseButton.disabled = true;
  }

  function step() {
    if (!running || paused) return;
    direction = queuedDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const hitWall = head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows;
    const hitSelf = snake.some(segment => segment.x === head.x && segment.y === head.y);
    if (hitWall || hitSelf) return gameOver();
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      const points = food.kind === 'hdr' ? 30 : food.kind === 'zoom' ? 20 : 10;
      score += points;
      if (score > best) { best = score; bestEl.textContent = String(best); saveBest(); }
      scoreEl.textContent = String(score);
      effect = { kind: food.kind, until: Date.now() + (food.kind === 'low-light' ? 3500 : 1800) };
      setStatus(`${food.kind.toUpperCase()} signal captured. +${points}`);
      food = randomFood();
    } else snake.pop();
    draw();
  }

  function gameOver() {
    stopTimer();
    setStatus(`Signal lost - game over at ${score} points.`);
    draw();
  }

  function draw() {
    ctx.fillStyle = '#0b0e0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(199,243,107,.08)';
    for (let x = 0; x <= columns; x += 1) { ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= rows; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(canvas.width, y * cell); ctx.stroke(); }
    ctx.fillStyle = food.kind === 'hdr' ? '#c7f36b' : food.kind === 'zoom' ? '#89d9d0' : food.kind === 'low-light' ? '#a9a4ff' : '#f3f4ed';
    ctx.fillRect(food.x * cell + 5, food.y * cell + 5, cell - 10, cell - 10);
    snake.forEach((segment, index) => { ctx.fillStyle = index === 0 ? '#e1ff9c' : '#c7f36b'; ctx.fillRect(segment.x * cell + 2, segment.y * cell + 2, cell - 4, cell - 4); });
    if (effect && effect.kind === 'low-light' && effect.until > Date.now()) { ctx.fillStyle = 'rgba(0,0,0,.54)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#f3f4ed'; ctx.font = '14px Arial'; ctx.fillText('LOW-LIGHT MODE', 16, 26); window.requestAnimationFrame(draw); }
  }

  document.addEventListener('keydown', event => {
    const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    if (keys[event.key]) { event.preventDefault(); chooseDirection(keys[event.key]); }
    if (event.key === ' ' && running) { event.preventDefault(); pause(); }
  });
  root.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => chooseDirection(button.dataset.direction)));
  canvas.addEventListener('touchstart', event => { const point = event.changedTouches[0]; touchStart = { x: point.clientX, y: point.clientY }; }, { passive: true });
  canvas.addEventListener('touchend', event => { if (!touchStart) return; const point = event.changedTouches[0]; const dx = point.clientX - touchStart.x; const dy = point.clientY - touchStart.y; touchStart = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; chooseDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }, { passive: true });
  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', pause);
  restartButton.addEventListener('click', restart);
  resetState();
})();
