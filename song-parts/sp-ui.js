/* song-parts — 介面:成員、bar、舞台、俯視圖、圖層、段落、動畫循環 */
/* ================= tabs ================= */
document.querySelectorAll('.tab').forEach(t=> t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('sel',x===t));
  document.querySelectorAll('.page').forEach(pg=>
    pg.classList.toggle('sel', pg.id==='page'+t.dataset.page));
});

/* ================= members ================= */
const membersEl=document.getElementById('members');
function renderMembers(){
  membersEl.style.gridTemplateColumns=`repeat(${N()},1fr)`;
  membersEl.innerHTML='';
  data.members.forEach((m,i)=>{
    const d=document.createElement('div');
    d.className='member'; d.dataset.i=i;
    d.style.setProperty('--c',m.color);
    d.innerHTML=`<div class="avatar">${m.img?`<img src="${m.img}" alt="">`:'♪'}</div>
      <div class="mname">${esc(m.name)}</div>`;
    d.onclick=()=>openMember(i);
    membersEl.appendChild(d);
  });
  document.getElementById('memCount').textContent=N();
}
document.getElementById('memPlus').onclick=()=>{
  if(N()>=MAX_N) return;
  data.members.push({name:`成員 ${N()+1}`,img:null,color:PALETTE[N()%14]});
  persist(); renderAll();
};
document.getElementById('memMinus').onclick=()=>{
  if(N()<=MIN_N) return;
  const gone=N()-1;
  const used=data.segments.some(g=>g.m===gone)||data.formations.some(f=>f.m===gone);
  if(used && !confirm(`「${data.members[gone].name}」已有標記,一併刪除?`)) return;
  data.members.pop();
  data.segments=data.segments.filter(g=>g.m<N());
  data.formations=data.formations.filter(f=>f.m<N());
  persist(); renderAll();
};

let photoTarget=null;
const photoInput=makeInput('image/*', f=>{
  openCrop(f, 3/4, 320, dataUrl=>{
    if(photoTarget==null) return;
    data.members[photoTarget].img=dataUrl;
    persist(); renderAll();
    openMember(photoTarget);
  }, .8);
});

const memOverlay=document.getElementById('memOverlay');
const memSheet=document.getElementById('memSheet');
function openMember(i){
  const m=data.members[i];
  memSheet.innerHTML=`
    <h3>成員設定</h3>
    <div><label>名稱</label><input type="text" id="mName" value="${esc(m.name)}" maxlength="20"></div>
    <div><label>顏色(16色,同時用於俯視圖色條)</label>
      <div class="swatches">${PALETTE.map(c=>
        `<button class="swatch ${c===m.color?'sel':''}" style="background:${c}" data-c="${c}"></button>`).join('')}</div></div>
    <div><label>照片(3:4 直向)</label>
      <div class="row">
        <button class="btn" id="mPhoto">上載照片</button>
        ${m.img?'<button class="btn" id="mPhotoRm">移除照片</button>':''}
      </div></div>
    <button class="btn" id="mClose">完成</button>`;
  memOverlay.classList.add('open');
  memSheet.querySelector('#mName').onchange=e=>{
    m.name=e.target.value.trim()||m.name; persist(); renderAll();
  };
  memSheet.querySelectorAll('.swatch').forEach(s=> s.onclick=()=>{
    m.color=s.dataset.c; persist(); renderAll(); openMember(i);
  });
  memSheet.querySelector('#mPhoto').onclick=()=>{
    photoTarget=i; photoInput.value=''; photoInput.click();
  };
  const rm=memSheet.querySelector('#mPhotoRm');
  if(rm) rm.onclick=()=>{ m.img=null; persist(); renderAll(); openMember(i); };
  memSheet.querySelector('#mClose').onclick=()=>memOverlay.classList.remove('open');
}
memOverlay.addEventListener('click',e=>{ if(e.target===memOverlay) memOverlay.classList.remove('open'); });

