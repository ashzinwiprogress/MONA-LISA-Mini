const { cmd } = require('../redx');
const { sendHtmlGame } = require('../lib/htmlgame');

function cool(map, key, ms) {
  const now = Date.now();
  if (map[key] && now - map[key] < ms) return Math.ceil((ms - (now - map[key])) / 1000);
  map[key] = now;
  return 0;
}

function shell(title, accent, hint, extraCss, body, script) {
  return `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif;user-select:none;-webkit-tap-highlight-color:transparent}
body{background:radial-gradient(ellipse at 50% 0%,#14203a,#050510 70%);padding:6px;color:#fff;overflow:hidden}
#app{max-width:420px;margin:0 auto}
.hdr{display:flex;justify-content:space-between;align-items:center;padding:4px 2px 6px}
.tt{font:900 15px Arial Black;color:${accent};text-shadow:0 0 12px ${accent}88}
.hrs{display:flex;gap:5px}
.hr{background:rgba(0,0,0,.5);border:1px solid ${accent}55;border-radius:8px;padding:2px 8px;text-align:center;min-width:44px}
.hr i{display:block;font:700 6.5px Arial;color:#8ab8e8}.hr b{font:900 12px Arial Black;color:${accent}}
.gw{position:relative;border:2px solid ${accent}59;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 0 22px ${accent}2e}
canvas{width:100%;display:block;touch-action:none}
.pads{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}
.pd{height:48px;border-radius:12px;border:2px solid rgba(255,255,255,.15);font:900 13px Arial Black;color:#fff;background:linear-gradient(#2a3a5a,#12182a)}
.pd:active{transform:translateY(2px)}
.hint{text-align:center;font:600 8px Arial;color:#6a8ab8;margin-top:4px}
${extraCss || ''}
</style>
<div id="app">
<div class="hdr"><div class="tt">${title}</div><div class="hrs"><div class="hr"><i>SCORE</i><b id="sc">0</b></div><div class="hr"><i>BEST</i><b id="bs">0</b></div></div></div>
<div class="gw">${body}</div>
${hint}
</div>
<script>(function(){${script}})();<\/script>`;
}

