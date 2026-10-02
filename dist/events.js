(() => {
  'use strict';
  const data = window.CAMPUS_DATA;
  const grid = document.getElementById('event-grid');
  const search = document.getElementById('event-search');
  const period = document.getElementById('period-filter');
  const empty = document.getElementById('empty-state');
  const filters = document.getElementById('tag-filters');
  const params = new URLSearchParams(location.search);
  const selectedTags = new Set(params.getAll('tag').filter(tag => Object.hasOwn(data.tags,tag)));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:data.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dateText = value => (value.slice(0,4) !== today().slice(0,4) ? value.slice(0,4) + ' 年 ' : '') + Number(value.slice(5,7)) + ' 月 ' + Number(value.slice(8)) + ' 日';
  const tagNames = item => (item.tags || []).map(tag => data.tags[tag] || tag);
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];

  function card(item) {
    const end = item.endDate || item.startDate;
    const date = dateText(item.startDate) + (end !== item.startDate ? ' – ' + dateText(end) : ' · ' + weekdays[new Date(item.startDate + 'T12:00:00Z').getUTCDay()]);
    const status = end < today() ? '已结束' : item.startDate <= today() ? '进行中' : '即将开始';
    const drawing = '<div class="plaza-gelato" aria-hidden="true"><span>FREE<br>GELATO</span><svg viewBox="0 0 44 60"><path d="M9 28h26v7h-3v6h-3v6h-3v6h-3v5h-4v-5h-3v-6h-3v-6h-3v-6H9Z" fill="#dfad6c" stroke="#4c302b" stroke-width="2"/><path d="M12 34h20M15 41h14M18 48h8" stroke="#bc864f" stroke-width="2"/><path d="M15 3h14v4h6v6h4v13h-4v5h-8v-3H17v3H9v-5H5V13h4V7h6Z" fill="#f1aaab" stroke="#4c302b" stroke-width="2"/><path d="M13 10h6v3h-6Zm14 8h4v3h-4ZM9 21h4v3H9Z" fill="#fff1dc"/></svg></div>';
    const media = item.image ? '<img src="' + escape(item.image) + '" alt="' + escape(item.imageAlt || item.title) + '" width="600" height="360" loading="lazy" style="object-position:' + escape(item.imagePosition || '50% 42%') + ';object-fit:' + escape(item.imageFit || 'cover') + '">' : item.artwork === 'icecream' ? drawing : '<div class="plaza-placeholder"><span aria-hidden="true">✳</span><strong>' + escape(item.title) + '</strong></div>';
    return '<article class="plaza-card" data-event-id="' + escape(item.id) + '"><div class="plaza-card-bar"><time datetime="' + escape(item.startDate) + '">' + escape(date) + '</time><span class="plaza-status' + (status === '已结束' ? ' past' : '') + '">' + status + '</span></div><a class="plaza-card-media" href="detail.html?type=event&id=' + escape(item.id) + '" aria-label="查看 ' + escape(item.name || item.title) + ' 详情">' + media + '</a><div class="plaza-card-body"><div class="event-tags">' + (item.tags || []).map(tag => '<button class="event-tag" data-event-tag="' + escape(tag) + '" aria-label="筛选' + escape(data.tags[tag] || tag) + '标签"># ' + escape(data.tags[tag] || tag) + '</button>').join('') + '</div><h2><a href="detail.html?type=event&id=' + escape(item.id) + '">' + escape(item.title) + '</a></h2><dl class="plaza-facts">' + [['时间',item.time],['地点',item.location],['费用',item.price]].map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + escape(value) + '</dd></div>').join('') + '</dl><div class="plaza-card-bottom"><p>' + escape(item.organiser) + '</p><a href="detail.html?type=event&id=' + escape(item.id) + '" aria-label="查看 ' + escape(item.title) + ' 的活动详情">详情 <span aria-hidden="true">↗</span></a></div></div></article>';
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const results = data.events.filter(item => {
      const end = item.endDate || item.startDate;
      const tagsMatch = [...selectedTags].every(tag => (item.tags || []).includes(tag));
      const queryMatch = !query || [item.title,item.name,item.location,item.organiser,item.search,...tagNames(item)].join(' ').toLocaleLowerCase().includes(query);
      const monthMatch = /^\d{4}-\d{2}$/.test(period.value) && item.startDate.slice(0,7) <= period.value && end.slice(0,7) >= period.value;
      const timeMatch = period.value === 'all' || (period.value === 'upcoming' && end >= today()) || (period.value === 'past' && end < today()) || monthMatch;
      return tagsMatch && queryMatch && timeMatch;
    }).sort((a,b) => a.startDate.localeCompare(b.startDate));
    const url = new URL(location.href);
    for (const key of ['tag','q','period']) url.searchParams.delete(key);
    selectedTags.forEach(tag => url.searchParams.append('tag',tag));
    if (query) url.searchParams.set('q',search.value.trim());
    if (period.value !== 'upcoming') url.searchParams.set('period',period.value);
    history.replaceState(null,'',url);
    grid.innerHTML = results.map(card).join('');
    grid.hidden = !results.length;
    empty.hidden = !!results.length;
    document.getElementById('results-count').innerHTML = '<strong>' + String(results.length).padStart(2,'0') + '</strong> 场' + (period.value === 'upcoming' ? '近期' : period.value === 'past' ? '往期' : '') + '活动' + (selectedTags.size ? '<span> / ' + [...selectedTags].map(tag => '# ' + escape(data.tags[tag])).join(' + ') + '</span>' : '');
    document.getElementById('clear-filters').hidden = !query && !selectedTags.size && period.value === 'upcoming';
    filters.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.tag === 'all' ? !selectedTags.size : selectedTags.has(button.dataset.tag))));
    document.getElementById('empty-message').textContent = '试试减少标签、换个关键词，或调整时间。';
  }
  function reset() {
    selectedTags.clear();
    search.value = '';
    period.value = 'upcoming';
    render();
  }
  filters.innerHTML = '<button type="button" class="tag-filter" data-tag="all" aria-pressed="true">全部</button>' + Object.entries(data.tags).map(([key,label]) => '<button type="button" class="tag-filter" data-tag="' + key + '" aria-pressed="false"># ' + label + '</button>').join('');
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-tag]');
    if (!button) return;
    const tag = button.dataset.tag;
    if (tag === 'all') selectedTags.clear();
    else if (selectedTags.has(tag)) selectedTags.delete(tag);
    else selectedTags.add(tag);
    render();
  });
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-event-tag]');
    if (!button) return;
    const tag = button.dataset.eventTag;
    selectedTags.clear();
    selectedTags.add(tag);
    render();
    filters.querySelector('[data-tag="' + tag + '"]')?.focus({preventScroll:true});
  });
  const months = new Set();
  for (const item of data.events) {
    const start = new Date(item.startDate.slice(0,7) + '-01T12:00:00Z');
    const endMonth = (item.endDate || item.startDate).slice(0,7);
    while (start.toISOString().slice(0,7) <= endMonth) {
      months.add(start.toISOString().slice(0,7));
      start.setUTCMonth(start.getUTCMonth() + 1);
    }
  }
  period.innerHTML = '<option value="upcoming">近期活动</option>' + [...months].sort().map(month => '<option value="' + month + '">' + month.slice(0,4) + ' 年 ' + Number(month.slice(5)) + ' 月</option>').join('') + '<option value="past">往期活动</option><option value="all">全部时间</option>';
  search.value = params.get('q') || '';
  if ([...period.options].some(option => option.value === params.get('period'))) period.value = params.get('period');
  search.addEventListener('input',render);
  period.addEventListener('change',render);
  document.getElementById('reset-filters').addEventListener('click',reset);
  document.getElementById('clear-filters').addEventListener('click',reset);
  render();
})();