/* ================= bars ================= */
const barsEl=document.getElementById('bars');
function renderBars(){
  barsEl.innerHTML='';
  barsEl.style.height=(N()*31-9)+'px';
  data.members.forEach((m,i)=>{
    const r=document.createElement('div');
    r.className='barrow'; r.dataset.i=i; r.dataset.rank=i;
    r.style.setProperty('--c',m.color);
    r.style.top=(i*31)+'px';
    r.innerHTML=`<div class="bname">${esc(m.name)}</div>
      <div class="track"><div class="fill"></div></div>
      <div class="bval mono">0.0s</div>`;
    barsEl.appendChild(r);
  });
  document.getElementById('rankBtn').textContent='排名模式:'+(data.rankMode?'開':'關');
}
document.getElementById('rankBtn').onclick=()=>{
  data.rankMode=!data.rankMode; persist(); renderBars();
};

/* ================= photo stage(偽3D 顯示器) ================= */
const stageCells=document.getElementById('stageCells');
const stagePeople=document.getElementById('stagePeople');
function renderStage(){
  stageCells.innerHTML='';
  for(let s=0;s<COLS;s++){
    const c=document.createElement('div');
    c.className='scell';
    stageCells.appendChild(c);
  }
  stagePeople.innerHTML='';
  data.members.forEach((m,i)=>{
    const el=document.createElement('div');
    el.className='sm'; el.dataset.i=i; el.dataset.key='';
    el.style.setProperty('--c',m.color);
    el.innerHTML=`<div class="ph">${m.img?`<img src="${m.img}" alt="">`:'♪'}</div>`;
    stagePeople.appendChild(el);
  });
}
const colLeft = col => `calc(${col} * ((100% - 36px) / 7 + 6px))`;

/* ================= top view(控制器) ================= */
const tvCells=document.getElementById('tvCells');
const tvPeople=document.getElementById('tvPeople');
function renderTopview(){
  tvCells.innerHTML='';
  for(let r=0;r<ROWS;r++){
    const line=document.createElement('div');
    line.className='tv-rowline';
    for(let c=0;c<COLS;c++){
      const cell=document.createElement('div');
      cell.className='tv-cell'; cell.dataset.col=c; cell.dataset.row=r;
      cell.innerHTML='<div class="guide"></div>';
      line.appendChild(cell);
    }
    tvCells.appendChild(line);
  }
  tvPeople.innerHTML='';
  data.members.forEach((m,i)=>{
    const el=document.createElement('div');
    el.className='tvm'; el.dataset.i=i; el.dataset.pos='';
    el.style.setProperty('--c',m.color);
    el.innerHTML='<div class="tbar"></div>';
    tvPeople.appendChild(el);
  });
  updateMultiVisual();
}
function forceRefreshPositions(){
  stagePeople.querySelectorAll('.sm').forEach(el=>el.dataset.key='');
  tvPeople.querySelectorAll('.tvm').forEach(el=>el.dataset.pos='');
}

/* ================= live position update ================= */
function updateStageAndTopview(t){
  const groups={};
  const poses=data.members.map((_,i)=>{
    const pos=posOf(i,t);
    const k=pos.col+'-'+pos.row;
    (groups[k]=groups[k]||[]).push(i);
    return pos;
  });
  stagePeople.querySelectorAll('.sm').forEach(el=>{
    const i=+el.dataset.i, {col,row}=poses[i];
    const d=ROWS-1-row;                         /* 深度級數:0=最前 */
    const key=col+'-'+row;
    if(el.dataset.key!==key){
      el.style.left=colLeft(col);
      el.style.transform=`translateY(${-13*d}px) scale(${(1-0.04*d).toFixed(3)})`;
      el.style.filter=`brightness(${(1-0.05*d).toFixed(2)})`;
      el.dataset.key=key;
    }
    el.style.zIndex=10+row;
    el.classList.toggle('active', isActive(i,t));
  });
  tvPeople.querySelectorAll('.tvm').forEach(el=>{
    const i=+el.dataset.i, {col,row}=poses[i];
    const grp=groups[col+'-'+row], gi=grp.indexOf(i);
    const off=(gi-(grp.length-1)/2)*9;
    const key=col+'-'+row+'-'+gi;
    if(el.dataset.pos!==key){
      el.style.left=`calc(${col} * ((100% - 36px) / 7 + 6px) + ${off}px)`;
      el.style.top=(row*(TV_ROW_H+TV_GAP))+'px';
      el.dataset.pos=key;
    }
    el.style.zIndex=10+row;
    el.classList.toggle('active', isActive(i,t));
  });
}