cmd({
  pattern: 'carrace',
  alias: ['highway', 'nightdrive', 'racer3d'],
  react: '🚗',
  desc: '3D night highway racer',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  global.plusLimit = global.plusLimit || {};
  const w = cool(global.plusLimit, from + 'carrace', 10000);
  if (w) return reply(`Wait ${w}s`);
  const html = shell('NIGHT DRIVE 3D', '#58c7ff',
    '<div class="pads"><button class="pd" id="L">◀</button><button class="pd" id="NITRO">NITRO</button><button class="pd" id="R">▶</button></div><div class="hint">Hold left/right • Nitro when bar is full • dodge traffic</div>',
    'canvas{aspect-ratio:404/560}',
    '<canvas id="cv" width="404" height="560"></canvas>',
    `
const cv=document.getElementById('cv'),x=cv.getContext('2d'),W=404,H=560,DPR=2;cv.width=W*DPR;cv.height=H*DPR;
const scEl=document.getElementById('sc'),bsEl=document.getElementById('bs');
let BEST=0;try{BEST=+localStorage.getItem('nd3d_best')||0}catch(e){} bsEl.textContent=BEST;
let state='ready',score=0,lane=1,tx=1,nitro=0,onN=false,speed=7,cam=0,cars=[],trees=[],frame=0,overT=0,holdL=0,holdR=0;
function reset(){score=0;lane=1;tx=1;nitro=40;onN=false;speed=7;cam=0;cars=[];trees=[];frame=0;scEl.textContent='0';
for(let i=0;i<8;i++)cars.push({z:400+i*280,lane:i%3,c:['#ff5a5a','#58c7ff','#ffd75e','#a8ff60'][i%4]});
for(let i=0;i<16;i++)trees.push({z:i*140,side:i%2?1:-1});}
reset();
function project(z,off,w){const d=220/(220+z);return {x:W/2+(off)*d,y:90+z*0.9*d,s:d,w:(w||40)*d};}
function update(){frame++;if(state!=='play')return;cam+=speed+(onN?5:0);score+=1;if(frame%8===0)scEl.textContent=score;
if(holdL)tx=Math.max(0,tx-0.08);if(holdR)tx=Math.min(2,tx+0.08);lane=Math.round(tx);
if(onN){nitro-=0.6;if(nitro<=0){onN=false;nitro=0}} else nitro=Math.min(100,nitro+0.12);
speed=Math.min(14,7+score/400);
cars.forEach(c=>{c.z-=speed*1.6+(onN?3:0);if(c.z<-40){c.z+=2200;c.lane=(c.lane+1+Math.floor(Math.random()*2))%3;score+=5;scEl.textContent=score;}
const dz=Math.abs(c.z-40),dl=Math.abs(c.lane-tx);if(dz<28&&dl<0.45){if(onN){c.z+=900;score+=20;}else die();}});
trees.forEach(t=>{t.z-=speed*1.4;if(t.z<-50)t.z+=2200;});}
function die(){state='dead';overT=Date.now();if(score>BEST){BEST=score;try{localStorage.setItem('nd3d_best',BEST)}catch(e){}bsEl.textContent=BEST;}}
function draw(){x.setTransform(DPR,0,0,DPR,0,0);
const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#06102a');g.addColorStop(.45,'#1a3a6a');g.addColorStop(.45,'#1a1a22');g.addColorStop(1,'#0a0a10');
x.fillStyle=g;x.fillRect(0,0,W,H);
x.fillStyle='#fff8c8';x.beginPath();x.arc(320,70,18,0,7);x.fill();
x.fillStyle='#2a2a34';x.beginPath();x.moveTo(W/2-10,90);x.lineTo(W+40,H);x.lineTo(-40,H);x.closePath();x.fill();
x.strokeStyle='#ffd75e';x.setLineDash([18,22]);x.lineDashOffset=-cam;x.lineWidth=3;
x.beginPath();x.moveTo(W/2,90);x.lineTo(W/2,H);x.stroke();x.setLineDash([]);
trees.sort((a,b)=>b.z-a.z).forEach(t=>{const p=project(t.z,t.side*170,18);x.fillStyle='#1a3a12';x.fillRect(p.x-p.w/2,p.y-p.s*40,p.w,p.s*40);x.fillStyle='#5a3a12';x.fillRect(p.x-2,p.y-p.s*10,4,p.s*12);});
cars.sort((a,b)=>b.z-a.z).forEach(c=>{const off=(c.lane-1)*70;const p=project(c.z,off,46);
x.fillStyle='#111';x.fillRect(p.x-p.w*.55,p.y-p.s*8,p.w*1.1,p.s*10);
x.fillStyle=c.c;x.fillRect(p.x-p.w/2,p.y-p.s*22,p.w,p.s*18);
x.fillStyle='rgba(180,230,255,.55)';x.fillRect(p.x-p.w*.32,p.y-p.s*20,p.w*.64,p.s*8);
x.fillStyle='#ffd75e';x.fillRect(p.x-p.w*.42,p.y-p.s*6,p.w*.18,p.s*4);x.fillRect(p.x+p.w*.24,p.y-p.s*6,p.w*.18,p.s*4);});
const me=project(40,(tx-1)*70,50);
x.fillStyle='#111';x.fillRect(me.x-me.w*.58,me.y-me.s*8,me.w*1.16,me.s*10);
x.fillStyle=onN?'#ffd75e':'#58c7ff';x.fillRect(me.x-me.w/2,me.y-me.s*24,me.w,me.s*20);
x.fillStyle='rgba(200,240,255,.7)';x.fillRect(me.x-me.w*.3,me.y-me.s*22,me.w*.6,me.s*9);
x.fillStyle='#fff';x.fillRect(me.x-me.w*.4,me.y-me.s*6,me.w*.16,me.s*4);x.fillRect(me.x+me.w*.24,me.y-me.s*6,me.w*.16,me.s*4);
x.fillStyle='rgba(0,0,0,.45)';x.fillRect(10,H-18,W-20,8);x.fillStyle=nitro>30?'#58c7ff':'#ff5a5a';x.fillRect(10,H-18,(W-20)*nitro/100,8);
if(state!=='play'){x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,0,W,H);x.textAlign='center';x.fillStyle='#58c7ff';x.font='900 26px Arial Black';
x.fillText(state==='dead'?'CRASH':'NIGHT DRIVE',W/2,H/2-20);x.fillStyle='#fff';x.font='700 13px Arial';x.fillText(state==='dead'?'SCORE '+score+'  tap retry':'TAP TO RACE',W/2,H/2+10);x.textAlign='left';}}
function go(){if(state==='ready'||(state==='dead'&&Date.now()-overT>500)){state='play';reset();}}
document.getElementById('L').onpointerdown=()=>{holdL=1;go()};document.getElementById('L').onpointerup=()=>holdL=0;
document.getElementById('R').onpointerdown=()=>{holdR=1;go()};document.getElementById('R').onpointerup=()=>holdR=0;
document.getElementById('NITRO').onpointerdown=()=>{if(nitro>25&&state==='play')onN=true;go()};
cv.onpointerdown=e=>{go();const r=cv.getBoundingClientRect();const px=(e.clientX-r.left)/r.width;if(px<.4)holdL=1;else if(px>.6)holdR=1;else if(nitro>25)onN=true;};
cv.onpointerup=()=>{holdL=0;holdR=0};
function loop(){update();draw();requestAnimationFrame(loop)}loop();
`);
  await sendHtmlGame(conn, from, html, 'NIGHT DRIVE 3D', [m.sender]);
});

