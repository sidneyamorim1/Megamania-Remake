(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const energyFill = document.getElementById('energyFill');
  const overlay = document.getElementById('overlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const startBtn = document.getElementById('startBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnFire = document.getElementById('btnFire');
  const btnPause = document.getElementById('btnPause');

  const W = 320;
  const H = 480;
  canvas.width = W;
  canvas.height = H;

  const keys = new Set();
  const pointer = { left: false, right: false, fire: false };
  const state = {
    running: false,
    gameOver: false,
    paused: false,
    score: 0,
    level: 1,
    lives: 3,
    energy: 100,
    energyDrain: 6,
    enemySpeed: 22,
    lastTime: 0,
    waveClearedTimer: 0,
    stars: [],
    bullets: [],
    enemyBullets: [],
    powerups: [],
    enemies: [],
    explosions: [],
    particles: [],
    audio: null,
    weapon: 'laser',
    ammo: {
      spread: 0,
      piercing: 0,
      rapid: 0,
    },
    player: {
      x: W / 2,
      y: H - 36,
      w: 18,
      h: 14,
      speed: 160,
      fireCooldown: 0,
      invuln: 0,
    },
    waveTypes: ['burger', 'cookie', 'iron', 'bowtie', 'diamond'],
  };

  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function beep(freq, duration, type = 'square', gain = 0.05) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    state.audio ||= new AudioCtx();
    const o = state.audio.createOscillator();
    const g = state.audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(state.audio.destination);
    o.start();
    o.stop(state.audio.currentTime + duration);
  }

  function resetWave() {
    state.enemies = [];
    const rows = 4 + Math.min(2, Math.floor(state.level / 2));
    const cols = 6;
    const waveMix = ['burger', 'cookie', 'iron', 'bowtie', 'diamond', 'burger', 'cookie'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const kind = waveMix[(r * cols + c + state.level) % waveMix.length];
        state.enemies.push({
          x: 30 + c * 36,
          y: 52 + r * 26,
          baseX: 30 + c * 36,
          baseY: 52 + r * 26,
          w: 18,
          h: 14,
          dir: 1,
          zig: rand(0.8, 1.4),
          shootDelay: rand(1.0, 3.2),
          shootRate: rand(1.6, 4.2),
          drift: rand(-12, 12),
          hp: kind === 'diamond' ? 2 : 1,
          kind,
          alive: true,
        });
      }
    }
    state.enemySpeed = 22 + state.level * 4;
  }

  function updateHUD() {
    scoreEl.textContent = `SCORE ${String(state.score).padStart(6, '0')}`;
    levelEl.textContent = `LEVEL ${state.level}`;
    energyFill.style.transform = `scaleX(${Math.max(0, state.energy / 100)})`;
  }

  function startGame() {
    state.running = true;
    state.gameOver = false;
    state.paused = false;
    state.score = 0;
    state.level = 1;
    state.lives = 3;
    state.energy = 100;
    state.player.x = W / 2;
    state.player.fireCooldown = 0;
    state.player.invuln = 0;
    state.bullets = [];
    state.enemyBullets = [];
    state.powerups = [];
    state.explosions = [];
    state.particles = [];
    state.weapon = 'laser';
    state.ammo.spread = 0;
    state.ammo.piercing = 0;
    state.ammo.rapid = 0;
    state.stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: Math.random() < 0.8 ? 1 : 2,
      v: rand(12, 50),
    }));
    resetWave();
    overlay.classList.remove('show');
    pauseOverlay.classList.remove('show');
  }

  function togglePause(force) {
    if (!state.running || state.gameOver) return;
    const nextPaused = typeof force === 'boolean' ? force : !state.paused;
    if (nextPaused !== state.paused) {
      beep(nextPaused ? 520 : 760, 0.06, 'triangle', 0.035);
    }
    state.paused = nextPaused;
    pauseOverlay.classList.toggle('show', state.paused);
  }

  function endLife() {
    state.lives -= 1;
    state.energy = 100;
    state.player.invuln = 1.5;
    state.player.x = W / 2;
    if (state.lives <= 0) {
      state.running = false;
      state.gameOver = true;
      overlay.innerHTML = `<div class="panel"><h1>GAME OVER</h1><p>SCORE ${String(state.score).padStart(6, '0')}</p><button id="startBtn">RESTART</button></div>`;
      overlay.classList.add('show');
      overlay.querySelector('#startBtn').addEventListener('click', () => location.reload());
    }
  }

  function nextLevel() {
    state.level += 1;
    state.energy = 100;
    state.bullets = [];
    state.enemyBullets = [];
    resetWave();
  }

  function explosion(x, y, color) {
    for (let i = 0; i < 16; i++) {
      state.particles.push({
        x, y,
        vx: rand(-120, 120),
        vy: rand(-120, 120),
        life: rand(0.25, 0.55),
        color,
      });
    }
    beep(120, 0.09, 'sawtooth', 0.08);
  }

  function spawnPowerup(x, y, kind) {
    state.powerups.push({
      x,
      y,
      w: 12,
      h: 12,
      kind,
      vy: 56,
      bob: rand(0, Math.PI * 2),
    });
  }

  function refillAmmo(kind) {
    if (kind === 'spread') {
      state.weapon = 'spread';
      state.ammo.spread = Math.min(12, state.ammo.spread + 6);
    } else if (kind === 'piercing') {
      state.weapon = 'piercing';
      state.ammo.piercing = Math.min(10, state.ammo.piercing + 5);
    } else {
      state.weapon = 'rapid';
      state.ammo.rapid = Math.min(14, state.ammo.rapid + 8);
    }
    beep(1280, 0.08, 'triangle', 0.05);
  }

  function firePlayer() {
    if (state.player.fireCooldown > 0 || !state.running) return;
    let cooldown = 0.14;
    if (state.weapon === 'rapid' && state.ammo.rapid > 0) {
      cooldown = 0.08;
      state.ammo.rapid -= 1;
    }
    state.player.fireCooldown = cooldown;

    if (state.weapon === 'spread' && state.ammo.spread > 0) {
      state.ammo.spread -= 1;
      state.bullets.push({ x: state.player.x - 8, y: state.player.y - 10, vx: -70, vy: -330, w: 3, h: 8, kind: 'spread' });
      state.bullets.push({ x: state.player.x, y: state.player.y - 12, vx: 0, vy: -360, w: 3, h: 8, kind: 'spread' });
      state.bullets.push({ x: state.player.x + 8, y: state.player.y - 10, vx: 70, vy: -330, w: 3, h: 8, kind: 'spread' });
    } else if (state.weapon === 'piercing' && state.ammo.piercing > 0) {
      state.ammo.piercing -= 1;
      state.bullets.push({ x: state.player.x - 1, y: state.player.y - 10, vx: 0, vy: -380, w: 4, h: 10, kind: 'piercing', pierce: 2, hits: 0 });
    } else {
      state.bullets.push({ x: state.player.x - 1, y: state.player.y - 10, vx: 0, vy: -340, w: 3, h: 8, kind: 'laser' });
    }
    beep(920, 0.06, 'square', 0.04);
  }

  function hit(a, b) {
    return Math.abs(a.x - b.x) < ((a.w || 0) + (b.w || 0)) * 0.5 &&
           Math.abs(a.y - b.y) < ((a.h || 0) + (b.h || 0)) * 0.5;
  }

  function update(dt) {
    if (!state.running || state.paused) return;
    state.player.fireCooldown = Math.max(0, state.player.fireCooldown - dt);
    state.player.invuln = Math.max(0, state.player.invuln - dt);

    const left = keys.has('ArrowLeft') || keys.has('KeyA') || pointer.left;
    const right = keys.has('ArrowRight') || keys.has('KeyD') || pointer.right;
    const fire = keys.has('Space') || pointer.fire;

    if (left) state.player.x -= state.player.speed * dt;
    if (right) state.player.x += state.player.speed * dt;
    state.player.x = Math.max(10, Math.min(W - 10, state.player.x));
    if (fire) firePlayer();

    state.energy -= state.energyDrain * dt;
    if (state.energy <= 0) endLife();

    for (const star of state.stars) {
      star.y += star.v * dt;
      if (star.y > H) { star.y = 0; star.x = Math.random() * W; }
    }
    for (const powerup of state.powerups) {
      powerup.y += powerup.vy * dt;
      powerup.bob += dt * 6;
    }
    state.powerups = state.powerups.filter(p => p.y < H + 30);

    const enemyWaveSpeed = state.enemySpeed + state.level * 2;
    const zigzag = Math.sin(performance.now() * 0.002) * 1.2;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      enemy.baseX += (enemy.dir * enemyWaveSpeed * 0.16) * dt;
      enemy.x = enemy.baseX + zigzag * (8 + enemy.zig * 4) + Math.sin(enemy.y * 0.05) * enemy.drift * 0.06;
      enemy.y += dt * (10 + state.level * 1.5);
      if (enemy.x < 18 || enemy.x > W - 18) enemy.dir *= -1;
      enemy.shootDelay -= dt;
      if (enemy.shootDelay <= 0 && state.enemyBullets.length < 2) {
        const bulletSpeed = 120 + state.level * 8 + (enemy.kind === 'iron' ? 16 : 0);
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + 10,
          vx: enemy.kind === 'bowtie' ? rand(-24, 24) : 0,
          vy: bulletSpeed,
          w: 3,
          h: 8,
        });
        enemy.shootDelay = enemy.shootRate + rand(0.2, 0.8);
        beep(240, 0.05, 'square', 0.025);
      }
    }

    for (const b of state.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const b of state.enemyBullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    state.bullets = state.bullets.filter(b => b.y > -20);
    state.enemyBullets = state.enemyBullets.filter(b => b.y < H + 20);

    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    for (const bullet of state.bullets) {
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        if (hit(bullet, enemy)) {
          state.score += 100;
          state.energy = Math.min(100, state.energy + 8);
          explosion(enemy.x, enemy.y, '#ffee55');
          enemy.hp -= 1;
          if (enemy.hp <= 0) {
            enemy.alive = false;
            if (Math.random() < 0.2) {
              spawnPowerup(enemy.x, enemy.y, ['spread', 'piercing', 'rapid'][Math.floor(Math.random() * 3)]);
            }
          }
          if (bullet.kind !== 'piercing') {
            bullet.y = -999;
            break;
          }
          bullet.hits = (bullet.hits || 0) + 1;
          if (bullet.hits >= 3) {
            bullet.y = -999;
            break;
          }
        }
      }
    }

    for (const eb of state.enemyBullets) {
      if (state.player.invuln <= 0 && hit(eb, state.player)) {
        eb.y = H + 999;
        explosion(state.player.x, state.player.y, '#ff5544');
        endLife();
      }
    }

    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      if (state.player.invuln <= 0 && hit(enemy, state.player)) {
        enemy.alive = false;
        explosion(state.player.x, state.player.y, '#ff5544');
        endLife();
      }
    }

    for (const powerup of state.powerups) {
      if (hit(powerup, state.player)) {
        refillAmmo(powerup.kind);
        powerup.y = H + 999;
      }
    }

    if (state.enemies.every(e => !e.alive)) {
      state.waveClearedTimer += dt;
      if (state.waveClearedTimer > 0.8) {
        state.waveClearedTimer = 0;
        state.score += 500;
        nextLevel();
      }
    } else {
      state.waveClearedTimer = 0;
    }

    updateHUD();
  }

  function drawShip(x, y, invuln = false) {
    ctx.save();
    ctx.translate(x, y);
    if (invuln && Math.floor(performance.now() / 80) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#7dff7d';
    ctx.fillRect(-2, -10, 4, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#55aaff';
    ctx.fillRect(-8, 0, 16, 4);
    ctx.fillStyle = '#ff5544';
    ctx.fillRect(-4, 6, 8, 3);
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === 'burger') {
      ctx.fillStyle = '#ffcc66'; ctx.fillRect(-8, -6, 16, 4);
      ctx.fillStyle = '#8b4513'; ctx.fillRect(-8, -2, 16, 4);
      ctx.fillStyle = '#7dff7d'; ctx.fillRect(-8, 2, 16, 3);
      ctx.fillStyle = '#ffcc66'; ctx.fillRect(-8, 5, 16, 3);
    } else if (enemy.kind === 'cookie') {
      ctx.fillStyle = '#d9b37c'; ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(-4, -2, 2, 2); ctx.fillRect(2, -3, 2, 2); ctx.fillRect(-1, 3, 2, 2);
    } else if (enemy.kind === 'iron') {
      ctx.fillStyle = '#9ad3ff'; ctx.fillRect(-6, -7, 12, 14);
      ctx.fillStyle = '#2f6b99'; ctx.fillRect(-4, -9, 8, 3); ctx.fillRect(-3, 7, 6, 3);
    } else if (enemy.kind === 'bowtie') {
      ctx.fillStyle = '#ff77cc'; ctx.fillRect(-8, -5, 6, 10); ctx.fillRect(2, -5, 6, 10);
      ctx.fillStyle = '#ffddee'; ctx.fillRect(-2, -2, 4, 4);
    } else {
      ctx.fillStyle = '#66e6ff';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 8); ctx.lineTo(-7, 0); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -2, 4, 4);
    }
    ctx.restore();
  }

  function drawPowerup(powerup) {
    ctx.save();
    ctx.translate(powerup.x, powerup.y + Math.sin(powerup.bob) * 2);
    if (powerup.kind === 'spread') {
      ctx.fillStyle = '#ffe66d';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#111';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(-8, 0, 16, 2);
    } else if (powerup.kind === 'piercing') {
      ctx.fillStyle = '#66e6ff';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -7, 2, 14);
    } else {
      ctx.fillStyle = '#ff77cc';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-7, -1, 14, 2);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    for (const star of state.stars) {
      ctx.fillStyle = star.s === 1 ? '#444' : '#888';
      ctx.fillRect(star.x | 0, star.y | 0, star.s, star.s);
    }

    for (const p of state.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
    }

    for (const powerup of state.powerups) drawPowerup(powerup);

    for (const b of state.bullets) {
      if (b.kind === 'piercing') {
        ctx.fillStyle = '#66e6ff';
        ctx.fillRect((b.x - 2) | 0, (b.y - 5) | 0, 4, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((b.x - 1) | 0, (b.y - 8) | 0, 2, 16);
      } else if (b.kind === 'spread') {
        ctx.fillStyle = '#ffe66d';
        ctx.fillRect((b.x - 1) | 0, (b.y - 3) | 0, 2, 6);
      } else {
        ctx.fillStyle = '#ffee55';
        ctx.fillRect((b.x - 1) | 0, (b.y - 4) | 0, 2, 8);
      }
    }
    ctx.fillStyle = '#ff5544';
    for (const b of state.enemyBullets) ctx.fillRect((b.x - 1) | 0, (b.y - 4) | 0, 2, 8);

    for (const enemy of state.enemies) if (enemy.alive) drawEnemy(enemy);
    drawShip(state.player.x, state.player.y, state.player.invuln > 0);
  }

  function loop(t) {
    if (!state.lastTime) state.lastTime = t;
    const dt = Math.min(0.033, (t - state.lastTime) / 1000);
    state.lastTime = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindHold(el, key) {
    const on = e => { e.preventDefault(); pointer[key] = true; };
    const off = e => { e.preventDefault(); pointer[key] = false; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }

  window.addEventListener('keydown', e => {
    keys.add(e.code);
    if (!state.running && e.code === 'Space') startGame();
    if (e.code === 'KeyP' || e.code === 'Enter') togglePause();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('resize', resize);
  startBtn.addEventListener('click', startGame);
  resumeBtn.addEventListener('click', () => togglePause(false));
  bindHold(btnLeft, 'left');
  bindHold(btnRight, 'right');
  bindHold(btnFire, 'fire');
  btnPause.addEventListener('click', () => togglePause());

  resize();
  updateHUD();
  requestAnimationFrame(loop);
})();
