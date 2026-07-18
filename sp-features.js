/* song-parts — 功能:儲存庫、播放清單、匯出匯入、表演模式、結算、複製、初始化 */
/* ================= song library ================= */
const songList=document.getElementById('songList');
function snapshot(){
  return JSON.parse(JSON.stringify({
    members:data.members, segments:data.segments, formations:data.formations
  }));
}
document.getElementById('saveNewBtn').onclick=async ()=>{
  const id=Date.now();
  lib.songs.push({ id, name:`歌曲 ${lib.songs.length+1}`, snap:snapshot() });
  persistLib(); renderSongs(); renderPlaylist();
  if(curBlob){ try{ await idb.put(id, curBlob); }catch(e){ alert('音檔儲存失敗(裝置空間不足?),標註已保存。'); } }
};
async function loadSong(id, autoplay){
  const s=lib.songs.find(x=>x.id===id); if(!s) return false;
  const sn=normalizeData(JSON.parse(JSON.stringify(s.snap)));
  data.members=sn.members; data.segments=sn.segments; data.formations=sn.formations;
  data.theme=data.theme;   /* 外觀為全域設定,不隨歌曲切換 */
  persist(); renderAll();
  try{
    const blob=await idb.get(id);
    if(blob){ setMediaBlob(blob, s.name+'(儲存庫音檔)', autoplay); return true; }
  }catch(e){}
  document.getElementById('fileHint').textContent=
    `已載入「${s.name}」的標註,但此歌曲沒有儲存音檔,請手動選擇音樂檔。`;
  return false;
}
function renderSongs(){
  songList.innerHTML = lib.songs.length? '' :
    '<div class="hint" style="margin:0">尚未有已儲存的歌曲。</div>';
  lib.songs.forEach((s,si)=>{
    const d=document.createElement('div');
    d.className='songrow';
    d.innerHTML=`
      <span class="songname">${esc(s.name)}</span>
      <button class="tbtn" data-f="load">載入</button>
      <button class="tbtn" data-f="save">覆蓋儲存</button>
      <button class="tbtn" data-f="ren">改名</button>
      <button class="tbtn" data-f="del">刪除</button>`;
    d.querySelector('[data-f=load]').onclick=()=>{
      if(!confirm(`載入「${s.name}」?目前未儲存的內容會被取代。`)) return;
      plPos=null; loadSong(s.id, false); renderPlaylist();
    };
    d.querySelector('[data-f=save]').onclick=async ()=>{
      if(!confirm(`用目前內容覆蓋「${s.name}」?`)) return;
      s.snap=snapshot(); persistLib();
      if(curBlob){ try{ await idb.put(s.id, curBlob); }catch(e){} }
    };
    d.querySelector('[data-f=ren]').onclick=()=>{
      const nn=prompt('歌曲名稱:',s.name);
      if(nn&&nn.trim()){ s.name=nn.trim(); persistLib(); renderSongs(); renderPlaylist(); }
    };
    d.querySelector('[data-f=del]').onclick=()=>{
      if(!confirm(`刪除「${s.name}」?此操作無法還原。`)) return;
      lib.songs.splice(si,1);
      lib.playlist.ids=lib.playlist.ids.filter(x=>x!==s.id);
      persistLib(); renderSongs(); renderPlaylist();
      idb.del(s.id).catch(()=>{});
    };
    songList.appendChild(d);
  });
}