cmd({
  pattern: 'tetris',
  alias: ['blocks', 'tetromino'],
  react: '🧱',
  desc: 'Pixel tetris',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  global.plusLimit = global.plusLimit || {};
  const w = cool(global.plusLimit, from + 'tetris', 8000);
  if (w) return reply(`Wait ${w}s`);
  const html = shell('PIXEL TETRIS', '#a8ff60',
    '<div class="pads"><button class="pd" id="L">◀</button><button class="pd" id="ROT">↻</button><button class="pd" id="R">▶</button></div><div class="hint">Tap rotate • hold down to drop</div>',
    'canvas{aspect-ratio:404/560}.pads{grid-template-columns:1fr 1.2fr 1fr}',
    '<canvas id="cv" width="404" height="560"></canvas>',
    `
const cv=document.getElementById('cv'),x=cv.getContext('2d'),W=404,H=560,DPR=2;cv.width=W*DPR;cv.height=H*DPR;
const COLS=10,ROWS=20,SZ=22,OX=92,OY=48;
const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]];
const COLS_C=['#58c7ff','#ffd75e','#ff6aff','#a8ff60','#ff5a5a','#ff9a3c','#7aa0ff'];
let grid,cur,nx,ny,rot,kind,score=0,state='ready',drop=0,BEST=0;
try{BEST=+localStorage.getItem('tet_best')||0}catch(e){} document.getElementById('bs').textContent=BEST;
function empty(){grid=Array.from({length:ROWS},()=>Array(COLS).fill(0))}
function spawn(){kind=Math.floor(Math.random()*7);cur=SHAPES[kind];rot=0;nx=3;ny=0;if(hit(0,0,cur))die()}
function rotate(s){const r=s[0].length,c=s.length,o=[];for(let i=0;i<r;i++){o[i]=[];for(let j=0;j<c;j++)o[i][j]=s[c-1-j][i]}return o}
function hit(dx,dy,s){for(let y=0;y<s.length;y++)for(let xx=0;xx<s[y].length;xx++)if(s[y][xx]&&(ny+y+dy>=ROWS||nx+xx+dx<0||nx+xx+dx>=COLS||grid[ny+y+dy][nx+xx+dx]))return 1;return 0}
function merge(){for(let y=0;y<cur.length;y++)for(let xx=0;xx<cur[y].length;xx++)if(cur[y][xx])grid[ny+y][nx+xx]=kind+1}
function clear(){let n=0;for(let y=ROWS-1;y>=0;y--){if(grid[y].every(v=>v)){grid.splice(y,1);grid.unshift(Array(COLS).fill(0));n++;y++}}if(n){score+=[0,40,100,300,1200][n];document.getElementById('sc').textContent=score}}
function die(){state='dead';if(score>BEST){BEST=score;try{localStorage.setItem('tet_best',BEST)}catch(e){}document.getElementById('bs').textContent=BEST}}
function reset(){empty();score=0;document.getElementById('sc').textContent='0';spawn();state='play'}
function tick(){if(state!=='play')return;if(!hit(0,1,cur))ny++;else{merge();clear();spawn()}}
function drawCell(cx,cy,c){x.fillStyle=c;x.fillRect(OX+cx*SZ,OY+cy*SZ,SZ-1,SZ-1);x.fillStyle='rgba(255,255,255,.18)';x.fillRect(OX+cx*SZ,OY+cy*SZ,SZ-1,5)}
function draw(){x.setTransform(DPR,0,0,DPR,0,0);x.fillStyle='#071018';x.fillRect(0,0,W,H);
x.fillStyle='#0c1824';x.fillRect(OX-4,OY-4,COLS*SZ+8,ROWS*SZ+8);
for(let y=0;y<ROWS;y++)for(let xx=0;xx<COLS;xx++)if(grid[y][xx])drawCell(xx,y,COLS_C[grid[y][xx]-1]);
if(state==='play')for(let y=0;y<cur.length;y++)for(let xx=0;xx<cur[y].length;xx++)if(cur[y][xx])drawCell(nx+xx,ny+y,COLS_C[kind]);
if(state!=='play'){x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,0,W,H);x.textAlign='center';x.fillStyle='#a8ff60';x.font='900 24px Arial Black';x.fillText(state==='dead'?'GAME OVER':'PIXEL TETRIS',W/2,H/2);x.fillStyle='#fff';x.font='700 12px Arial';x.fillText('TAP TO PLAY',W/2,H/2+24);x.textAlign='left'}}
document.getElementById('L').onclick=()=>{if(state==='ready'||state==='dead')return reset();if(!hit(-1,0,cur))nx--};
document.getElementById('R').onclick=()=>{if(state==='ready'||state==='dead')return reset();if(!hit(1,0,cur))nx++};
document.getElementById('ROT').onclick=()=>{if(state==='ready'||state==='dead')return reset();const n=rotate(cur);if(!hit(0,0,n))cur=n};
cv.onclick=()=>{if(state!=='play')reset();else if(!hit(0,1,cur))ny++};
setInterval(()=>{if(state==='play')tick();draw()},420);draw();
`);
  await sendHtmlGame(conn, from, html, 'PIXEL TETRIS', [m.sender]);
});

