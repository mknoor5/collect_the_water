// Game configuration and state variables
let GOAL_CANS = 25;        // default, will be synced with DOM
let currentCans = 0;       // Current number of items collected
let gameActive = false;    // Tracks if game is currently running
let spawnInterval = null;  // Holds the interval for spawning items
let countdownInterval = null;
let timeLeft = 45;         // seconds
let confettiCanvas = null;
let confettiCtx = null;

// DOM references
const gridEl = document.querySelector('.game-grid');
const startBtn = document.getElementById('start-game');
const resetBtn = document.getElementById('reset-game');
const currentCansEl = document.getElementById('current-cans');
const timerEl = document.getElementById('timer');
const goalCansEl = document.getElementById('goal-cans');
const progressBar = document.getElementById('progress-bar');
const achievementsEl = document.getElementById('achievements');

// Creates the 3x3 game grid where items will appear
function createGrid() {
  gridEl.innerHTML = ''; // Clear any existing grid cells
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell'; // Each cell represents a grid square
    cell.setAttribute('data-cell', i);
    gridEl.appendChild(cell);
  }
}

// Utility: pick a random int in [0, max)
function rand(max) { return Math.floor(Math.random() * max); }

// Spawns a new item in a random grid cell
function spawnWaterCan() {
  if (!gameActive) return; // Stop if the game is not active
  const cells = document.querySelectorAll('.grid-cell');

  // Clear all cells before spawning a new water can
  cells.forEach(cell => (cell.innerHTML = ''));

  const randomCell = cells[rand(cells.length)];

  // Decide whether to spawn a good can or an obstacle (~18% obstacle)
  const spawnObstacle = Math.random() < 0.18;

  if (spawnObstacle) {
    randomCell.innerHTML = `
      <div class="water-can-wrapper">
        <div class="obstacle" role="button" tabindex="0" aria-label="bomb - dangerous"></div>
      </div>
    `;
    const obs = randomCell.querySelector('.obstacle');
    if (obs) {
      const onHit = (e) => { e.stopPropagation(); hitObstacle(obs); };
      obs.addEventListener('click', onHit, { once: true });
      obs.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') hitObstacle(obs); });
    }
  } else {
    randomCell.innerHTML = `
      <div class="water-can-wrapper">
        <div class="water-can pop" role="button" tabindex="0" aria-label="collect water can"></div>
      </div>
    `;
    // Attach handler to increment score when clicked
    const can = randomCell.querySelector('.water-can');
    if (can) {
      const onCollect = (e) => {
        e.stopPropagation();
        collectCan(can);
      };
      can.addEventListener('click', onCollect, { once: true });
      // keyboard support
      can.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') collectCan(can); });
    }
  }
}

function collectCan(canEl) {
  if (!gameActive) return;
  // simple pop animation and score update
  canEl.style.transform = 'scale(0.1) rotate(-20deg)';
  canEl.style.transition = 'transform 320ms ease, opacity 320ms ease';
  canEl.style.opacity = '0.0';

  currentCans += 1;
  currentCansEl.textContent = currentCans;
  updateProgress();

  // give a tiny achievement for milestones
  if (currentCans === Math.floor(GOAL_CANS / 2)) {
    showAchievement('Halfway there! Keep going 🌊');
  } else if (currentCans === GOAL_CANS) {
    showAchievement('Goal reached! Well done 🎉');
    // show confetti then end
    launchConfetti();
    setTimeout(() => endGame(true), 700);
  }
}

function hitObstacle(obsEl) {
  if (!gameActive) return;
  obsEl.style.transform = 'scale(0.85) rotate(6deg)';
  obsEl.style.opacity = '0.6';
  obsEl.style.transition = 'transform 240ms ease, opacity 240ms ease';

  // reduce score but don't go below 0
  currentCans = Math.max(0, currentCans - 1);
  currentCansEl.textContent = currentCans;
  updateProgress();
  showAchievement('Boom! You hit a bomb — -1', 1200);
}

// --- Confetti renderer (lightweight canvas) ---
function ensureConfettiCanvas() {
  if (confettiCanvas && confettiCtx) return;
  confettiCanvas = document.createElement('canvas');
  confettiCanvas.id = 'confetti-canvas';
  const container = document.querySelector('.container');
  container.style.position = 'relative';
  container.appendChild(confettiCanvas);
  confettiCanvas.width = container.clientWidth;
  confettiCanvas.height = container.clientHeight;
  confettiCtx = confettiCanvas.getContext('2d');
}