/* ================= playlist ================= */
const PL_MODES=[
  ['single-loop','單曲循環'],
  ['list-loop','列表循環'],
  ['single-stop','單曲播完停'],
  ['list-stop','列表播完停']
];
function playFromPlaylist(idx){
  plPos=idx;
  renderPlaylist();
  loadSong(lib.playlist.ids[idx], true);
}
function renderPlaylist(){
  const modesEl=document.getElementById('plModes');
  modesEl.innerHTML=PL_MODES.map(([v,label])=>
    `<button class="chip ${lib.playlist.mode===v?'sel':''}" data-v="${v}">${label}</button>`).join('');
  modesEl.querySelectorAll('.chip').forEach(c=> c.onclick=()=>{
    lib.playlist.mode=c.dataset.v; persistLib(); renderPlaylist();
  });

  const listEl=document.getElementById('plList');
  listEl.innerHTML='';
  if(!lib.songs.length){
    listEl.innerHTML='<div class="hint" style="margin:0">先在下方儲存庫保存歌曲,再在此加入清單。</div>';
    return;
  }
  /* 已加入的(按清單順序) */
  lib.playlist.ids.forEach((id,idx)=>{
    const s=lib.songs.find(x=>x.id===id); if(!s) return;
    const d=document.createElement('div');
    d.className='plrow';
    d.innerHTML=`
      <span class="plnum mono">${idx+1}.</span>
      <span class="plname">${esc(s.name)}${plPos===idx?' ▶':''}</span>
      <button class="tbtn" data-f="up">▲</button>
      <button class="tbtn" data-f="down">▼</button>
      <button class="tbtn" data-f="play">▶ 播放</button>
      <button class="tbtn" data-f="rm">移出</button>`;
    d.querySelector('[data-f=up]').onclick=()=>{
      if(idx===0) return;
      [lib.playlist.ids[idx-1],lib.playlist.ids[idx]]=[lib.playlist.ids[idx],lib.playlist.ids[idx-1]];
      persistLib(); renderPlaylist();
    };
    d.querySelector('[data-f=down]').onclick=()=>{
      if(idx===lib.playlist.ids.length-1) return;
      [lib.playlist.ids[idx+1],lib.playlist.ids[idx]]=[lib.playlist.ids[idx],lib.playlist.ids[idx+1]];
      persistLib(); renderPlaylist();
    };
    d.querySelector('[data-f=play]').onclick=()=>{
      if(!confirm(`播放「${s.name}」?目前未儲存的內容會被取代。`)) return;
      playFromPlaylist(idx);
    };
    d.querySelector('[data-f=rm]').onclick=()=>{
      lib.playlist.ids.splice(idx,1);
      if(plPos===idx) plPos=null;
      persistLib(); renderPlaylist();
    };
    listEl.appendChild(d);
  });
  /* 未加入的 */
  lib.songs.filter(s=>!lib.playlist.ids.includes(s.id)).forEach(s=>{
    const d=document.createElement('div');
    d.className='plrow';
    d.innerHTML=`
      <span class="plnum"></span>
      <span class="plname off">${esc(s.name)}</span>
      <button class="tbtn" data-f="add">＋ 加入清單</button>`;
    d.querySelector('[data-f=add]').onclick=()=>{
      lib.playlist.ids.push(s.id); persistLib(); renderPlaylist();
    };
    listEl.appendChild(d);
  });
}

