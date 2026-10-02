(() => {
  'use strict';
  const panel=document.getElementById('site-stats');
  const likeButton=document.getElementById('site-like');
  const feedback=document.getElementById('stats-feedback');
  const number=new Intl.NumberFormat('zh-CN');
  let liked=false;
  let busy=false;
  let viewId;
  let visitRecorded=false;
  let lastRequest=0;
  let likeAnimation;
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change',()=>{
    if (motionPreference.matches) likeAnimation?.cancel();
  });

  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;
    bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function render(stats) {
    if (!panel) return;
    for (const field of ['todayVisitors','totalVisits','runningDays','likes']) {
      const value=stats[field];
      if (!Number.isSafeInteger(value) || value<0) throw new Error('Invalid statistics');
      panel.querySelector('[data-stat="'+field+'"]').textContent=number.format(value);
    }
    liked=stats.liked;
    likeButton.setAttribute('aria-pressed',String(liked));
    likeButton.setAttribute('aria-label',liked?'取消点赞':'为网站点赞');
    document.getElementById('like-label').textContent=liked?'已点赞':'点赞';
    panel.dataset.state='ready';
    likeButton.disabled=false;
    document.getElementById('stats-retry').hidden=true;
    feedback.textContent='';
  }
  async function request(path,body) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6000);
    try {
      const response=await fetch('/api/'+path,{
        method:body?'POST':'GET',
        credentials:'same-origin',
        headers:body?{'Content-Type':'application/json'}:{},
        body:body?JSON.stringify(body):undefined,
        cache:'no-store',
        signal:controller.signal
      });
      if (!response.ok) throw new Error('Statistics unavailable');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function showError(message) {
    if (!panel) return;
    panel.dataset.state='error';
    feedback.textContent=message;
    document.getElementById('stats-retry').hidden=false;
  }
  async function trackVisit() {
    const sequence=++lastRequest;
    try {
      const stats=await request('visits',{requestId:viewId});
      visitRecorded=true;
      if (sequence===lastRequest) render(stats);
    } catch { if (sequence===lastRequest) showError('统计暂不可用'); }
  }
  async function refresh() {
    if (busy || !visitRecorded) return;
    const sequence=++lastRequest;
    try { const stats=await request('stats'); if (sequence===lastRequest) render(stats); }
    catch { if (sequence===lastRequest) showError('统计暂不可用'); }
  }
  likeButton?.addEventListener('click',async()=>{
    if (busy) return;
    busy=true;
    likeButton.disabled=true;
    ++lastRequest;
    try {
      const stats=await request('like',{liked:!liked});
      render(stats);
      feedback.textContent=stats.liked?'谢谢你的支持！':'已取消点赞';
      likeAnimation?.cancel();
      const heart=likeButton.querySelector('.pixel-icon');
      if (stats.liked && !motionPreference.matches && typeof heart?.animate==='function') {
        likeAnimation=heart.animate([
          {transform:'scale(1)'},
          {transform:'scale(1.32) rotate(-8deg)',offset:.35},
          {transform:'scale(.94) rotate(3deg)',offset:.7},
          {transform:'scale(1)'}
        ],{duration:420,easing:'ease-out'});
      }
    } catch {
      // A timed-out write may have succeeded. Refresh before allowing another toggle.
      showError('暂时无法点赞');
    } finally { busy=false; }
  });
  document.getElementById('stats-retry')?.addEventListener('click',()=>trackVisit());
  document.addEventListener('visibilitychange',()=>{if(panel&&!document.hidden)refresh();});
  window.addEventListener('pageshow',event=>{
    if (event.persisted) {viewId=newId();visitRecorded=false;trackVisit();}
  });
  viewId=newId();
  window.AfterClass.visitorReady=trackVisit();
})();