cmd({
  pattern: 'pong',
  alias: ['tabletennis', 'pingpong'],
  react: '🏓',
  desc: 'Neon pong vs CPU',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  global.plusLimit = global.plusLimit || {};
  const w = cool(global.plusLimit, from + 'pong', 8000);
  if (w) return reply(`Wait ${w}s`);
  const html = shell('NEON PONG', '#ffd75e',
    '<div class="pads"><button class="pd" id="U">▲</button><button class="pd" id="S">SERVE</button><button class="pd" id="D">▼</button></div><div class="hint">Drag on court or use pads • first to 7</div>',
    'canvas{aspect-ratio:404/520}',
    '<canvas id="cv" width="404" height="520"></canvas>',
    `
const cv=document.getElementById('cv'),x=cv.getContext('2d'),W=404,H=520,DPR=2;cv.width=W*DPR;cv.height=H*DPR;
let py=H/2,cy=H/2,bx=W/2,by=H/2,vx=4,vy=2.4,ps=0,cs=0,state='ready',hold=0;
function serve(){bx=W/2;by=H/2;vx=(Math.random()<.5?-1:1)*4;vy=(Math.random()*4-2);state='play'}
function draw(){x.setTransform(DPR,0,0,DPR,0,0);x.fillStyle='#071428';x.fillRect(0,0,W,H);
x.strokeStyle='#ffd75e55';x.setLineDash([8,10]);x.beginPath();x.moveTo(W/2,0);x.lineTo(W/2,H);x.stroke();x.setLineDash([]);
x.fillStyle='#58c7ff';x.fillRect(18,py-36,8,72);x.fillStyle='#ff5a5a';x.fillRect(W-26,cy-36,8,72);
x.fillStyle='#fff';x.beginPath();x.arc(bx,by,7,0,7);x.fill();
x.font='900 28px Arial';x.fillStyle='#fff';x.fillText(ps,W/2-48,40);x.fillText(cs,W/2+28,40);
if(state!=='play'){x.textAlign='center';x.fillStyle='#ffd75e';x.font='900 22px Arial Black';x.fillText(state==='over'?(ps>cs?'YOU WIN':'CPU WINS'):'NEON PONG',W/2,H/2);x.fillStyle='#fff';x.font='12px Arial';x.fillText('TAP SERVE',W/2,H/2+24);x.textAlign='left'}}
function loop(){if(state==='play'){if(hold===-1)py-=7;if(hold===1)py+=7;py=Math.max(36,Math.min(H-36,py));
cy+=(by-cy)*0.09;bx+=vx;by+=vy;if(by<8||by>H-8)vy*=-1;
if(bx<30&&Math.abs(by-py)<40){vx=Math.abs(vx)+0.3;vy+=(by-py)*0.08} 
if(bx>W-30&&Math.abs(by-cy)<40){vx=-Math.abs(vx)-0.3;vy+=(by-cy)*0.08}
if(bx<0){cs++;state=cs>=7?'over':'ready';document.getElementById('sc').textContent=ps+'-'+cs}
if(bx>W){ps++;state=ps>=7?'over':'ready';document.getElementById('sc').textContent=ps+'-'+cs}}
draw();requestAnimationFrame(loop)}loop();
document.getElementById('U').onpointerdown=()=>hold=-1;document.getElementById('D').onpointerdown=()=>hold=1;
document.getElementById('U').onpointerup=()=>hold=0;document.getElementById('D').onpointerup=()=>hold=0;
document.getElementById('S').onclick=()=>{if(state!=='play'){if(state==='over'){ps=cs=0}serve()}};
cv.onpointermove=e=>{const r=cv.getBoundingClientRect();py=(e.clientY-r.top)/r.height*H};
`);
  await sendHtmlGame(conn, from, html, 'NEON PONG', [m.sender]);
});

