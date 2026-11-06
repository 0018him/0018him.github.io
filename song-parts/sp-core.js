/* song-parts — 核心:常數、儲存、IndexedDB、主題、共用函數 */
/* ================= constants ================= */
const PALETTE = [
  '#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#3949ab','#8e24aa',
  '#ef9a9a','#ffcc80','#fff59d','#a5d6a7','#90caf9','#9fa8da','#ce93d8',
  '#111111','#ffffff'
];
const MIN_N=2, MAX_N=7, COLS=7, ROWS=7;
const TV_ROW_H=26, TV_GAP=2;
function lum(hex){
  const n=parseInt(hex.slice(1),16);
  return (0.299*((n>>16)&255)+0.587*((n>>8)&255)+0.114*(n&255))/255;
}
/* 時間一律向下取整到 0.1 秒:確保指令即時生效(修正「拖了但唔郁」bug) */
const nowT = ()=> Math.floor((media.currentTime||0)*10)/10;

/* ================= storage ================= */
function safeGet(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function safeSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ alert('儲存空間不足,部分內容可能未能保存。可刪除舊歌曲或背景圖騰出空間。'); } }

let data = safeGet('lineDist2') || {
  members: Array.from({length:7},(_,i)=>({name:`成員 ${i+1}`,img:null,color:PALETTE[i%14]})),
  segments: [], theme:{bg:'#1b1d22',img:null}
};
/* 圖片(成員照+背景)另存一個鍵,只在圖片真正改變時才寫入;
   舊版把圖片內嵌在 lineDist2,載入時照樣讀得到 */
(function mergeImages(){
  const im=safeGet('lineDist2img');
  if(!im) return;
  (data.members||[]).forEach((m,i)=>{ if(im.members && im.members[i]!==undefined) m.img=im.members[i]; });
  data.theme=data.theme||{bg:'#1b1d22',img:null};
  if(im.bg!==undefined) data.theme.img=im.bg;
})();
function normalizeData(d){
  d.formations = (d.formations||[]).map(f=>
    f.col!=null ? f : {t:f.t, m:f.m, col:f.slot??0, row:ROWS-1});
  d.segments = (d.segments||[]).map(g=>({lyric:'',...g}));
  d.theme = d.theme||{bg:'#1b1d22',img:null};
  if(d.rankMode===undefined) d.rankMode=true;
  d.members = (d.members||[]).slice(0,MAX_N);
  d.members.forEach((m,i)=>{ m.color = m.color||PALETTE[i%14]; });
  d.segments = d.segments.filter(g=>g.m<d.members.length);
  d.formations = d.formations.filter(f=>f.m<d.members.length);
  fixOrder(d);
  return d;
}
/* 歌詞分配頁的成員顯示次序(只影響頭像、bar、選單排列;不改成員編號,站位動線不受影響) */
function fixOrder(d){
  const n=d.members.length;
  const seen=new Set();
  d.order=(Array.isArray(d.order)?d.order:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<n&&!seen.has(i)&&seen.add(i));
  for(let i=0;i<n;i++) if(!seen.has(i)) d.order.push(i);
  return d.order;
}
normalizeData(data);

let lib = safeGet('lineDistLib1') || { songs: [] };
lib.playlist = lib.playlist || { ids:[], mode:'single-stop' };
lib.playlist.ids = lib.playlist.ids.filter(id=>lib.songs.some(s=>s.id===id));

