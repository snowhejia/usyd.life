(() => {
  'use strict';
  const section=document.getElementById('content-social');
  if (!section) return;
  const type=section.dataset.contentType;
  const contentId=section.dataset.contentId;
  const likeButton=document.getElementById('content-like');
  const likeStatus=document.getElementById('content-like-status');
  const likeRetry=document.getElementById('content-like-retry');
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
  }
  function showLikeError() {
    known=false;
    likeButton.disabled=true;
    likeStatus.textContent='点赞暂不可用，请重试。';
    likeRetry.hidden=false;
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
      likeStatus.textContent=data.liked?'已点赞':'已取消点赞';
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
  const status=document.getElementById('content-comments-status');
  const refresh=document.getElementById('content-comments-retry');
  const more=document.getElementById('content-comments-more');
  const github=document.getElementById('content-comments-github');
  const list=document.getElementById('content-comments-list');
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(mapping?.repository || '') || !Number.isSafeInteger(issue) || issue<1) {
    status.textContent='评论区准备中。';
    refresh.hidden=true;
    return;
  }
  github.href='https://github.com/'+mapping.repository+'/issues/'+issue+'#new_comment_field';
  github.hidden=false;
  let loading=false;
  let nextPage=null;
  let started=false;
  const seen=new Set();
  const dateFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Australia/Sydney',dateStyle:'medium',timeStyle:'short'});
  function safeUrl(value) {
    try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';} catch{return '';}
  }
  function commentBody(html,text) {
    const body=document.createElement('div');
    body.className='comment-body';
    if (!html) {body.classList.add('content-comment-plain');body.textContent=text;return body;}
    const parsed=new DOMParser().parseFromString(html,'text/html');
    const allowed=new Set(['P','BR','STRONG','B','EM','I','DEL','S','CODE','PRE','BLOCKQUOTE','UL','OL','LI','A','IMG','HR','H1','H2','H3','H4','TABLE','THEAD','TBODY','TR','TH','TD','DETAILS','SUMMARY']);
    const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH','TEMPLATE']);
    function clean(node) {
      if(node.nodeType===3)return document.createTextNode(node.textContent);
      const fragment=document.createDocumentFragment();
      if(node.nodeType!==1 || blocked.has(node.tagName))return fragment;
      const result=allowed.has(node.tagName)?document.createElement(node.tagName.toLowerCase()):fragment;
      if(node.tagName==='A') {
        const href=safeUrl(node.getAttribute('href'));
        if(href){result.href=href;result.target='_blank';result.rel='noopener noreferrer nofollow';}
      }
      if(node.tagName==='IMG') {
        const src=safeUrl(node.getAttribute('src'));
        if(!src || !src.startsWith('https://'))return fragment;
        result.src=src;result.alt=node.getAttribute('alt') || '评论图片';result.loading='lazy';result.referrerPolicy='no-referrer';
      }
      for(const child of node.childNodes)result.append(clean(child));
      return result;
    }
    for(const child of parsed.body.childNodes)body.append(clean(child));
    return body;
  }
  function renderComment(item) {
    const article=document.createElement('article');
    article.className='content-comment';
    const header=document.createElement('header');
    const author=document.createElement('span');
    author.className='content-comment-author';
    author.textContent=item.author;
    const link=document.createElement('a');
    link.href=safeUrl(item.url);link.target='_blank';link.rel='noopener noreferrer';
    const time=document.createElement('time');
    const date=new Date(item.createdAt);
    if(!Number.isNaN(date.getTime())) {time.dateTime=date.toISOString();time.textContent=dateFormat.format(date);}
    link.append(time);header.append(author,link);
    article.append(header,commentBody(item.html,item.text));
    return article;
  }
  async function loadComments(append=false,force=false) {
    if(loading)return;
    loading=true;started=true;
    list.setAttribute('aria-busy','true');refresh.disabled=true;more.disabled=true;
    const page=append?nextPage:1;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch('/api/content/'+type+'/'+encodeURIComponent(contentId)+'/comments?page='+page+(force?'&refresh=1':''),{cache:'no-store',credentials:'same-origin',signal:controller.signal});
      if(!response.ok)throw new Error('Comments unavailable');
      const data=await response.json();
      if(!Array.isArray(data.items))throw new Error('Invalid comments');
      if(!append){list.replaceChildren();seen.clear();}
      for(const item of data.items)if(!seen.has(item.id)){seen.add(item.id);list.append(renderComment(item));}
      nextPage=data.nextPage;
      more.hidden=!nextPage;
      status.textContent=data.stale?'显示上次同步的评论，可到 GitHub 查看最新回复。':seen.size?'':'还没有评论，来聊聊吧。';
      status.hidden=!status.textContent;
    } catch {
      status.hidden=false;
      status.textContent='评论暂时无法加载，可以前往 GitHub 查看。';
    } finally {clearTimeout(timer);loading=false;list.setAttribute('aria-busy','false');refresh.disabled=false;more.disabled=false;}
  }
  refresh.addEventListener('click',()=>loadComments(false,true));
  more.addEventListener('click',()=>{if(nextPage)loadComments(true);});
  document.addEventListener('visibilitychange',()=>{if(started&&!document.hidden)loadComments(false,true);});
  if('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();if(!started)loadComments();}},{rootMargin:'200px'});
    observer.observe(section);
  } else {loadComments();}
})();