cmd({
  pattern: 'breakout',
  alias: ['bricks', 'ark'],
  react: '🟪',
  desc: '3D brick breaker',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  global.plusLimit = global.plusLimit || {};
  const w = cool(global.plusLimit, from + 'breakout', 8000);
  if (w) return reply(`Wait ${w}s`);
  const html = shell('BRICK BREAKER', '#ff6aff',
    '<div class="pads"><button class="pd" id="L">◀</button><button class="pd" id="GO">LAUNCH</button><button class="pd" id="R">▶</button></div><div class="hint">Move paddle • smash every brick</div>',
    'canvas{aspect-ratio:404/540}',
    '<canvas id="cv" width="404" height="540"></canvas>',
    `
const cv=document.getElementById('cv'),x=cv.getContext('2d'),W=404,H=540,DPR=2;cv.width=W*DPR;cv.height=H*DPR;
let px=W/2,bx,by,vx,vy,bricks=[],score=0,state='ready',hold=0,BEST=0;
try{BEST=+localStorage.getItem('brk_best')||0}catch(e){} document.getElementById('bs').textContent=BEST;
function reset(){px=W/2;bx=W/2;by=H-70;vx=3.2;vy=-4.4;score=0;bricks=[];state='ready';
for(let r=0;r<5;r++)for(let c=0;c<8;c++)bricks.push({x:18+c*48,y:40+r*28,w:44,h:22,hp:3-Math.floor(r/2),c:['#ff5a5a','#ffd75e','#58c7ff','#a8ff60','#ff6aff'][r]});
document.getElementById('sc').textContent='0'}
reset();
function loop(){if(hold)px+=hold*8;px=Math.max(40,Math.min(W-40,px));
if(state==='play'){bx+=vx;by+=vy;if(bx<8||bx>W-8)vx*=-1;if(by<8)vy*=-1;
if(by>H-28&&Math.abs(bx-px)<46){vy=-Math.abs(vy);vx+=(bx-px)*0.12}
if(by>H){state='dead';if(score>BEST){BEST=score;try{localStorage.setItem('brk_best',BEST)}catch(e){}document.getElementById('bs').textContent=BEST}}
bricks.forEach(b=>{if(b.hp&&bx>b.x&&bx<b.x+b.w&&by>b.y&&by<b.y+b.h){b.hp--;vy*=-1;score+=10;document.getElementById('sc').textContent=score}});
if(bricks.every(b=>!b.hp))state='win'}
x.setTransform(DPR,0,0,DPR,0,0);x.fillStyle='#12081c';x.fillRect(0,0,W,H);
bricks.forEach(b=>{if(!b.hp)return;x.fillStyle=b.c;x.fillRect(b.x,b.y,b.w,b.h);x.fillStyle='rgba(255,255,255,.2)';x.fillRect(b.x,b.y,b.w,6)});
x.fillStyle='#fff';x.fillRect(px-40,H-22,80,10);x.beginPath();x.arc(bx,by,7,0,7);x.fill();
if(state!=='play'){x.fillStyle='rgba(0,0,0,.5)';x.fillRect(0,0,W,H);x.textAlign='center';x.fillStyle='#ff6aff';x.font='900 22px Arial Black';x.fillText(state==='win'?'CLEARED':state==='dead'?'DROPPED':'BRICK BREAKER',W/2,H/2);x.fillStyle='#fff';x.font='12px Arial';x.fillText('TAP LAUNCH',W/2,H/2+24);x.textAlign='left'}
requestAnimationFrame(loop)}loop();
document.getElementById('L').onpointerdown=()=>hold=-1;document.getElementById('R').onpointerdown=()=>hold=1;
document.getElementById('L').onpointerup=()=>hold=0;document.getElementById('R').onpointerup=()=>hold=0;
document.getElementById('GO').onclick=()=>{if(state!=='play'){if(state!=='ready')reset();state='play'}};
cv.onpointermove=e=>{const r=cv.getBoundingClientRect();px=(e.clientX-r.left)/r.width*W};
`);
  await sendHtmlGame(conn, from, html, 'BRICK BREAKER', [m.sender]);
});