/* ---- 復原/重做(上限 50 步;只記錄編輯內容,不含外觀與歌曲庫) ---- */
const HIST_MAX=50;
let hist=[], histI=-1, histMute=false;
function cloneState(){
  return {
    members:data.members.map(m=>({name:m.name,color:m.color,img:m.img})),
    segments:data.segments.map(g=>({...g})),
    formations:data.formations.map(f=>({...f})),
    order:data.order.slice()
  };
}
function stateKey(st){
  return JSON.stringify({
    m:st.members.map(x=>[x.name,x.color,x.img?x.img.length:0]),
    s:st.segments, f:st.formations, o:st.order });
}
function recordHistory(){
  const st=cloneState(), key=stateKey(st);
  if(histI>=0 && stateKey(hist[histI])===key) return;
  hist=hist.slice(0,histI+1);
  hist.push(st);
  if(hist.length>HIST_MAX) hist.shift();
  histI=hist.length-1;
  updateUndoBtns();
}
function applyState(st){
  data.members=st.members.map(m=>({...m}));
  data.segments=st.segments.map(g=>({...g}));
  data.formations=st.formations.map(f=>({...f}));
  data.order=(st.order||[]).slice(); fixOrder(data);
  histMute=true; persist(); histMute=false;
  renderAll(); renderTicks(); forceRefreshPositions();
  updateUndoBtns();
}
function undo(){ if(histI>0){ histI--; applyState(hist[histI]); } }
function redo(){ if(histI<hist.length-1){ histI++; applyState(hist[histI]); } }
function updateUndoBtns(){
  const u=document.getElementById('undoBtn'), r=document.getElementById('redoBtn');
  if(u) u.disabled = histI<=0;
  if(r) r.disabled = histI>=hist.length-1;
}
/* 儲存:歷史即時記錄;寫入 localStorage 延後合併執行,讓按鈕先反應 */
let saveTimer=null, lastImgSig=null;
const imgSig = s => s ? s.length+':'+s.slice(-24) : '';
function writeNow(){
  clearTimeout(saveTimer); saveTimer=null;
  const slim={...data,
    members:data.members.map(m=>({name:m.name,color:m.color})),
    theme:{...data.theme, img:null}};
  safeSet('lineDist2', slim);
  const sig=data.members.map(m=>imgSig(m.img)).join('|')+'#'+imgSig(data.theme.img);
  if(sig!==lastImgSig){
    safeSet('lineDist2img', {members:data.members.map(m=>m.img||null), bg:data.theme.img||null});
    lastImgSig=sig;
  }
}
function persist(){
  if(!histMute) recordHistory();
  clearTimeout(saveTimer);
  saveTimer=setTimeout(writeNow, 300);
}
/* 離開或切到背景前立即寫入,避免遺失最後的修改 */
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden' && saveTimer) writeNow(); });
window.addEventListener('pagehide',()=>{ if(saveTimer) writeNow(); });
function persistLib(){ safeSet('lineDistLib1', lib); }
const N = ()=> data.members.length;

