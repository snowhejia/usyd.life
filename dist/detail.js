(() => {
  'use strict';
  const {sections, escape, dateLabel, external, icon, submitUrl} = AfterClass;
  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const section = Object.hasOwn(sections,type) ? sections[type] : null;
  const item = section?.collection.find(entry => entry.id === params.get('id'));
  const main = document.getElementById('detail-main');
  if (!item) {
    document.title = '未找到内容 — 悉大活动墙';
    main.innerHTML = '<section class="not-found"><span aria-hidden="true">◇</span><h1>没有找到这条内容</h1><p>链接可能有误，或内容已被移除。</p><a class="button" href="' + (section?.url || './') + '">返回' + (section?.label || '首页') + ' ↗</a></section>';
    return;
  }
  const title = item.title || item.name;
  document.title = title + ' — 悉大活动墙';
  document.querySelector('meta[name="description"]').content = item.description || title;
  let facts = [];
  let extra = '';
  let actions = '';
  let tags = '';
  let badge = section.label;
  if (type === 'event') {
    const date = dateLabel(item.startDate) + (item.endDate && item.endDate !== item.startDate ? ' – ' + dateLabel(item.endDate) : '');
    facts = [['日期',date],['时间',item.time],['地点',item.location],['费用',item.price],['主办方',item.organiser],['参加对象',item.audience]];
    tags = '<div class="event-tags">' + (item.tags || []).map(tag => '<a class="event-tag" href="events.html?tag=' + encodeURIComponent(tag) + '"># ' + escape(AfterClass.data.tags[tag] || tag) + '</a>').join('') + '</div>';
    actions = external(item.registration,item.registrationLabel || '报名活动','button');
  } else if (type === 'benefit') {
    facts = [['提供方',item.provider],['适用对象',item.eligibility],['费用',item.cost],['地点',item.location],['开放时间',item.hours],['有效期',item.validity]];
    if (item.claim) extra = '<section class="detail-section"><h2>如何领取</h2><p>' + escape(item.claim) + '</p></section>';
    actions = external(item.claimUrl,item.claimLabel || '领取权益','button') + external(item.mapUrl,'地图导航','button secondary');
  } else if (type === 'notice') {
    facts = [['相关日期',item.effectiveDate && dateLabel(item.effectiveDate)],['适用范围',item.audience]];
    if (item.action) extra = '<section class="detail-section"><h2>需要注意</h2><p>' + escape(item.action) + '</p></section>';
  } else {
    facts = [['餐食',item.dishes],['价格',item.budget || item.price],['位置',item.location],['地址',item.address],['营业时间',item.hours]];
    actions = external(item.menuUrl,'查看菜单','button') + (item.address ? external('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((item.name || title) + ' ' + item.address),'地图导航','button secondary') : '');
  }
  const media = item.image ? '<img class="detail-cover" src="' + escape(item.image) + '" alt="' + escape(item.imageAlt || title) + '" style="object-position:' + escape(item.imagePosition || '50% 42%') + ';object-fit:' + escape(item.imageFit || 'cover') + '">' : '';
  const gallery = (item.gallery || []).length ? '<section class="detail-gallery" aria-label="更多配图">' + item.gallery.map(photo=>'<a href="'+escape(photo.image)+'" target="_blank" rel="noopener noreferrer"><img src="'+escape(photo.image)+'" alt="'+escape(photo.imageAlt || title)+'" loading="lazy"></a>').join('') + '</section>' : '';
  const notification = item.screenshot ? '<details class="source-notification"><summary>查看原始通知</summary><img src="' + escape(item.screenshot) + '" alt="' + escape(title) + ' 原始通知" loading="lazy"></details>' : '';
  const sourceUrl = item.collectionSource || item.source;
  const sourceLabel = item.collectionSource ? '原始通知' : item.sourceLabel || '查看来源';
  main.innerHTML = '<nav class="breadcrumb" aria-label="面包屑"><a href="./">首页</a><span>/</span><a href="' + section.url + '">' + section.label + '</a><span>/</span><span aria-current="page">' + escape(title) + '</span></nav>' +
    '<article class="detail-card detail-' + type + '"><div class="window-bar ' + ({event:'mint',benefit:'yellow',notice:'peach',food:'mint'})[type] + '"><span>' + badge + '</span><span aria-hidden="true">▪ ▪ ▪</span></div>' + media +
    '<div class="detail-body">' + (item.active===false?'<p class="detail-note">此内容已下架，保留历史资料供参考。</p>':'') + '<div class="detail-intro">' + tags + '<h1>' + escape(title) + '</h1><p class="detail-description">' + escape(item.description) + '</p></div>' +
    '<div class="detail-columns"><div><dl class="detail-facts">' + facts.filter(([,value]) => value).map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + escape(value) + '</dd></div>').join('') + '</dl>' + extra + (item.note ? '<p class="detail-note">' + escape(item.note) + '</p>' : '') + '</div><aside class="detail-aside">' +
    (type === 'event' ? '<div class="detail-date"><strong>' + Number(item.startDate.slice(8)) + '</strong><span>' + Number(item.startDate.slice(5,7)) + ' 月 · ' + item.startDate.slice(0,4) + '</span></div>' : (item.image ? '' : '<div class="detail-illustration">' + icon(item.icon || (type === 'benefit' ? 'heart' : 'note')) + '</div>')) +
    '<div class="detail-actions">' + actions + external(sourceUrl,sourceLabel,'text-link') + '</div></aside></div>' + gallery + notification +
    '<div class="detail-bottom"><a href="' + section.url + '">← 返回' + section.label + '</a><a href="' + submitUrl(type,item.id) + '">纠错 / 补充 ↗</a></div></div></article>' +
    '<section class="content-social" id="content-social" data-content-type="' + type + '" data-content-id="' + escape(item.id) + '" aria-labelledby="content-comments-title"><div class="window-bar mint"><span>COMMENTS <span class="content-social-translation">评论区</span></span><span aria-hidden="true">▪ ▪ ▪</span></div><div class="content-social-body"><div class="content-social-heading"><div><h2 id="content-comments-title">评论区</h2><p>分享体验，也欢迎提问和补充。</p></div><button class="button content-like" id="content-like" type="button" aria-pressed="false" aria-label="为这条内容点赞" disabled>' + icon('heart') + '<span id="content-like-label">点赞</span><span id="content-like-count">—</span></button></div><div class="content-like-feedback"><p id="content-like-status" role="status"></p><button class="text-link" id="content-like-retry" type="button" hidden>重试</button></div><div class="content-comments" id="content-comments"><div id="content-comments-list" aria-busy="false"></div><p class="content-comments-status" id="content-comments-status" role="status">正在加载评论…</p><div class="content-comments-actions"><button class="text-link" id="content-comments-retry" type="button">刷新评论</button><button class="text-link" id="content-comments-more" type="button" hidden>查看更多</button><a class="text-link" id="content-comments-github" target="_blank" rel="noopener noreferrer" hidden>写评论 ↗</a></div></div></div></section>';
})();