/* ================= export / import ================= */
document.getElementById('exportBtn').onclick=()=>{
  const payload={ app:'song-parts', ver:5, exportedAt:new Date().toISOString(),
    data:{members:data.members,segments:data.segments,formations:data.formations,theme:data.theme},
    lib };
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`song-parts-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
};
const importInput=makeInput('.json,application/json', f=>{
  f.text().then(txt=>{
    try{
      const o=JSON.parse(txt);
      if(o.app!=='song-parts' || !o.data) throw new Error('bad');
      if(!confirm('匯入將取代目前所有標註、成員與歌曲庫(音檔不受影響),繼續?')) return;
      data=normalizeData(o.data);
      lib=o.lib||{songs:[]};
      lib.playlist=lib.playlist||{ids:[],mode:'single-stop'};
      lib.playlist.ids=lib.playlist.ids.filter(id=>lib.songs.some(s=>s.id===id));
      plPos=null;
      persist(); persistLib();
      applyTheme(); renderAll(); renderSongs(); renderPlaylist();
      alert('匯入完成。');
    }catch(e){ alert('檔案格式不正確,無法匯入。'); }
  });
});
document.getElementById('importBtn').onclick=()=>{ importInput.value=''; importInput.click(); };

/* ================= performance mode ================= */
const perfScreen=document.getElementById('perfScreen');
const perfInner=document.getElementById('perfInner');
let perfHome=null;
document.getElementById('perfBtn').onclick=()=>{
  const blocks=[document.getElementById('playerPanel'),
                document.getElementById('stageBlock'),
                document.getElementById('barsBlock')];
  perfHome=blocks.map(b=>({b, parent:b.parentNode, next:b.nextSibling}));
  blocks.forEach(b=>perfInner.appendChild(b));
  const cs=getComputedStyle(document.body);
  perfScreen.style.backgroundColor=cs.backgroundColor;
  perfScreen.style.backgroundImage=cs.backgroundImage;
  perfScreen.classList.add('open');
};
document.getElementById('perfExit').onclick=()=>{
  perfScreen.classList.remove('open');
  if(perfHome) perfHome.forEach(({b,parent,next})=>parent.insertBefore(b,next));
  perfHome=null;
};

/* ================= stats summary ================= */
function showStats(){
  const totals=data.members.map((m,i)=>({m,v:totalOf(i)}));
  const sum=totals.reduce((a,b)=>a+b.v,0)||1;
  const max=Math.max(1,...totals.map(x=>x.v));
  totals.sort((a,b)=>b.v-a.v);
  document.getElementById('statsBody').innerHTML=totals.map((x,r)=>`
    <div class="strow" style="--c:${x.m.color}">
      <span class="strank mono">${r+1}</span>
      ${x.m.img?`<img src="${x.m.img}" alt="">`:'<span></span>'}
      <div>
        <div class="stname">${esc(x.m.name)}</div>
        <div class="stbar" style="width:${(x.v/max*100).toFixed(1)}%"></div>
      </div>
      <span class="mono" style="font-size:.8rem">${x.v.toFixed(1)}s</span>
      <span class="mono" style="font-size:.8rem;color:var(--muted)">${(x.v/sum*100).toFixed(1)}%</span>
    </div>`).join('');
  document.getElementById('statsOverlay').classList.add('open');
}
document.getElementById('statsBtn').onclick=showStats;
document.getElementById('statsClose').onclick=()=>
  document.getElementById('statsOverlay').classList.remove('open');
document.getElementById('statsOverlay').addEventListener('click',e=>{
  if(e.target.id==='statsOverlay') e.target.classList.remove('open');
});

/* ================= copy tools ================= */
document.getElementById('fcApply').onclick=()=>{
  const a=parseT(document.getElementById('fcFrom').value);
  const b=parseT(document.getElementById('fcTo').value);
  const d=parseT(document.getElementById('fcDest').value);
  if(a==null||b==null||d==null||b<a){ alert('請輸入正確時間(如 1:23.5),「至」不可早於「由」。'); return; }
  const off=d-a;
  const src=data.formations.filter(f=>
    f.t>=a-1e-6 && f.t<=b+1e-6 && (formFilter===-1||f.m===formFilter));
  if(!src.length){ alert('該時間範圍內沒有走位指令。'); return; }
  src.forEach(f=>{
    const nt=+(f.t+off).toFixed(1);
    data.formations=data.formations.filter(g=>!(g.m===f.m && Math.abs(g.t-nt)<0.05));
    data.formations.push({t:nt, m:f.m, col:f.col, row:f.row});
  });
  data.formations.sort((x,y)=>x.t-y.t);
  persist(); renderForm(); renderTicks(); forceRefreshPositions();
};
document.getElementById('scApply').onclick=()=>{
  const a=parseT(document.getElementById('scFrom').value);
  const b=parseT(document.getElementById('scTo').value);
  const d=parseT(document.getElementById('scDest').value);
  if(a==null||b==null||d==null||b<a){ alert('請輸入正確時間(如 1:23.5),「至」不可早於「由」。'); return; }
  const off=d-a;
  const src=data.segments.filter(g=> g.s>=a-1e-6 && g.s<=b+1e-6);
  if(!src.length){ alert('該時間範圍內沒有段落。'); return; }
  src.forEach(g=> data.segments.push({m:g.m, s:+(g.s+off).toFixed(1), e:+(g.e+off).toFixed(1)}));
  data.segments.sort((x,y)=>x.s-y.s);
  persist(); renderSegs();
};

/* ================= theme UI ================= */
const themeOverlay=document.getElementById('themeOverlay');
document.getElementById('themeBtn').onclick=()=>{
  const box=document.getElementById('themeSwatches');
  box.innerHTML=PALETTE.map(c=>
    `<button class="swatch ${(!data.theme.img&&c===data.theme.bg)?'sel':''}" style="background:${c}" data-c="${c}"></button>`).join('');
  box.querySelectorAll('.swatch').forEach(s=> s.onclick=()=>{
    data.theme.bg=s.dataset.c; data.theme.img=null;
    persist(); applyTheme();
    box.querySelectorAll('.swatch').forEach(x=>x.classList.toggle('sel',x===s));
  });
  themeOverlay.classList.add('open');
};
const bgInput=makeInput('image/*', f=>{
  const url=URL.createObjectURL(f);
  const img=new Image();
  img.onload=()=>{
    const max=1600, sc=Math.min(1,max/Math.max(img.width,img.height));
    const cv=document.createElement('canvas');
    cv.width=img.width*sc; cv.height=img.height*sc;
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    data.theme.img=cv.toDataURL('image/jpeg',.72);
    URL.revokeObjectURL(url);
    persist(); applyTheme();
  };
  img.src=url;
});
document.getElementById('bgImgBtn').onclick=()=>{ bgInput.value=''; bgInput.click(); };
document.getElementById('bgImgRm').onclick=()=>{ data.theme.img=null; persist(); applyTheme(); };
document.getElementById('themeClose').onclick=()=>themeOverlay.classList.remove('open');
themeOverlay.addEventListener('click',e=>{ if(e.target===themeOverlay) themeOverlay.classList.remove('open'); });

/* ================= init ================= */
function renderAll(){
  renderMembers(); renderBars(); renderQuickSelect(); renderSegs();
  renderStage(); renderTopview(); renderForm(); renderTicks();
  updateSelVisual();
}
applyTheme(); renderAll(); renderSongs(); renderPlaylist();