/* IndexedDB:音檔儲存 */
const idb = {
  db:null,
  open(){ return new Promise((res,rej)=>{
    if(this.db) return res(this.db);
    const r=indexedDB.open('songPartsAudio',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('audio');
    r.onsuccess=()=>{ this.db=r.result; res(this.db); };
    r.onerror=()=>rej(r.error);
  });},
  async put(k,v){ const db=await this.open(); return new Promise((res,rej)=>{
    const tx=db.transaction('audio','readwrite');
    tx.objectStore('audio').put(v,k);
    tx.oncomplete=res; tx.onerror=()=>rej(tx.error);
    tx.onabort=()=>rej(tx.error||new Error('transaction aborted')); });},
  async get(k){ const db=await this.open(); return new Promise((res,rej)=>{
    const rq=db.transaction('audio').objectStore('audio').get(k);
    rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>rej(rq.error); });},
  async del(k){ const db=await this.open(); return new Promise((res,rej)=>{
    const tx=db.transaction('audio','readwrite');
    tx.objectStore('audio').delete(k);
    tx.oncomplete=res; tx.onerror=()=>rej(tx.error); });}
};
/* 音檔存取:改存 ArrayBuffer,避開 iOS WebKit「Error preparing Blob/File」問題
   (無痕/私密瀏覽最常觸發;舊版以 Blob 存的資料照樣讀得返) */
const AUDIO_TYPES={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',
  ogg:'audio/ogg',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
function guessType(blob,name){
  if(blob && blob.type) return blob.type;
  const ext=String(name||'').split('.').pop().toLowerCase();
  return AUDIO_TYPES[ext]||'';
}
async function saveAudio(key, blob, name){
  const buf=await blob.arrayBuffer();          /* 讀檔失敗(如 iCloud 檔未下載)會在此拋錯 */
  await idb.put(key, {buf, type:guessType(blob,name), name:name||''});
}
async function loadAudio(key){
  const v=await idb.get(key);
  if(!v) return null;
  if(v instanceof Blob) return v;
  if(v.buf) return new Blob([v.buf], {type:v.type||''});
  return null;
}
function audioSaveErrorMsg(e){
  const n=(e&&e.name)||'';
  if(n==='QuotaExceededError') return '音檔儲存失敗:裝置儲存空間不足。標註已保存。';
  if(n==='NotReadableError'||n==='NotFoundError')
    return '音檔儲存失敗:無法讀取原檔(若檔案在 iCloud,請先在「檔案」App 下載到本機再選擇)。標註已保存。';
  return `音檔儲存失敗(${n||'未知錯誤'})。如正使用無痕/私密瀏覽,請改用一般模式。標註已保存。`;
}
/* 要求持久儲存,降低 iOS 自動清理風險 */
if(navigator.storage && navigator.storage.persist) navigator.storage.persist();

/* ================= theme ================= */
function applyTheme(){
  const t=data.theme, root=document.documentElement.style;
  const blur=document.querySelector('#bgLayer .bgblur');
  const fit=document.querySelector('#bgLayer .bgfit');
  if(t.img){
    blur.style.backgroundImage=`url('${t.img}')`;
    fit.style.backgroundImage=`url('${t.img}')`;
    document.body.style.backgroundColor='#101115';
    document.body.classList.add('has-bgimg');
    root.setProperty('--text','#e8e6e1'); root.setProperty('--muted','#a9acb4');
    root.setProperty('--panel','rgba(24,25,30,.78)'); root.setProperty('--line','rgba(255,255,255,.18)');
    root.setProperty('--bg','#1b1d22');
  } else {
    document.body.classList.remove('has-bgimg');
    const c=t.bg||'#1b1d22';
    document.body.style.backgroundColor=c;
    root.setProperty('--bg',c);
    if(lum(c)>0.55){
      root.setProperty('--text','#1c1d21'); root.setProperty('--muted','#585b63');
      root.setProperty('--panel','rgba(255,255,255,.55)'); root.setProperty('--line','rgba(0,0,0,.22)');
    } else {
      root.setProperty('--text','#e8e6e1'); root.setProperty('--muted','#8b8e97');
      root.setProperty('--panel','rgba(255,255,255,.06)'); root.setProperty('--line','rgba(255,255,255,.16)');
    }
  }
}

/* ================= helpers ================= */
const p = n => String(n).padStart(2,'0');
const fmtT = s => `${p(Math.floor(s/60))}:${p(Math.floor(s%60))}.${Math.floor(s*10%10)}`;
const fmtD = s => `${p(Math.floor(s/60))}:${p(Math.floor(s%60))}`;
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function parseT(str){
  const m=String(str).trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if(!m) return null;
  return (+(m[1]||0))*60+(+m[2]);
}
function sungUpTo(mi,t){
  let s=0;
  for(const g of data.segments){ if(g.m===mi) s+=Math.max(0,Math.min(g.e,t)-g.s); }
  return s;
}
const totalOf = mi => sungUpTo(mi,Infinity);
const isActive = (mi,t)=> data.segments.some(g=>g.m===mi && t>=g.s && t<g.e);
function posOf(mi,t){
  let col=Math.min(mi,COLS-1), row=ROWS-1, kt=-1;
  for(const f of data.formations){
    if(f.m===mi && f.t<=t && f.t>kt){ col=f.col; row=f.row; kt=f.t; }
  }
  return {col,row,kt};
}

function makeInput(accept,onFile){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept=accept; inp.style.display='none';
  document.body.appendChild(inp);
  inp.addEventListener('change',()=>{ if(inp.files[0]) onFile(inp.files[0]); });
  return inp;
}

/* ================= 通用圖片剪裁 ================= */
const cropOverlay=document.getElementById('cropOverlay');
const cropFrame=document.getElementById('cropFrame');
const cropImgEl=document.getElementById('cropImg');
const cropZoom=document.getElementById('cropZoom');
let crop=null;
function openCrop(file, ratio, outLong, cb, quality){
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    const maxW=Math.min(320, window.innerWidth*0.94-40);
    const maxH=Math.min(380, window.innerHeight*0.55);
    let FW,FH;
    if(maxW/ratio<=maxH){ FW=maxW; FH=maxW/ratio; } else { FH=maxH; FW=maxH*ratio; }
    cropFrame.style.width=FW+'px'; cropFrame.style.height=FH+'px';
    cropOverlay.classList.add('open');
    const min=Math.max(FW/img.width, FH/img.height);
    crop={img,url,cb,ratio,outLong,FW,FH,min,scale:min,quality:quality||.8,
      x:(FW-img.width*min)/2, y:(FH-img.height*min)/2};
    cropImgEl.src=url;
    cropZoom.min=min; cropZoom.max=min*4; cropZoom.step=min/100; cropZoom.value=min;
    applyCropView();
  };
  img.src=url;
}
function clampCropView(){
  crop.x=Math.min(0, Math.max(crop.FW-crop.img.width*crop.scale, crop.x));
  crop.y=Math.min(0, Math.max(crop.FH-crop.img.height*crop.scale, crop.y));
}
function applyCropView(){
  clampCropView();
  cropImgEl.style.width=crop.img.width+'px';
  cropImgEl.style.transform=`translate(${crop.x}px,${crop.y}px) scale(${crop.scale})`;
}
cropZoom.addEventListener('input',()=>{
  if(!crop) return;
  const ns=+cropZoom.value;
  const cx=(crop.FW/2-crop.x)/crop.scale, cy=(crop.FH/2-crop.y)/crop.scale;
  crop.scale=ns;
  crop.x=crop.FW/2-cx*ns; crop.y=crop.FH/2-cy*ns;
  applyCropView();
});
let cropPan=null;
cropFrame.addEventListener('pointerdown',e=>{
  cropPan={x:e.clientX,y:e.clientY};
  cropFrame.setPointerCapture(e.pointerId);
});
cropFrame.addEventListener('pointermove',e=>{
  if(!cropPan||!crop) return;
  crop.x+=e.clientX-cropPan.x; crop.y+=e.clientY-cropPan.y;
  cropPan={x:e.clientX,y:e.clientY};
  applyCropView();
});
cropFrame.addEventListener('pointerup',()=>cropPan=null);
cropFrame.addEventListener('pointercancel',()=>cropPan=null);
function closeCrop(){
  cropOverlay.classList.remove('open');
  if(crop){ URL.revokeObjectURL(crop.url); crop=null; }
}
document.getElementById('cropCancel').onclick=closeCrop;
document.getElementById('cropOk').onclick=()=>{
  if(!crop) return;
  const r=crop.ratio;
  const outW=r>=1?crop.outLong:Math.round(crop.outLong*r);
  const outH=r>=1?Math.round(crop.outLong/r):crop.outLong;
  const cv=document.createElement('canvas');
  cv.width=outW; cv.height=outH;
  const sx=-crop.x/crop.scale, sy=-crop.y/crop.scale;
  const sw=crop.FW/crop.scale, sh=crop.FH/crop.scale;
  cv.getContext('2d').drawImage(crop.img,sx,sy,sw,sh,0,0,outW,outH);
  const out=cv.toDataURL('image/jpeg',crop.quality);
  const cb=crop.cb;
  closeCrop();
  cb(out);
};
