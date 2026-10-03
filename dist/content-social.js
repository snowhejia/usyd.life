(() => {
  'use strict';
  const section=document.getElementById('content-social');
  if (!section) return;
  const type=section.dataset.contentType;
  const contentId=section.dataset.contentId;
  const likeButton=document.getElementById('content-like');
  const likeStatus=document.getElementById('content-like-status');
  const likeFeedback=likeStatus.parentElement;
  const likeRetry=document.getElementById('content-like-retry');
  likeFeedback.hidden=true;
  const number=new Intl.NumberFormat('zh-CN');
  let liked=false;
  let known=false;
  let busy=false;
  let revision=0;
  let likeAnimation;
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change',()=>{if(motionPreference.matches)likeAnimation?.cancel();});

  async function requestLike(value) {
    // Let the visit request establish one shared browser identity first.
    await window.AfterClass.visitorReady;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6000);
    try {
      const response=await fetch('/api/content/'+type+'/'+encodeURIComponent(contentId)+'/likes',{
        method:value===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
        headers:value===undefined?{}:{'Content-Type':'application/json'},
        body:value===undefined?undefined:JSON.stringify({liked:value}),signal:controller.signal
      });
      if (!response.ok) throw new Error('Likes unavailable');
      const data=await response.json();
      if (!Number.isSafeInteger(data.likes) || data.likes<0 || typeof data.liked!=='boolean') throw new Error('Invalid likes');
      return data;
    } finally { clearTimeout(timer); }
  }
  function renderLikes(data) {
    liked=data.liked;
    known=true;
    likeButton.disabled=false;
    likeButton.setAttribute('aria-pressed',String(liked));
    likeButton.setAttribute('aria-label',liked?'取消为这条内容点赞':'为这条内容点赞');
    document.getElementById('content-like-label').textContent=liked?'已点赞':'点赞';
    document.getElementById('content-like-count').textContent=number.format(data.likes);
    likeStatus.textContent='';
    likeRetry.hidden=true;
    likeFeedback.hidden=true;
  }
  function showLikeError() {
    known=false;
    likeButton.disabled=true;
    likeStatus.textContent='点赞暂不可用，请重试。';
    likeRetry.hidden=false;
    likeFeedback.hidden=false;
  }
  async function refreshLikes() {
    if (busy) return;
    const current=++revision;
    try {
      const data=await requestLike();
      if(current===revision)renderLikes(data);
    } catch { if(current===revision)showLikeError(); }
  }
  likeButton.addEventListener('click',async()=>{
    if (busy || !known) return;
    busy=true;
    likeButton.disabled=true;
    ++revision;
    try {
      const data=await requestLike(!liked);
      renderLikes(data);
      likeAnimation?.cancel();
      const heart=likeButton.querySelector('svg');
      if (data.liked && !motionPreference.matches && typeof heart.animate==='function') {
        likeAnimation=heart.animate([{transform:'scale(1)'},{transform:'scale(1.2)',offset:.4},{transform:'scale(1)'}],{duration:360,easing:'ease-out'});
      }
    } catch {
      // A timed-out write may have succeeded; retry reads before allowing a toggle.
      showLikeError();
    } finally { busy=false; }
  });
  likeRetry.addEventListener('click',refreshLikes);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLikes();});
  window.addEventListener('pageshow',event=>{if(event.persisted)refreshLikes();});
  refreshLikes();

  const mapping=window.CAMPUS_DISCUSSIONS;
  const issue=mapping?.items?.[type+':'+contentId];
  const container=document.getElementById('content-comments');
  if(issue)window.Community.feed(container,{endpoint:'/api/content/'+type+'/'+encodeURIComponent(contentId)+'/comments',githubUrl:'https://github.com/'+mapping.repository+'/issues/'+issue});
  const manager=document.createElement('div');
  section.before(manager);
  window.Community.manage(manager,type,contentId,document.querySelector('.detail-intro h1')?.textContent || '这条内容');
})();