function launchConfetti() {
  ensureConfettiCanvas();
  const W = confettiCanvas.width;
  const H = confettiCanvas.height;
  const pieces = [];
  const colors = ['#0B6BFF', '#2E9DF7', '#4FCBFF', '#BFE6FF', '#7FDBFF'];
  for (let i=0;i<80;i++) {
    pieces.push({
      x: Math.random()*W,
      y: Math.random()*H - H,
      w: 6+Math.random()*8,
      h: 8+Math.random()*10,
      vx: -2 + Math.random()*4,
      vy: 2 + Math.random()*4,
      rot: Math.random()*360,
      color: colors[Math.floor(Math.random()*colors.length)],
    });
  }
  let t = 0;
  function frame() {
    t += 1;
    confettiCtx.clearRect(0,0,W,H);
    for (let p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06; // gravity
      p.rot += p.vx * 2;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot * Math.PI/180);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      confettiCtx.restore();
    }
    if (t < 140) requestAnimationFrame(frame);
    else confettiCtx.clearRect(0,0,W,H);
  }
  frame();
}

// --- Emoji flood on loss ---
function cleanupEmojiFlood() {
  const existing = document.querySelector('.emoji-flood');
  if (existing) existing.remove();
}

function launchEmojiFlood(count = 60) {
  cleanupEmojiFlood();
  const container = document.createElement('div');
  container.className = 'emoji-flood';
  const wrap = document.querySelector('.container');
  wrap.appendChild(container);

  const maxDuration = 6000; // ms
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'emoji';
    el.textContent = '😭';
    const left = Math.random() * 100; // percent
    const size = 18 + Math.floor(Math.random() * 40); // px
    const delay = Math.random() * 1000; // ms
    const duration = 3000 + Math.random() * 3500; // ms
    el.style.left = left + '%';
    el.style.fontSize = size + 'px';
    el.style.opacity = '0.95';
    el.style.animation = `emojiFall ${duration}ms linear ${delay}ms forwards`;
    // slight horizontal drift using transform translateX
    const drift = (Math.random() - 0.5) * 60;
    el.style.transform = `translateX(${drift}px)`;
    container.appendChild(el);
  }

  // remove after animation finishes
  setTimeout(() => { container.remove(); }, maxDuration + 1200);
}

function updateProgress() {
  const pct = Math.min(100, Math.round((currentCans / GOAL_CANS) * 100));
  progressBar.style.width = pct + '%';
}

function showAchievement(msg, timeout = 2200) {
  achievementsEl.textContent = msg;
  achievementsEl.classList.remove('hidden');
  clearTimeout(achievementsEl._timer);
  achievementsEl._timer = setTimeout(() => { achievementsEl.classList.add('hidden'); achievementsEl.textContent = ''; }, timeout);
}

// Initializes and starts a new game
function startGame() {
  if (gameActive) return; // Prevent starting a new game if one is already active
  // sync goal if DOM has it
  GOAL_CANS = parseInt(goalCansEl.textContent, 10) || GOAL_CANS;
  currentCans = 0;
  timeLeft = 45;
  updateProgress();
  currentCansEl.textContent = currentCans;
  timerEl.textContent = timeLeft;
  createGrid(); // Set up the game grid

  gameActive = true;
  startBtn.disabled = true;
  resetBtn.disabled = false;
  showAchievement('Game started — collect the cans!', 1200);

  // spawn at an interval, slightly randomize interval for liveliness
  spawnWaterCan();
  spawnInterval = setInterval(() => {
    // 80% chance to spawn each tick
    if (Math.random() > 0.2) spawnWaterCan();
  }, 900);

  // countdown
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      endGame(false);
    }
  }, 1000);
}

function endGame(won = false) {
  gameActive = false; // Mark the game as inactive
  clearInterval(spawnInterval); // Stop spawning water cans
  clearInterval(countdownInterval);
  startBtn.disabled = false;
  resetBtn.disabled = false;

  if (won) {
    showAchievement('You saved the island! 🎉');
  } else {
    showAchievement('Time up! Try again.');
    // show crying emoji flood on loss
    launchEmojiFlood();
  }
}

function resetGame() {
  clearInterval(spawnInterval);
  clearInterval(countdownInterval);
  gameActive = false;
  currentCans = 0;
  timerEl.textContent = '45';
  currentCansEl.textContent = currentCans;
  progressBar.style.width = '0%';
  createGrid();
  startBtn.disabled = false;
  resetBtn.disabled = true;
  achievementsEl.textContent = '';
}

// Initialize
createGrid();
goalCansEl.textContent = GOAL_CANS;
resetBtn.disabled = true;

// Set up click handlers
startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);