cmd({
  pattern: 'stacker',
  alias: ['stack', 'tower', 'blocks3d'],
  react: '🏗️',
  desc: '3D tower stack',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  global.plusLimit = global.plusLimit || {};
  const w = cool(global.plusLimit, from + 'stacker', 8000);
  if (w) return reply(`Wait ${w}s`);
  const html = shell('TOWER STACK 3D', '#ff9a3c',
    '<div class="pads"><button class="pd" id="DROP" style="grid-column:span 3;background:linear-gradient(#ffd75e,#e09406);color:#3a2805">DROP BLOCK</button></div><div class="hint">Tap when aligned • perfect stacks grow combo</div>',
    'canvas{aspect-ratio:404/560}.pads{grid-template-columns:1fr}',
    '<canvas id="cv" width="404" height="560"></canvas>',
    `
const cv=document.getElementById('cv'),x=cv.getContext('2d'),W=404,H=560,DPR=2;cv.width=W*DPR;cv.height=H*DPR;
let layers=[],cur,dir=1,speed=2.4,score=0,state='ready',BEST=0,cam=0;
try{BEST=+localStorage.getItem('stk_best')||0}catch(e){} document.getElementById('bs').textContent=BEST;
function iso(px,py,pz){return {x:W/2+(px-pz)*0.86,y:420-cam+(px+pz)*0.5-py}}
function reset(){layers=[{x:0,z:0,w:90,d:90,y:0,c:'#58c7ff'}];cur={x:-120,z:0,w:90,d:90,y:18,axis:'x'};dir=1;speed=2.4;score=0;cam=0;state='play';document.getElementById('sc').textContent='0'}
function drop(){if(state!=='play'){reset();return}const last=layers[layers.length-1];
let nx=cur.x,nz=cur.z,nw=cur.w,nd=cur.d;
if(cur.axis==='x'){const o=cur.x-last.x;if(Math.abs(o)>last.w){state='dead';return}nw=last.w-Math.abs(o);nx=last.x+o/2} 
else {const o=cur.z-last.z;if(Math.abs(o)>last.d){state='dead';return}nd=last.d-Math.abs(o);nz=last.z+o/2}
layers.push({x:nx,z:nz,w:nw,d:nd,y:layers.length*18,c:['#58c7ff','#ffd75e','#ff6aff','#a8ff60'][layers.length%4]});
score++;document.getElementById('sc').textContent=score;if(score>BEST){BEST=score;try{localStorage.setItem('stk_best',BEST)}catch(e){}document.getElementById('bs').textContent=BEST}
cur={x:cur.axis==='x'?nx:-140,z:cur.axis==='x'?-140:nz,w:nw,d:nd,y:(layers.length)*18,axis:cur.axis==='x'?'z':'x'};dir=1;speed=Math.min(5.2,2.4+score*0.08);cam=Math.max(0,score*10)}
function loop(){if(state==='play'){if(cur.axis==='x'){cur.x+=dir*speed;if(cur.x>140||cur.x<-140)dir*=-1}else{cur.z+=dir*speed;if(cur.z>140||cur.z<-140)dir*=-1}}
x.setTransform(DPR,0,0,DPR,0,0);const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1a1030');g.addColorStop(1,'#050510');x.fillStyle=g;x.fillRect(0,0,W,H);
function block(b,alpha){const p=[[b.x-b.w/2,b.y,b.z-b.d/2],[b.x+b.w/2,b.y,b.z-b.d/2],[b.x+b.w/2,b.y,b.z+b.d/2],[b.x-b.w/2,b.y,b.z+b.d/2]].map(v=>iso(v[0],v[1],v[2]));
x.globalAlpha=alpha||1;x.fillStyle=b.c;x.beginPath();x.moveTo(p[0].x,p[0].y);p.slice(1).forEach(q=>x.lineTo(q.x,q.y));x.closePath();x.fill();
const top=[[b.x-b.w/2,b.y+16,b.z-b.d/2],[b.x+b.w/2,b.y+16,b.z-b.d/2],[b.x+b.w/2,b.y+16,b.z+b.d/2],[b.x-b.w/2,b.y+16,b.z+b.d/2]].map(v=>iso(v[0],v[1],v[2]));
x.fillStyle='rgba(255,255,255,.18)';x.beginPath();x.moveTo(top[0].x,top[0].y);top.slice(1).forEach(q=>x.lineTo(q.x,q.y));x.closePath();x.fill();x.globalAlpha=1}
layers.forEach(b=>block(b,1));if(state==='play')block(cur,.85);
if(state!=='play'){x.textAlign='center';x.fillStyle='#ff9a3c';x.font='900 24px Arial Black';x.fillText(state==='dead'?'TOWER FELL':'TOWER STACK',W/2,80);x.fillStyle='#fff';x.font='12px Arial';x.fillText('TAP TO BUILD',W/2,104);x.textAlign='left'}
requestAnimationFrame(loop)}loop();
document.getElementById('DROP').onclick=drop;cv.onclick=drop;
`);
  await sendHtmlGame(conn, from, html, 'TOWER STACK 3D', [m.sender]);
});

