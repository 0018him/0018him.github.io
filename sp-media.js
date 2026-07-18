/* song-parts — 媒體:播放器、進度刻度、播完行為 */
/* ================= media ================= */
const media=document.getElementById('media');
const playBtn=document.getElementById('playBtn');
const seek=document.getElementById('seek');
let mediaReady=false, mediaUrl=null, curBlob=null, pendingAutoplay=false;

function setMediaBlob(blob, name, autoplay){
  curBlob=blob;
  if(mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl=URL.createObjectURL(blob);
  mediaReady=false; pendingAutoplay=!!autoplay;
  media.src=mediaUrl;
  media.classList.toggle('show', (blob.type||'').startsWith('video'));
  document.getElementById('fileHint').textContent=`已載入:${name}`;
}
const mediaInput=makeInput('audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.mp4,.mov,.webm',
  f=> setMediaBlob(f, f.name, false));
document.getElementById('loadBtn').onclick=()=>{ mediaInput.value=''; mediaInput.click(); };

media.addEventListener('loadedmetadata',()=>{
  mediaReady=true;
  playBtn.disabled=false; seek.disabled=false;
  media.playbackRate=+document.getElementById('rateSel').value;
  document.getElementById('markBtn').disabled=false;
  seek.max=media.duration;
  document.getElementById('dur').textContent='/ '+fmtD(media.duration);
  renderTicks();
  if(pendingAutoplay){
    pendingAutoplay=false;
    media.play().then(()=>{ playBtn.textContent='暫停'; })
      .catch(()=>{ /* iOS 或會攔截自動播放,按一下播放即可 */ });
  }
});
media.addEventListener('error',()=>{
  const codes={1:'載入被中斷',2:'網絡錯誤',3:'檔案已損壞或編碼異常,無法解碼',4:'瀏覽器不支援此檔案格式'};
  document.getElementById('fileHint').textContent=
    '載入失敗:'+(codes[media.error?.code]||'未知錯誤')+'。可嘗試重新轉檔為標準 mp3/m4a。';
});
const rateSel=document.getElementById('rateSel');
rateSel.onchange=()=>{ media.playbackRate=+rateSel.value; };
playBtn.onclick=()=>{
  if(media.paused){ media.play(); playBtn.textContent='暫停'; }
  else { media.pause(); playBtn.textContent='播放'; }
};
seek.addEventListener('input',()=>{ media.currentTime=+seek.value; });

/* 播完的行為:由播放清單模式決定 */
let plPos=null;   // 目前在清單中的位置(null=不在清單播放)
media.addEventListener('ended', ()=>{
  const mode=lib.playlist.mode;
  if(mode==='single-loop'){ media.currentTime=0; media.play(); return; }
  if(mode==='single-stop' || plPos==null || !lib.playlist.ids.length){
    playBtn.textContent='播放'; showStats(); return;
  }
  let next=plPos+1;
  if(next>=lib.playlist.ids.length){
    if(mode==='list-loop') next=0;
    else { playBtn.textContent='播放'; plPos=null; renderPlaylist(); showStats(); return; }
  }
  playFromPlaylist(next);
});

function renderTicks(){
  const box=document.getElementById('ticks');
  box.innerHTML='';
  if(!mediaReady || !media.duration) return;
  data.formations.forEach(f=>{
    const t=document.createElement('div');
    t.className='tick';
    t.style.left=`calc(${(f.t/media.duration*100).toFixed(2)}% - 1px)`;
    t.style.background=data.members[f.m]?.color||'#888';
    t.title=fmtT(f.t);
    t.onclick=()=>{ media.currentTime=f.t; };
    box.appendChild(t);
  });
}
