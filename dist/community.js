(() => {
  'use strict';
  const escape=window.AfterClass.escape;
  let auth={configured:false,user:null,csrf:null,canManage:false};
  const listeners=new Set();
  async function request(url,{method='GET',body,raw=false,requestId}={}) {
    const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':raw?'application/octet-stream':'application/json','X-CSRF-Token':auth.csrf || '',...(requestId?{'X-Upload-Id':requestId}:{})},body:body===undefined?undefined:raw?body:JSON.stringify(body),signal:AbortSignal.timeout(raw?60000:16000)});
    const data=await response.json();
    if(!response.ok) {
      if(response.status===401){auth={...auth,user:null,csrf:null,canManage:false};listeners.forEach(fn=>fn());}
      throw new Error(data.error || '操作未完成，请稍后重试。');
    }
    return data;
  }
  const ready=request('/api/session').then(data=>{auth=data;listeners.forEach(fn=>fn());}).catch(()=>{});
  function subscribe(listener) {
    listeners.add(listener);ready.then(listener);
    return ()=>listeners.delete(listener);
  }
  function authControl(container,{action='发表评论',beforeLogin=()=>{},onError=()=>{},githubUrl}={}) {
    container.classList.add('community-auth');
    container.textContent='正在读取登录状态…';
    return subscribe(()=>{
      if(auth.user) {
        container.innerHTML='<span>已登录 <strong>@'+escape(auth.user.login)+'</strong></span><button class="text-link" type="button">退出登录</button>';
        container.querySelector('button').onclick=async()=>{
          try{await request('/api/logout',{method:'POST',body:{}});auth={...auth,user:null,csrf:null,canManage:false};listeners.forEach(fn=>fn());}
          catch(error){onError(error);}
        };
      } else if(auth.configured) {
        const href='/auth/github/start?returnTo='+encodeURIComponent(location.pathname+location.search);
        container.innerHTML='<a class="button" href="'+escape(href)+'">使用 GitHub 登录</a><p>登录后'+escape(action)+'。</p>';
        container.querySelector('a').addEventListener('click',beforeLogin);
      } else {
        container.innerHTML='<p>站内登录暂未开放。</p>'+(githubUrl?'<a class="text-link" target="_blank" rel="noopener noreferrer" href="'+escape(githubUrl)+'">前往 GitHub ↗</a>':'');
      }
    });
  }
  function safeUrl(value) {
    try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';} catch{return '';}
  }
  function commentBody(html,text) {
    const body=document.createElement('div');body.className='comment-body';
    if(!html){body.classList.add('content-comment-plain');body.textContent=text;return body;}
    const parsed=new DOMParser().parseFromString(html,'text/html');
    const allowed=new Set(['P','BR','STRONG','B','EM','I','DEL','S','CODE','PRE','BLOCKQUOTE','UL','OL','LI','A','IMG','HR','H1','H2','H3','H4','TABLE','THEAD','TBODY','TR','TH','TD','DETAILS','SUMMARY']);
    const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH','TEMPLATE']);
    function clean(node) {
      if(node.nodeType===3)return document.createTextNode(node.textContent);
      const fragment=document.createDocumentFragment();
      if(node.nodeType!==1 || blocked.has(node.tagName))return fragment;
      const result=allowed.has(node.tagName)?document.createElement(node.tagName.toLowerCase()):fragment;
      if(node.tagName==='A'){const href=safeUrl(node.getAttribute('href'));if(href){result.href=href;result.target='_blank';result.rel='noopener noreferrer nofollow';}}
      if(node.tagName==='IMG'){const src=safeUrl(node.getAttribute('src'));if(!src.startsWith('https://'))return fragment;result.src=src;result.alt=node.getAttribute('alt') || '评论图片';result.loading='lazy';result.referrerPolicy='no-referrer';}
      for(const child of node.childNodes)result.append(clean(child));return result;
    }
    for(const child of parsed.body.childNodes)body.append(clean(child));return body;
  }
  function confirmAction({title,description,reason=false}) {
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='community-dialog';dialog.setAttribute('aria-labelledby','community-dialog-title');
      dialog.innerHTML='<h2 id="community-dialog-title">'+escape(title)+'</h2><p>'+escape(description)+'</p><form method="dialog">'+(reason?'<label>删除原因<textarea name="reason" maxlength="500" required placeholder="例如：重复投稿、信息有误"></textarea></label>':'')+'<div class="community-dialog-actions"><button class="button secondary" type="button" data-cancel>取消</button><button class="button community-danger" type="submit">确认'+(reason?'删除':title)+'</button></div></form>';
      let value=null;
      dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
      dialog.querySelector('form').onsubmit=event=>{event.preventDefault();value=reason?dialog.querySelector('textarea').value.trim():true;if(value)dialog.close();};
      dialog.addEventListener('close',()=>{dialog.remove();resolve(value);},{once:true});
      document.body.append(dialog);dialog.showModal();
    });
  }
  function editor(container,{endpoint,guestbook=false,onCreated,githubUrl}) {
    const key='usyd-draft:'+endpoint;
    let draft={text:'',title:'',requestId:crypto.randomUUID()},savedSignature='';
    try{draft={...draft,...JSON.parse(sessionStorage.getItem(key) || '{}')};}catch{}
    container.classList.add('community-editor');
    container.innerHTML='<div class="community-auth"></div><form hidden>'+(guestbook?'<label>标题<input name="title" maxlength="80" required placeholder="想聊点什么？"></label>':'')+'<label>'+(guestbook?'留言':'写评论')+'<textarea name="text" maxlength="4000" required placeholder="'+(guestbook?'留下想法、建议，或打个招呼。':'分享体验、提问或补充信息。')+'"></textarea></label><div class="community-editor-footer"><p>内容公开同步至 GitHub。</p><button class="button" type="submit">'+(guestbook?'发布留言':'发表评论')+' ↗</button></div></form><p class="community-status" role="status"></p>';
    const form=container.querySelector('form'),authBox=container.querySelector('.community-auth'),status=container.querySelector('.community-status'),submit=form.querySelector('[type=submit]');
    form.elements.text.value=draft.text || '';if(guestbook)form.elements.title.value=draft.title || '';
    function save() {
      const text=form.elements.text.value,title=guestbook?form.elements.title.value:'';
      if(text!==draft.text || title!==draft.title)draft={text,title,requestId:crypto.randomUUID()};
      try{sessionStorage.setItem(key,JSON.stringify(draft));}catch{}
    }
    form.addEventListener('input',save);
    authControl(authBox,{action:guestbook?'发布留言':'发表评论',beforeLogin:save,onError:error=>status.textContent=error.message,githubUrl});
    subscribe(()=>{form.hidden=!auth.user;});
    const login=new URLSearchParams(location.search).get('login');
    if(login)status.textContent=login==='cancelled'?'已取消登录，草稿已保留。':'登录未完成，请重试，草稿已保留。';
    form.onsubmit=async event=>{
      event.preventDefault();if(submit.disabled)return;save();submit.disabled=true;status.textContent='正在发布…';
      const signature=JSON.stringify(draft);
      try {
        const item=await request(endpoint,{method:'POST',body:draft});
        if(savedSignature!==signature){onCreated(item);savedSignature=signature;}
        form.reset();draft={text:'',title:'',requestId:crypto.randomUUID()};try{sessionStorage.removeItem(key);}catch{}
        status.innerHTML='已发布。<a href="'+escape(safeUrl(item.url))+'" target="_blank" rel="noopener noreferrer">在 GitHub 查看 ↗</a>';
      } catch(error){status.textContent=error.name==='TimeoutError'?'提交结果尚未确认，草稿已保留。请重试以核对结果。':error.message;}
      finally{submit.disabled=false;}
    };
  }
  function feed(container,{endpoint,githubUrl,guestbook=false}) {
    container.innerHTML='<div data-editor></div><div class="community-list" aria-live="polite"></div><p class="community-empty" role="status">正在加载'+(guestbook?'留言':'评论')+'…</p><div class="community-controls"><button class="text-link" type="button" data-refresh>刷新'+(guestbook?'留言':'评论')+'</button><button class="text-link" type="button" data-more hidden>查看更多</button><a class="text-link" href="'+escape(githubUrl)+'" target="_blank" rel="noopener noreferrer">在 GitHub 查看 ↗</a></div>';
    const list=container.querySelector('.community-list'),status=container.querySelector('.community-empty'),refresh=container.querySelector('[data-refresh]'),more=container.querySelector('[data-more]');
    let items=[],next=null,loading=false;
    const dateFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Australia/Sydney',dateStyle:'medium',timeStyle:'short'});
    function render() {
      list.replaceChildren();
      for(const item of items) {
        const article=document.createElement('article');article.className='content-comment';
        const date=new Date(item.createdAt),label=Number.isNaN(date.getTime())?'在 GitHub 查看':dateFormat.format(date);
        article.innerHTML='<header><span class="content-comment-author">@'+escape(item.author)+'</span><div class="community-comment-actions"><a href="'+escape(safeUrl(item.url))+'" target="_blank" rel="noopener noreferrer"><time>'+escape(label)+'</time></a></div></header>'+(guestbook?'<h3>'+escape(item.title || '留言')+'</h3>':'');
        article.append(commentBody(item.html,item.text));
        if(auth.user && (auth.canManage || item.userId===auth.user.id)) {
          const remove=document.createElement('button');remove.type='button';remove.className='text-link';remove.textContent=guestbook?'撤回':'删除';
          remove.onclick=async()=>{
            const confirmed=await confirmAction({title:guestbook?'撤回留言':'删除评论',description:guestbook?'这条留言将从网站移除，GitHub 中保留关闭后的记录。':'评论也会从 GitHub 删除，无法恢复。'});
            if(!confirmed)return;remove.disabled=true;
            try{await request(endpoint+'/'+(guestbook?item.number:item.id),{method:'DELETE'});items=items.filter(row=>row.id!==item.id);render();status.textContent=guestbook?'已撤回留言。':'已删除评论。';}
            catch(error){status.textContent=error.message;remove.disabled=false;}
          };
          article.querySelector('.community-comment-actions').append(remove);
        }
        list.append(article);
      }
    }
    async function load(append=false,force=false) {
      if(loading)return;loading=true;refresh.disabled=true;more.disabled=true;list.setAttribute('aria-busy','true');
      try {
        const result=await request(endpoint+'?page='+(append?next:1)+(force?'&refresh=1':''));
        items=append?[...items,...result.items.filter(item=>!items.some(old=>old.id===item.id))]:result.items;
        next=result.nextPage;more.hidden=!next;render();
        status.textContent=result.stale?'显示上次同步的评论，可到 GitHub 查看最新回复。':items.length?'':guestbook?'还没有留言，来打个招呼吧。':'还没有评论，来聊聊吧。';
      } catch(error){status.textContent=error.message;}
      finally{loading=false;refresh.disabled=false;more.disabled=false;list.setAttribute('aria-busy','false');}
    }
    editor(container.querySelector('[data-editor]'),{endpoint,guestbook,githubUrl,onCreated:item=>{if(!items.some(old=>old.id===item.id)){if(guestbook)items.unshift(item);else items.push(item);}render();status.textContent='';}});
    listeners.add(render);ready.then(render);
    refresh.onclick=()=>load(false,true);more.onclick=()=>load(true);load();
  }
  function manage(container,type,id,title) {
    const endpoint='/api/content/'+type+'/'+encodeURIComponent(id);
    container.className='content-manage';container.hidden=true;
    container.innerHTML='<p class="community-status" role="status"></p><button class="text-link" type="button">删除这条内容</button>';
    const button=container.querySelector('button'),status=container.querySelector('p');
    const render=()=>{container.hidden=!auth.canManage;};listeners.add(render);ready.then(render);
    let receipt=null;
    button.onclick=async()=>{
      if(button.disabled)return;button.disabled=true;
      try {
        if(!receipt) {
          const current=await request(endpoint+'/manage');
          const reason=await confirmAction({title:'删除内容',description:'将「'+title+'」从网站移除。原投稿和讨论记录保留在 GitHub。',reason:true});
          if(!reason)return;
          receipt={hash:current.hash,reason,requestId:crypto.randomUUID()};
        }
        status.textContent='正在提交删除请求…';
        const result=await request(endpoint+'/delete',{method:'POST',body:receipt});
        status.innerHTML='删除请求已提交，网站更新后生效。<a href="'+escape(safeUrl(result.url))+'" target="_blank" rel="noopener noreferrer">查看进度 ↗</a>';
        button.hidden=true;
      } catch(error){status.textContent=error.message;}
      finally{button.disabled=false;}
    };
  }
  window.Community={feed,manage,commentBody,ready,request,authControl,subscribe,session:()=>auth};
})();