cmd({
  pattern: 'balloon',
  alias: ['pop', 'balloonpop'],
  react: '🎈',
  desc: '3D balloon pop',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  global.plusLimit = global.plusLimit || {};
  const w = cool(global.plusLimit, from + 'balloon', 8000);
  if (w) return reply(`Wait ${w}s`);
  const html = shell('BALLOON POP 3D', '#ff5a8a',
    '<div class="hint">Tap balloons • bombs cost a life • 3 lives</div>',
    'canvas{aspect-ratio:404/560}',
    '<canvas id="cv" width="404" height="560"></canvas>',
    `
const cv=document.getElementById('cv'),x=cv.getContext('2d'),W=404,H=560,DPR=2;cv.width=W*DPR;cv.height=H*DPR;
let balls=[],score=0,lives=3,state='ready',t=0,BEST=0;
try{BEST=+localStorage.getItem('bal_best')||0}catch(e){} document.getElementById('bs').textContent=BEST;
function spawn(){balls.push({x:40+Math.random()*(W-80),y:H+20,z:.4+Math.random()*.8,vy:1.4+Math.random()*1.6,c:['#ff5a8a','#58c7ff','#ffd75e','#a8ff60','#ff9a3c'][Math.floor(Math.random()*5)],bomb:Math.random()<.12,r:18})}
function reset(){balls=[];score=0;lives=3;t=0;state='play';document.getElementById('sc').textContent='0'}
function loop(){t++;if(state==='play'&&t%28===0)spawn();
x.setTransform(DPR,0,0,DPR,0,0);const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#87c8ff');g.addColorStop(1,'#e8f4ff');x.fillStyle=g;x.fillRect(0,0,W,H);
if(state==='play')balls.forEach(b=>{b.y-=b.vy*b.z;b.x+=Math.sin(t/12+b.x)*0.4});
balls=balls.filter(b=>b.y>-40);
balls.forEach(b=>{const s=22*b.z;x.fillStyle=b.bomb?'#222':'b.c'.length?b.c:'#ff5a8a';x.fillStyle=b.bomb?'#222':b.c;x.beginPath();x.ellipse(b.x,b.y,s*.8,s,0,0,7);x.fill();
x.fillStyle='rgba(255,255,255,.45)';x.beginPath();x.ellipse(b.x-s*.25,b.y-s*.3,s*.18,s*.28,0,0,7);x.fill();
x.strokeStyle='#3a2a12';x.beginPath();x.moveTo(b.x,b.y+s);x.quadraticCurveTo(b.x+6,b.y+s+10,b.x,b.y+s+18);x.stroke()});
x.fillStyle='#111';x.font='700 12px Arial';x.fillText('LIVES '+lives,12,24);
if(state!=='play'){x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,0,W,H);x.textAlign='center';x.fillStyle='#ff5a8a';x.font='900 24px Arial Black';x.fillText(state==='dead'?'POPPED OUT':'BALLOON POP',W/2,H/2);x.fillStyle='#fff';x.font='12px Arial';x.fillText('TAP TO PLAY',W/2,H/2+24);x.textAlign='left'}
requestAnimationFrame(loop)}loop();
cv.onclick=e=>{if(state!=='play'){reset();return}const r=cv.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W,py=(e.clientY-r.top)/r.height*H;
for(let i=balls.length-1;i>=0;i--){const b=balls[i],s=22*b.z;if(Math.hypot(px-b.x,py-b.y)<s+6){balls.splice(i,1);if(b.bomb){lives--;if(lives<=0){state='dead';if(score>BEST){BEST=score;try{localStorage.setItem('bal_best',BEST)}catch(er){}document.getElementById('bs').textContent=BEST}}}else{score+=Math.round(10*b.z);document.getElementById('sc').textContent=score}}break;}};
`);
  await sendHtmlGame(conn, from, html, 'BALLOON POP 3D', [m.sender]);
});