/* ================= 放置(拖曳與點選共用;含交換) ================= */
function writeKf(mi,col,row,t){
  data.formations=data.formations.filter(f=>!(f.m===mi && Math.abs(f.t-t)<0.05));
  data.formations.push({t, m:mi, col, row});
}
function placeMember(m,col,row){
  const t=nowT();
  const prev=posOf(m,t);
  if(prev.col===col && prev.row===row) return;
  const occ=data.members.map((_,i)=>i)
    .filter(i=>i!==m)
    .filter(i=>{ const q=posOf(i,t); return q.col===col && q.row===row; });
  writeKf(m,col,row,t);
  if(occ.length) writeKf(occ[0],prev.col,prev.row,t);   /* 交換位置 */
  data.formations.sort((a,b)=>a.t-b.t);
  persist(); renderForm(); renderTicks(); forceRefreshPositions();
}

/* 拖曳(移動超過 6px 先當拖;輕點=選中) + 點選保底 */
let tvDown=null, tvDrag=null, selM=null;
let multiMode=false; const multiSel=new Set();
function updateMultiVisual(){
  tvPeople.querySelectorAll('.tvm').forEach(el=>
    el.classList.toggle('msel', multiSel.has(+el.dataset.i)));
}
document.getElementById('multiBtn').onclick=()=>{
  multiMode=!multiMode;
  const b=document.getElementById('multiBtn');
  b.classList.toggle('on', multiMode);
  b.textContent=multiMode?'完成':'選擇';
  if(!multiMode){ multiSel.clear(); updateMultiVisual(); }
};
function updateSelVisual(){
  tvPeople.querySelectorAll('.tvm').forEach(el=>
    el.classList.toggle('sel', +el.dataset.i===selM));
}
document.addEventListener('touchmove',e=>{ if(tvDrag) e.preventDefault(); },{passive:false});
tvPeople.addEventListener('pointerdown',e=>{
  const el=e.target.closest('.tvm'); if(!el) return;
  e.preventDefault();
  tvDown={el,x:e.clientX,y:e.clientY};
});
document.addEventListener('pointermove',e=>{
  if(tvDown && !tvDrag && Math.hypot(e.clientX-tvDown.x,e.clientY-tvDown.y)>6){
    /* 進入拖曳 */
    const el=tvDown.el, r=el.getBoundingClientRect();
    const m=data.members[+el.dataset.i];
    const ghost=document.createElement('div');
    ghost.className='tvghost';
    const gh=24, gw=Math.round(gh*4/3);
    ghost.style.width=gw+'px'; ghost.style.height=gh+'px';
    ghost.style.background=m.color;
    document.body.appendChild(ghost);
    el.classList.add('dragging');
    tvDrag={el,ghost};
    if(navigator.vibrate) navigator.vibrate(15);
  }
  if(tvDrag){
    tvDrag.ghost.style.left=(e.clientX-parseFloat(tvDrag.ghost.style.width)/2)+'px';
    tvDrag.ghost.style.top=(e.clientY-12)+'px';
    tvCells.querySelectorAll('.tv-cell.over').forEach(c=>c.classList.remove('over'));
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tv-cell');
    if(cell) cell.classList.add('over');
  }
});
document.addEventListener('pointerup',e=>{
  if(tvDrag){
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tv-cell');
    if(cell){
      const mi=+tvDrag.el.dataset.i;
      if(multiMode && multiSel.size>1 && multiSel.has(mi)){
        /* 集體移動:保持相對位置,整組平移 */
        const t=nowT();
        const base=posOf(mi,t);
        const dc=+cell.dataset.col-base.col, dr=+cell.dataset.row-base.row;
        multiSel.forEach(m2=>{
          const q=posOf(m2,t);
          writeKf(m2,
            Math.min(COLS-1,Math.max(0,q.col+dc)),
            Math.min(ROWS-1,Math.max(0,q.row+dr)), t);
        });
        data.formations.sort((a,b)=>a.t-b.t);
        persist(); renderForm(); renderTicks(); forceRefreshPositions();
      } else {
        placeMember(mi, +cell.dataset.col, +cell.dataset.row);
      }
    }
    tvDrag.ghost.remove();
    tvDrag.el.classList.remove('dragging');
    tvCells.querySelectorAll('.tv-cell.over').forEach(c=>c.classList.remove('over'));
    tvDrag=null; tvDown=null;
    return;
  }
  if(tvDown){   /* 冇拖過=輕點 */
    const i=+tvDown.el.dataset.i;
    if(multiMode){
      multiSel.has(i)?multiSel.delete(i):multiSel.add(i);
      updateMultiVisual();
    } else {
      selM = (selM===i)? null : i;
      updateSelVisual();
    }
    tvDown=null;
  }
});
document.addEventListener('pointercancel',()=>{
  if(tvDrag){
    tvDrag.ghost.remove(); tvDrag.el.classList.remove('dragging');
    tvCells.querySelectorAll('.tv-cell.over').forEach(c=>c.classList.remove('over'));
    tvDrag=null;
  }
  tvDown=null;
});
/* 點選保底:選中狀態下點目標格 */
tvCells.addEventListener('click',e=>{
  if(multiMode) return;
  if(selM==null) return;
  const cell=e.target.closest('.tv-cell'); if(!cell) return;
  placeMember(selM, +cell.dataset.col, +cell.dataset.row);
  selM=null; updateSelVisual();
});

