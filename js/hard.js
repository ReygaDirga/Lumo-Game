const lumoImg = new Image();
lumoImg.src = "../assets/Lumo.png";

// Load powerup icons
const heartImg = new Image();
heartImg.src = "../assets/heart.png";

const shieldImg = new Image();
shieldImg.src = "../assets/shield.png";

const slowImg = new Image();
slowImg.src = "../assets/slow.png";

const fragmentImg = new Image();
fragmentImg.src = "../assets/fragment.png";


/* ---------------- STARFIELD BG ---------------- */
const bg = document.getElementById("bg");
const bgCtx = bg.getContext("2d");
function resizeBG() {
  bg.width = window.innerWidth;
  bg.height = window.innerHeight;
}
window.addEventListener("resize", resizeBG);
resizeBG();

let stars = Array.from({length: 150}, () => ({
  x: Math.random() * bg.width,
  y: Math.random() * bg.height,
  r: Math.random() * 2,
  speed: 1 + Math.random() * 2
}));

function animateBG() {
  bgCtx.fillStyle = "rgba(0,0,20,1)";
  bgCtx.fillRect(0,0,bg.width,bg.height);
  bgCtx.fillStyle = "#fff";
  for (let s of stars) {
    bgCtx.beginPath();
    bgCtx.arc(s.x,s.y,s.r,0,Math.PI*2);
    bgCtx.fill();
    s.x -= s.speed;
    if (s.x < -2) {
      s.x = bg.width + 2;
      s.y = Math.random() * bg.height;
      s.r = Math.random() * 2;
      s.speed = 1 + Math.random() * 2;
    }
  }
  requestAnimationFrame(animateBG);
}
animateBG();

/* ---------------- GAME CANVAS ---------------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const laneCount = 7;
let laneHeight = canvas.height / laneCount;
function laneTop(i){ return i * laneHeight; }
function laneCenter(i){ return laneTop(i) + laneHeight/2; }
function degToRad(d){ return d * Math.PI/180; }
function normalizeAngle(a){ return ((a % 360) + 360) % 360; }
function angleDiff(a,b){ let diff = Math.abs(a-b); return diff>180?360-diff:diff; }

let gameState, photon;
const scoreEl = document.getElementById("score");
const speedEl = document.getElementById("speed");
const livesEl = document.getElementById("lives");
const fragmentsEl = document.getElementById("fragments");
const shieldStatusEl = document.getElementById("shieldStatus");

/* ---------------- SPAWN ---------------- */
function spawnPolarizers(){
  let arr = [];
  let lanes = [...Array(laneCount).keys()];
  lanes.sort(() => Math.random() - 0.5);
  let chosen = lanes.slice(0, 7);
  for (let lane of chosen){
    const targetAngle = Math.floor(Math.random() * 180);
    const tolerance = 25;
    const width = 70 + Math.random()*40;
    const height = laneHeight - 10;
    const y = laneTop(lane) + 5;
    const x = canvas.width + 50;
    arr.push({ type:'polarizer', x, y, width, height, lane, targetAngle, tolerance, used:false });
  }
  return arr;
}

function spawnPowerup(){
  const lane = Math.floor(Math.random() * laneCount);
  const type = ["heart","shield","slow","fragment"][Math.floor(Math.random()*4)];
  const size = 20;
  const y = laneCenter(lane);
  const x = canvas.width + 50;
  return { type, x, y, size, lane };
}

/* ---------------- INPUT ---------------- */
let keys = {};
window.addEventListener("keydown", (e) => {
  if (e.key === "p") { gameState.running = !gameState.running; return; }
  if (e.key === "r") { resetGame(); return; }
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
    keys[e.key] = true;
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e)=>{ keys[e.key]=false; });

