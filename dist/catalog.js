(() => {
  'use strict';
  const {sections, escape, detailUrl, dateLabel, icon} = AfterClass;
  const main = document.getElementById('catalog-main');
  const type = main.dataset.contentType;
  const entries = [...sections[type].collection];
  const search = document.getElementById('catalog-search');
  const grid = document.getElementById('catalog-list');
  search.value = new URLSearchParams(location.search).get('q') || '';
  if (type === 'notice') entries.sort((a,b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''));

  function card(item) {
    const href = detailUrl(type,item.id);
    const title = escape(item.title || item.name);
    const artwork = item.image
      ? '<img src="' + escape(item.image) + '" alt="' + escape(item.imageAlt || item.title) + '" loading="lazy" style="object-position:' + escape(item.imagePosition || '50% 50%') + ';object-fit:' + escape(item.imageFit || 'cover') + '">'
      : (type === 'notice' ? '<time class="notice-card-date" datetime="' + escape(item.effectiveDate || '') + '">' + escape(item.effectiveDate ? dateLabel(item.effectiveDate) : '日常提醒') + '</time>' : '') + icon(item.icon || (type === 'benefit' ? 'heart' : type === 'food' ? 'bowl' : 'note'));
    const photoDate = type === 'notice' && item.image && item.effectiveDate ? '<time class="notice-card-date" datetime="' + escape(item.effectiveDate) + '">' + escape(dateLabel(item.effectiveDate)) + '</time>' : '';
    let content = '';
    if (type === 'benefit') {
      content = '<p class="card-kicker">' + escape(item.provider) + '</p><h2><a href="' + href + '">' + title + '</a></h2><p class="card-price">' + escape(item.cost) + '</p><p class="card-summary">' + escape(item.subtitle || item.description) + '</p><div class="card-facts"><p>适用对象 · ' + escape(item.eligibility) + '</p>' + (item.location ? '<p>' + escape(item.location) + '</p>' : '') + '</div>';
    } else if (type === 'notice') {
      content = '<h2><a href="' + href + '">' + title + '</a></h2><p class="card-summary">' + escape(item.description) + '</p><div class="card-facts"><p>' + escape(item.audience) + '</p></div>';
    } else {
      content = '<p class="card-kicker">' + escape(item.dishes) + '</p><h2><a href="' + href + '">' + title + '</a></h2><p class="card-price">' + escape(item.price) + '</p><p class="card-summary">' + escape(item.description) + '</p><div class="card-facts"><p>' + escape(item.location) + '</p></div>';
    }
    return '<article class="content-card"><a class="content-card-art' + (item.image ? ' has-photo' : '') + '" href="' + href + '" aria-label="查看 ' + title + '">' + artwork + photoDate + '</a><div class="content-card-body">' + content + '<div class="card-bottom"><a href="' + href + '">查看详情 ↗</a></div></div></article>';
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const results = entries.filter(item => !query || [item.title,item.name,item.description,item.provider,item.eligibility,item.claim,item.audience,item.action,item.dishes,item.location,item.address].join(' ').toLocaleLowerCase().includes(query));
    const url = new URL(location.href);
    if (query) url.searchParams.set('q',search.value.trim()); else url.searchParams.delete('q');
    history.replaceState(null,'',url);
    grid.innerHTML = results.map(card).join('');
    grid.hidden = !results.length;
    document.getElementById('catalog-empty').hidden = !!results.length;
    document.getElementById('catalog-count').textContent = results.length + (type === 'food' ? ' 家餐厅' : ' 条信息');
  }
  search.addEventListener('input',render);
  document.getElementById('catalog-reset').addEventListener('click',() => { search.value=''; render(); search.focus(); });
  render();
})();