cmd({
  pattern: 'asteroid',
  alias: ['asteroids', 'spacewar'],
  react: '☄️',
  desc: 'Asteroid field shooter',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  global.plusLimit = global.plusLimit || {};
  const w = cool(global.plusLimit, from + 'asteroid', 8000);
  if (w) return reply(`Wait ${w}s`);
  const html = shell('ASTEROID FIELD', '#c0d4ff',
    '<div class="pads"><button class="pd" id="L">◀</button><button class="pd" id="FIRE">FIRE</button><button class="pd" id="R">▶</button></div><div class="hint">Turn • fire crystals • dodge rocks</div>',
    'canvas{aspect-ratio:404/540}',
    '<canvas id="cv" width="404" height="540"></canvas>',
    `
const cv=document.getElementById('cv'),x=cv.getContext('2d'),W=404,H=540,DPR=2;cv.width=W*DPR;cv.height=H*DPR;
let ang=-Math.PI/2,px=W/2,py=H/2,rocks=[],shots=[],score=0,state='ready',hold=0,BEST=0;
try{BEST=+localStorage.getItem('ast_best')||0}catch(e){} document.getElementById('bs').textContent=BEST;
function rock(){rocks.push({x:Math.random()*W,y:Math.random()*H,r:14+Math.random()*18,vx:(Math.random()-.5)*1.6,vy:(Math.random()-.5)*1.6})}
function reset(){px=W/2;py=H/2;ang=-Math.PI/2;rocks=[];shots=[];score=0;for(let i=0;i<7;i++)rock();state='play';document.getElementById('sc').textContent='0'}
function loop(){if(state==='play'){ang+=hold*0.08;px+=Math.cos(ang)*2.2;py+=Math.sin(ang)*2.2;if(px<0)px=W;if(px>W)px=0;if(py<0)py=H;if(py>H)py=0;
shots.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.life--});shots=shots.filter(s=>s.life>0);
rocks.forEach(r=>{r.x+=r.vx;r.y+=r.vy;if(r.x<0)r.x=W;if(r.x>W)r.x=0;if(r.y<0)r.y=H;if(r.y>H)r.y=0;
if(Math.hypot(r.x-px,r.y-py)<r.r+8){state='dead';if(score>BEST){BEST=score;try{localStorage.setItem('ast_best',BEST)}catch(e){}document.getElementById('bs').textContent=BEST}}
shots.forEach(s=>{if(Math.hypot(s.x-r.x,s.y-r.y)<r.r){r.hit=1;s.life=0;score+=15;document.getElementById('sc').textContent=score}})});
rocks=rocks.filter(r=>!r.hit);if(rocks.length<6)rock()}
x.setTransform(DPR,0,0,DPR,0,0);x.fillStyle='#050814';x.fillRect(0,0,W,H);
x.fillStyle='#fff';for(let i=0;i<40;i++)x.fillRect((i*37)%W,(i*53)%H,2,2);
x.strokeStyle='#c0d4ff';rocks.forEach(r=>{x.beginPath();x.arc(r.x,r.y,r.r,0,7);x.stroke()});
x.fillStyle='#ffd75e';shots.forEach(s=>{x.fillRect(s.x-2,s.y-2,4,4)});
x.save();x.translate(px,py);x.rotate(ang);x.fillStyle='#58c7ff';x.beginPath();x.moveTo(14,0);x.lineTo(-10,8);x.lineTo(-6,0);x.lineTo(-10,-8);x.closePath();x.fill();x.restore();
if(state!=='play'){x.textAlign='center';x.fillStyle='#c0d4ff';x.font='900 22px Arial Black';x.fillText(state==='dead'?'SHIP DOWN':'ASTEROID FIELD',W/2,H/2);x.fillStyle='#fff';x.font='12px Arial';x.fillText('TAP FIRE TO START',W/2,H/2+24);x.textAlign='left'}
requestAnimationFrame(loop)}loop();
function fire(){if(state!=='play'){reset();return}shots.push({x:px,y:py,vx:Math.cos(ang)*7,vy:Math.sin(ang)*7,life:40})}
document.getElementById('L').onpointerdown=()=>hold=-1;document.getElementById('R').onpointerdown=()=>hold=1;
document.getElementById('L').onpointerup=()=>hold=0;document.getElementById('R').onpointerup=()=>hold=0;
document.getElementById('FIRE').onclick=fire;cv.onclick=fire;
`);
  await sendHtmlGame(conn, from, html, 'ASTEROID FIELD', [m.sender]);
});

cmd({
  pattern: 'games',
  alias: ['arcade', 'gamelist', 'playgames'],
  react: '🎮',
  desc: 'List playable arcade games',
  category: 'games',
  filename: __filename
}, async (conn, mek, m, { reply, prefix }) => {
  const p = prefix || '.';
  reply(
    `*MONA LISA ARCADE*\n\n` +
    `${p}sonic  ${p}flappy  ${p}ninja\n` +
    `${p}ludo  ${p}fruit  ${p}shooter\n` +
    `${p}dino  ${p}penalty  ${p}drift\n` +
    `${p}snake  ${p}carrace  ${p}tetris\n` +
    `${p}pong  ${p}breakout  ${p}stacker\n` +
    `${p}balloon  ${p}asteroid\n\n` +
    `Tap the canvas. Games open in-chat.\nPowered by Progress Tech`
  );
});