/* ---------------- UPDATE ---------------- */
function update(){
  if (!gameState.running) return;
  const elapsed = Math.floor((Date.now()-gameState.startTime)/1000);
  let baseSpeed = 12 + Math.floor(elapsed/5) * 5;

  // kalau slow masih aktif
  if (Date.now() < gameState.slowTimer) {
    gameState.speed = Math.max(3, baseSpeed - gameState.slowEffect);
  } else {
    gameState.speed = baseSpeed;
  }

  gameState.speed = Math.min(gameState.speed, 60);

  gameState.spawnTimer++;
  if (gameState.spawnTimer >= gameState.spawnInterval){
    gameState.spawnTimer = 0;
    gameState.obstacles.push(...spawnPolarizers());
    if (Math.random()<0.4) gameState.powerups.push(spawnPowerup());
  }

  for (let ob of gameState.obstacles) ob.x -= 3 * (gameState.speed/5);
  gameState.obstacles = gameState.obstacles.filter(o=>o.x+o.width>-50);
  for (let p of gameState.powerups) p.x -= 3 * (gameState.speed/5);
  gameState.powerups = gameState.powerups.filter(p=>p.x>-50);

  if (keys["ArrowUp"]) { if (photon.lane>0) photon.lane--; photon.y=laneCenter(photon.lane); keys["ArrowUp"]=false; }
  if (keys["ArrowDown"]) { if (photon.lane<laneCount-1) photon.lane++; photon.y=laneCenter(photon.lane); keys["ArrowDown"]=false; }
  if (keys["ArrowLeft"]) { photon.polarization=normalizeAngle(photon.polarization-photon.rotateStep); keys["ArrowLeft"]=false; }
  if (keys["ArrowRight"]) { photon.polarization=normalizeAngle(photon.polarization+photon.rotateStep); keys["ArrowRight"]=false; }

  // Polarizer collision
  for (let ob of gameState.obstacles){
    if (photon.lane===ob.lane && !ob.used && photon.x+photon.radius>ob.x && photon.x-photon.radius<ob.x+ob.width){
      const diff = angleDiff(photon.polarization, ob.targetAngle);
      if (diff<=ob.tolerance){
        gameState.score++;
        ob.used=true;
      } else {
        if (gameState.shield){ gameState.shield=false; ob.used=true; }
        else {
          gameState.lives--;
          ob.used=true;
          if (gameState.lives<=0){ gameOver(); }
        }
      }
    }
  }

  // Powerups
  for (let p of gameState.powerups){
    if (photon.lane===p.lane && Math.abs(photon.x-p.x)<30){
      if (p.type==="heart" && gameState.lives<3) gameState.lives++;
      if (p.type==="shield") gameState.shield=true;
      if (p.type==="slow") {
        gameState.slowEffect = 5;              // easy: kurangi 5 speed
        gameState.slowTimer = Date.now() + 10000; // efek bertahan 10 detik
      }
      if (p.type==="fragment") gameState.fragments++;
      p.x=-999;
    }
  }

  scoreEl.textContent = "Score: " + gameState.score;
  speedEl.textContent = "Speed: " + gameState.speed;
  livesEl.textContent = "❤️".repeat(gameState.lives);
  fragmentsEl.textContent = "Fragments: " + gameState.fragments;
  shieldStatusEl.textContent = "Shield: " + (gameState.shield ? "ON" : "OFF");
}

/* ---------------- RENDER ---------------- */
function render(){
  laneHeight = canvas.height / laneCount;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background lane
  ctx.globalAlpha=0.1;
  for (let i=0;i<laneCount;i++){
    ctx.fillStyle = i%2? "#111":"#222";
    ctx.fillRect(0,laneTop(i),canvas.width,laneHeight);
  }
  ctx.globalAlpha=1;

  // polarizer
for (let ob of gameState.obstacles){
    ctx.save();
    ctx.translate(ob.x+ob.width/2, ob.y+ob.height/2);
    ctx.rotate(degToRad(ob.targetAngle));
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(-ob.width/2, -ob.height/2, ob.width, ob.height);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-ob.width/2, 0);   // dari kiri ke kanan
    ctx.lineTo(ob.width/2, 0);
    ctx.beginPath();
    ctx.moveTo(ob.width/2 - 10, -5);
    ctx.lineTo(ob.width/2, 0);
    ctx.lineTo(ob.width/2 - 10, 5);
    ctx.stroke();
    ctx.restore();
  }
  // powerups
for (let p of gameState.powerups){
  let img = null;

  if (p.type === "heart") img = heartImg;
  if (p.type === "shield") img = shieldImg;
  if (p.type === "slow") img = slowImg;
  if (p.type === "fragment") img = fragmentImg;

  if (img && img.complete) {
    ctx.drawImage(
      img,
      p.x - p.size/2,
      p.y - p.size/2,
      p.size,
      p.size
    );
  } else {
    // fallback kalau icon belum ke-load
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2);
    ctx.fill();
  }
}

  // === Lumo UFO ===
  ctx.save();
  const floatY = Math.sin(Date.now()/300) * 3; // efek goyang
  ctx.translate(photon.x, photon.y + floatY);
  ctx.rotate(degToRad(photon.polarization));

  // gambar UFO
  ctx.drawImage(
    lumoImg,
    -photon.radius*2,   // geser kiri biar pusat pas
    -photon.radius*2,   // geser atas biar pusat pas
    photon.radius*4,    // lebar
    photon.radius*4     // tinggi
  );

  // indikator arah (garis putih tipis)
//   ctx.strokeStyle = "white";
//   ctx.lineWidth = 2;
//   ctx.beginPath();
//   ctx.moveTo(0,0);
//   ctx.lineTo(photon.radius*2.5,0);
//   ctx.stroke();

  ctx.restore();
}


/* ---------------- LOOP ---------------- */
function loop(){
  update();
  render();
  requestAnimationFrame(loop);
}

/* ---------------- GAME OVER ---------------- */
function gameOver(){
  gameState.running=false;
  document.getElementById("gameOverScreen").style.display="block";
}

/* ---------------- RESET ---------------- */
function resetGame(){
  gameState={
    running:true,
    score:0,
    speed:5,
    fragments:0,
    spawnTimer:0,
    spawnInterval:160,
    obstacles:[],
    powerups:[],
    lives:3,
    shield:false,
    startTime:Date.now(),
    slowEffect:0,
    slowTimer:0
  };
  photon={
    lane:3,
    x:160,
    y:laneCenter(3),
    radius:18,
    polarization:0,
    rotateStep:15
  };
  document.getElementById("gameOverScreen").style.display="none";
}

document.getElementById("restartBtn").addEventListener("click", resetGame);
document.getElementById("menuBtn").addEventListener("click", ()=>{ window.location.href="../index.html"; });

resetGame();
loop();
