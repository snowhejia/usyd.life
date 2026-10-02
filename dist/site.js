(() => {
  'use strict';
  const data = window.CAMPUS_DATA;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const sections = {
    event:{page:'events',url:'events.html',label:'活动广场',singular:'活动',collection:data.events},
    benefit:{page:'benefits',url:'benefits.html',label:'学生权益',singular:'权益',collection:data.benefits},
    notice:{page:'notices',url:'notices.html',label:'生活提醒',singular:'提醒',collection:data.notices},
    food:{page:'food',url:'food.html',label:'美食推荐',singular:'推荐',collection:data.foods}
  };
  const params = new URLSearchParams(location.search);
  const detailUrl = (type,id) => 'detail.html?type=' + encodeURIComponent(type) + '&id=' + encodeURIComponent(id);
  const submitUrl = (type, id) => 'submit.html' + (type ? '?type=' + encodeURIComponent(type) : '') + (id ? '&kind=update&id=' + encodeURIComponent(id) : '');
  const dateLabel = value => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '日期待公布';
    const [y,m,d] = value.split('-');
    return y + ' 年 ' + Number(m) + ' 月 ' + Number(d) + ' 日';
  };
  function safeUrl(value) {
    try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function external(value,label,className='') {
    const url=safeUrl(value);
    return url ? '<a class="' + className + '" href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + escape(label) + ' <span aria-hidden="true">↗</span></a>' : '';
  }
  const icon = kind => {
    const shapes={
      pizza:'<path d="M3 7h26v6h-3v5h-4v5h-4v6h-4v-6h-4v-5H6v-5H3Z" fill="#f3cf76"/><path d="M3 7h26v5H3Z" fill="#d28e54"/><path d="M9 14h4v4H9Zm11 1h4v4h-4Zm-6 6h4v4h-4Z" fill="#cb6a54" stroke="none"/>',
      chicken:'<path d="M19 21h4v4h5v4h-4v-2h-5v-4h-3Z" fill="#fff0de"/><path d="M8 3h11v3h4v9h-3v5h-5v3H7v-4H3V9h3V5h2Z" fill="#dfa25b"/><path d="M8 9h4v3H8Zm8 5h3v3h-3Z" fill="#f7d795" stroke="none"/>',
      bowl:'<path d="M3 14h26v6h-3v5h-5v4H11v-4H6v-5H3Z" fill="#7fb9ad"/><path d="M4 15h24v4H4Z" fill="#f3cf76" stroke="none"/><path d="M11 2v4H8v5m14-9v4h-3v5" fill="none"/>',
      heart:'<path d="M3 7h3V4h7v3h6V4h7v3h3v12h-3v3h-3v3h-4v4h-6v-4H9v-3H6v-3H3Z" fill="#e79b8a"/>',
      note:'<path d="M6 2h15v5h5v23H6Z" fill="#f4d589"/><path d="M21 2v7h5M10 14h11M10 19h11M10 24h8" fill="none"/>'
    };
    return '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#4c302b" stroke-width="1.7">' + (shapes[kind] || shapes.note) + '</svg>';
  };
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:data.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  window.AfterClass={data,sections,escape,detailUrl,submitUrl,dateLabel,safeUrl,external,icon,today};

  // Preserve previously shared activity and resource URLs.
  if (['home','events'].includes(document.body.dataset.page)) {
    for (const type of ['event','benefit','notice']) {
      const id=params.get(type);
      if (id && sections[type].collection.some(item=>item.id===id)) { location.replace(detailUrl(type,id)); return; }
    }
  }
  const activePage = document.body.dataset.page === 'detail' ? (Object.hasOwn(sections,params.get('type')) ? sections[params.get('type')].page : '') : document.body.dataset.page;
  const nav=[['home','./','首页'],...Object.values(sections).map(section=>[section.page,section.url,section.label]),['about','about.html','关于我们']];
  const header=document.querySelector('[data-site-header]');
  header.innerHTML='<a class="wordmark" href="./" aria-label="悉大活动墙，返回首页"><img class="brand-lion" src="assets/usyd-events-lion-simple.png?v=1" alt="" width="44" height="44"><span>悉大活动墙<small>USYD EVENTS WALL</small></span></a><nav class="site-nav" id="site-nav" aria-label="主导航">' + nav.map(([key,url,label])=>'<a href="' + url + '"' + (key===activePage?' class="nav-active" aria-current="page"':'') + '>' + label + '</a>').join('') + '</nav><div class="header-actions"><a class="button header-submit" href="submit.html"' + (activePage==='submit'?' aria-current="page"':'') + '><span aria-hidden="true">＋</span> 投稿</a><button class="nav-toggle" aria-controls="site-nav" aria-expanded="false" aria-label="打开导航"><span aria-hidden="true">☰</span></button></div>';
  const menu=header.querySelector('.site-nav');
  const toggle=header.querySelector('.nav-toggle');
  const compact=matchMedia('(max-width:980px)');
  function setMenu(open) {
    menu.hidden=compact.matches&&!open;
    toggle.setAttribute('aria-expanded',String(compact.matches&&open));
    toggle.setAttribute('aria-label',open?'关闭导航':'打开导航');
  }
  toggle.addEventListener('click',()=>setMenu(toggle.getAttribute('aria-expanded')!=='true'));
  compact.addEventListener('change',()=>setMenu(false));
  document.addEventListener('click',event=>{if(!header.contains(event.target))setMenu(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){setMenu(false);toggle.focus();}});
  setMenu(false);
  document.querySelector('[data-site-footer]').innerHTML='<a class="footer-brand" href="./">USYD EVENTS WALL</a><p>学生共建 · 非官方校园指南</p><a href="about.html">关于我们 ↗</a>';
})();