/* ================= formation layers editor ================= */
let formFilter=-1;
const layerChips=document.getElementById('layerChips');
const formBody=document.getElementById('formBody');
function renderForm(){
  layerChips.innerHTML=`<button class="chip ${formFilter===-1?'sel':''}" data-i="-1">全部</button>`+
    data.members.map((m,i)=>
      `<button class="chip ${formFilter===i?'sel':''}" data-i="${i}">
        <span class="dot" style="background:${m.color}"></span>${esc(m.name)}</button>`).join('');
  layerChips.querySelectorAll('.chip').forEach(c=> c.onclick=()=>{
    formFilter=+c.dataset.i; renderForm();
  });

  formBody.innerHTML='';
  data.formations.forEach((f,fi)=>{
    if(formFilter!==-1 && f.m!==formFilter) return;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><span class="dot" style="background:${data.members[f.m].color}"></span>
        <select data-f="m">${data.members.map((m,i)=>
          `<option value="${i}" ${i===f.m?'selected':''}>${esc(m.name)}</option>`).join('')}</select></td>
      <td><input type="text" class="mono" value="${fmtT(f.t)}" data-f="t">
          <button class="tbtn" data-f="now">取now</button>
          <button class="tbtn" data-f="tm">−.1</button>
          <button class="tbtn" data-f="tp">＋.1</button></td>
      <td><select data-f="col">${Array.from({length:COLS},(_,s)=>
          `<option value="${s}" ${s===f.col?'selected':''}>第 ${s+1} 格</option>`).join('')}</select></td>
      <td><select data-f="row">${Array.from({length:ROWS},(_,r)=>
          `<option value="${r}" ${r===f.row?'selected':''}>第 ${r+1} 排${r===ROWS-1?'(最前)':r===0?'(最後)':''}</option>`).join('')}</select></td>
      <td><button class="tbtn" data-f="del">刪除</button></td>`;
    tr.querySelector('[data-f=m]').onchange=e=>{ f.m=+e.target.value; persist(); renderForm(); renderTicks(); forceRefreshPositions(); };
    tr.querySelector('[data-f=t]').onchange=e=>{
      const v=parseT(e.target.value); if(v!=null){ f.t=+v.toFixed(1);
        data.formations.sort((a,b)=>a.t-b.t); persist(); renderTicks(); forceRefreshPositions(); } renderForm(); };
    tr.querySelector('[data-f=now]').onclick=()=>{
      f.t=nowT();
      data.formations.sort((a,b)=>a.t-b.t); persist(); renderForm(); renderTicks(); forceRefreshPositions(); };
    tr.querySelector('[data-f=tm]').onclick=()=>{
      f.t=Math.max(0,+(f.t-0.1).toFixed(1));
      data.formations.sort((a,b)=>a.t-b.t); persist(); renderForm(); renderTicks(); forceRefreshPositions(); };
    tr.querySelector('[data-f=tp]').onclick=()=>{
      f.t=+(f.t+0.1).toFixed(1);
      data.formations.sort((a,b)=>a.t-b.t); persist(); renderForm(); renderTicks(); forceRefreshPositions(); };
    tr.querySelector('[data-f=col]').onchange=e=>{ f.col=+e.target.value; persist(); forceRefreshPositions(); };
    tr.querySelector('[data-f=row]').onchange=e=>{ f.row=+e.target.value; persist(); forceRefreshPositions(); };
    tr.querySelector('[data-f=del]').onclick=()=>{
      data.formations.splice(fi,1); persist(); renderForm(); renderTicks(); forceRefreshPositions(); };
    formBody.appendChild(tr);
  });
  const tr=document.createElement('tr');
  tr.innerHTML=`<td colspan="5"><button class="tbtn" id="addForm">＋ 手動新增走位</button></td>`;
  tr.querySelector('#addForm').onclick=()=>{
    const m=formFilter===-1?0:formFilter;
    const cur=posOf(m,nowT());
    data.formations.push({t:nowT(), m, col:cur.col, row:cur.row});
    data.formations.sort((a,b)=>a.t-b.t);
    persist(); renderForm(); renderTicks();
  };
  formBody.appendChild(tr);
}

/* ================= live loop ================= */
let lastLyricHTML=null;
function frame(){
  const t=media.currentTime||0;
  document.getElementById('cur').textContent=fmtT(t);
  if(mediaReady && !seek.matches(':active')) seek.value=t;
  const maxTotal=Math.max(1,...data.members.map((_,i)=>totalOf(i)));
  const vals=data.members.map((_,i)=>sungUpTo(i,t));
  const order=data.members.map((_,i)=>i);
  if(data.rankMode) order.sort((a,b)=> vals[b]-vals[a] || a-b);
  document.querySelectorAll('.barrow').forEach(r=>{
    const i=+r.dataset.i, v=vals[i];
    r.querySelector('.fill').style.width=(v/maxTotal*100)+'%';
    r.querySelector('.bval').textContent=v.toFixed(1)+'s';
    r.classList.toggle('active',isActive(i,t));
    const rank=order.indexOf(i);
    if(+r.dataset.rank!==rank){ r.style.top=(rank*31)+'px'; r.dataset.rank=rank; }
  });
  /* 歌詞:現在唱的(成員色)+ 下一句(半透明) */
  const nowLy=data.segments.filter(g=>t>=g.s && t<g.e && g.lyric);
  const nextSeg=data.segments.find(g=>g.s>t && g.lyric);
  let ly=nowLy.map(g=>
    `<div class="lyric-now" style="color:${data.members[g.m].color}">${esc(g.lyric)}</div>`).join('');
  if(nextSeg) ly+=`<div class="lyric-next" style="color:${data.members[nextSeg.m].color}">${esc(nextSeg.lyric)}</div>`;
  if(ly!==lastLyricHTML){ document.getElementById('lyricBox').innerHTML=ly; lastLyricHTML=ly; }
  document.querySelectorAll('.member').forEach(d=>
    d.classList.toggle('active',isActive(+d.dataset.i,t)));
  updateStageAndTopview(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ================= segments (page1) ================= */
const segBody=document.getElementById('segBody');
const quickMember=document.getElementById('quickMember');
const markBtn=document.getElementById('markBtn');
const markState=document.getElementById('markState');
let marking=null;
function renderQuickSelect(){
  quickMember.innerHTML=data.members.map((m,i)=>
    `<option value="${i}">${esc(m.name)}</option>`).join('');
}
markBtn.onclick=()=>{
  const t=media.currentTime;
  if(!marking){
    marking={m:+quickMember.value,s:t};
    markBtn.textContent='■ 結束標記';
    markState.textContent=`${data.members[marking.m].name} 由 ${fmtT(t)} 開始…`;
  } else {
    if(t>marking.s+0.2){
      data.segments.push({m:marking.m,s:+marking.s.toFixed(1),e:+t.toFixed(1)});
      data.segments.sort((a,b)=>a.s-b.s);
      persist(); renderSegs();
    }
    marking=null;
    markBtn.textContent='▶ 由此刻開始標記';
    markState.textContent='';
  }
};
function renderSegs(){
  segBody.innerHTML='';
  data.segments.forEach((g,gi)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><span class="dot" style="background:${data.members[g.m].color}"></span>
        <select data-f="m">${data.members.map((m,i)=>
          `<option value="${i}" ${i===g.m?'selected':''}>${esc(m.name)}</option>`).join('')}</select></td>
      <td><input type="text" class="mono" value="${fmtT(g.s)}" data-f="s">
          <button class="tbtn" data-f="nows">取now</button></td>
      <td><input type="text" class="mono" value="${fmtT(g.e)}" data-f="e">
          <button class="tbtn" data-f="nowe">取now</button></td>
      <td><input type="text" value="${esc(g.lyric||'')}" data-f="ly" placeholder="歌詞" style="width:130px"></td>
      <td class="mono" style="color:var(--muted)">${(g.e-g.s).toFixed(1)}s</td>
      <td><button class="tbtn" data-f="del">刪除</button></td>`;
    tr.querySelector('[data-f=m]').onchange=e=>{ g.m=+e.target.value; persist(); renderSegs(); };
    tr.querySelector('[data-f=ly]').onchange=e=>{ g.lyric=e.target.value; persist(); };
    tr.querySelector('[data-f=s]').onchange=e=>{
      const v=parseT(e.target.value); if(v!=null&&v<g.e){ g.s=v; persist(); } renderSegs(); };
    tr.querySelector('[data-f=e]').onchange=e=>{
      const v=parseT(e.target.value); if(v!=null&&v>g.s){ g.e=v; persist(); } renderSegs(); };
    tr.querySelector('[data-f=nows]').onclick=()=>{
      const t=+media.currentTime.toFixed(1); if(t<g.e){ g.s=t; persist(); renderSegs(); } };
    tr.querySelector('[data-f=nowe]').onclick=()=>{
      const t=+media.currentTime.toFixed(1); if(t>g.s){ g.e=t; persist(); renderSegs(); } };
    tr.querySelector('[data-f=del]').onclick=()=>{
      data.segments.splice(gi,1); persist(); renderSegs(); };
    segBody.appendChild(tr);
  });
  const tr=document.createElement('tr');
  tr.innerHTML=`<td colspan="6"><button class="tbtn" id="addSeg">＋ 手動新增段落</button></td>`;
  tr.querySelector('#addSeg').onclick=()=>{
    const t=+(media.currentTime||0).toFixed(1);
    data.segments.push({m:+quickMember.value,s:t,e:t+5});
    persist(); renderSegs();
  };
  segBody.appendChild(tr);
}
