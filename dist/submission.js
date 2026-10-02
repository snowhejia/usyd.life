(() => {
  'use strict';
  const data = window.CAMPUS_DATA;
  const types = data.contentTypes;
  const collections = {event: data.events, benefit: data.benefits, notice: data.notices, food: data.foods || []};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const nameOf = item => item.title || item.name;

  function repositoryUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.hash) return '';
      const path = url.pathname.replace(/\/$/, '');
      if (!/^\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(path) || path.endsWith('/..') || path.endsWith('/.')) return '';
      return 'https://github.com' + path.replace(/\.git$/, '');
    } catch { return ''; }
  }

  const repository = repositoryUrl(window.CAMPUS_CONFIG?.repositoryUrl);

  function input(name, label, options = {}) {
    return '<label class="form-field' + (options.full ? ' full' : '') + '"><span' + (options.labelId ? ' id="' + options.labelId + '"' : '') + '>' + label + (options.optional ? ' <b>可选</b>' : ' *') + '</span><input name="' + name + '" type="' + (options.type || 'text') + '" ' + (options.optional ? '' : 'required ') + 'maxlength="' + (options.max || 160) + '" placeholder="' + escape(options.placeholder || '') + '">' + (options.help ? '<small>' + options.help + '</small>' : '') + '</label>';
  }
  function textarea(name, label, options = {}) {
    return '<label class="form-field full"><span' + (options.labelId ? ' id="' + options.labelId + '"' : '') + '>' + label + ' *</span><textarea name="' + name + '" required maxlength="' + (options.max || 900) + '" rows="3" placeholder="' + escape(options.placeholder || '') + '"></textarea></label>';
  }
  function select(name, label, options) {
    return '<label class="form-field"><span>' + label + ' *</span><select name="' + name + '" required><option value="">请选择</option>' + options.map(([value, text]) => '<option value="' + escape(value) + '">' + escape(text) + '</option>').join('') + '</select></label>';
  }

  const panel = document.createElement('section');
  panel.className = 'submission-panel';
  panel.id = 'submission-panel';
  panel.setAttribute('aria-labelledby', 'submission-title');
  panel.innerHTML = [
    '<div class="submission-shell"><form id="submission-form" novalidate><div class="submission-layout"><aside class="submission-sidebar" aria-label="投稿选项"><div class="submission-sidebar-inner"><div class="submission-heading"><h1 id="submission-title">投稿</h1></div>',
    '<div class="submission-progress" aria-label="投稿步骤"><span id="step-edit" class="current">01 填写</span><i></i><span id="step-preview">02 预览</span>' + (repository ? '<i></i><span>03 提交</span>' : '') + '</div>',
    '<p class="submission-hint">' + (repository ? '投稿需使用 GitHub 账号，审核通过后自动收录。' : '投稿暂未开放，填写后可预览并复制内容。') + '</p>',
    '<div class="submission-type-options" role="group" aria-label="内容类型">',
    ...Object.entries(types).map(([key, label]) => '<label><input type="radio" name="contentType" value="' + key + '" aria-label="' + label + '"' + (key === 'event' ? ' checked' : '') + '><strong>' + label + '</strong></label>'),
    '</div>',
    '<div class="submission-kind" role="group" aria-label="投稿方式"><label><input type="radio" name="kind" value="new" checked>新增内容</label><label><input type="radio" name="kind" value="update">纠错 / 更新</label></div>',
    '</div></aside><div class="submission-content"><div id="submission-editor">',
    '<div class="submission-fields" data-form-section="update" hidden>',
    '<label class="form-field full">要更新哪一条？ *<select name="entryId" required><option value="">选择已有内容</option></select></label>',
    textarea('correction', '更新说明', {placeholder:'说明这次修改了什么。下方已填入现有信息，请修改需要更新的部分。'}),
    '</div>',
    '<div class="submission-fields" data-form-section="common">',
    input('title', '活动名称', {full:true, labelId:'entry-title-label', max:90, placeholder:'填写名称或标题'}),
    textarea('description', '活动介绍', {labelId:'entry-description-label', placeholder:'简要介绍内容和参与方式。'}),
    '</div>',
    '<div class="submission-fields" data-form-section="event">',
    '<fieldset class="event-tag-field full"><legend>活动标签 *</legend><p>至少选择一个，可多选。</p><div class="tag-choices">' + Object.entries(data.tags).map(([key,label]) => '<label><input type="checkbox" name="tags" value="' + key + '"><span># ' + label + '</span></label>').join('') + '</div></fieldset>',
    input('organiser', '主办方 / 社团名称', {full:true, placeholder:'填写学校、社团或组织全名'}),
    input('date', '开始日期', {type:'date'}),
    input('endDate', '结束日期', {type:'date', optional:true, help:'多日活动填写。'}),
    input('time', '悉尼当地时间', {placeholder:'例如：11:00 开始，送完为止', help:'未公布时请写“时间待公布”。'}),
    input('location', '地点', {placeholder:'校内地点或线上'}),
    select('cost', '费用', ['免费活动','免费入场，部分项目另付','收费活动','费用待公布'].map(value => [value,value])),
    input('eligibility', '金额 / 参加条件', {optional:true, placeholder:'例如：$5；仅限社团会员'}),
    input('registration', '报名链接', {type:'url', optional:true, full:true, max:600, placeholder:'https://…'}),
    '</div>',
    '<div class="submission-fields" data-form-section="benefit" hidden>',
    input('provider', '福利提供方', {placeholder:'学校、机构或商家'}),
    input('benefitAudience', '适用对象', {placeholder:'例如：悉大学生；需要有效学生身份'}),
    input('benefitCost', '费用与限制', {placeholder:'例如：免费；每人每学期一次'}),
    select('validity', '有效期', [['ongoing','长期有效，以官方政策为准'],['limited','有截止日期'],['unknown','有效期待确认']]),
    '<div class="submission-fields full" id="benefit-period" hidden>',
    input('benefitStart', '开始日期', {type:'date', optional:true}),
    input('benefitEnd', '截止日期', {type:'date'}),
    '</div>',
    textarea('claim', '领取 / 使用方式', {placeholder:'说明去哪里领取、如何登录或需要哪些步骤。'}),
    input('claimUrl', '领取入口', {type:'url', optional:true, full:true, max:600, placeholder:'https://…'}),
    '</div>',
    '<div class="submission-fields" data-form-section="notice" hidden>',
    input('noticeAudience', '适用对象 / 范围', {placeholder:'例如：在悉尼生活的同学'}),
    input('noticeDate', '生效或相关日期', {type:'date', optional:true, help:'尚未公布或没有固定日期时留空。'}),
    textarea('noticeAction', '需要注意或做什么', {placeholder:'说明对同学有什么影响，以及需要采取的行动。'}),
    '</div>',
    '<div class="submission-fields" data-form-section="food" hidden>',
    input('foodDishes', '推荐菜 / 餐食', {placeholder:'例如：玛格丽特披萨、韩式炸鸡'}),
    input('foodBudget', '人均预算 / 价格', {placeholder:'注明澳元及适用条件；不确定可写“价格待确认”'}),
    input('foodLocation', '地址 / 校内位置', {full:true, placeholder:'店铺地址、附近地标或校内楼名'}),
    input('foodHours', '营业时间', {optional:true, placeholder:'知道时填写，注明工作日或周末'}),
    input('foodMenu', '菜单链接', {type:'url', optional:true, max:600, placeholder:'https://…'}),
    '</div>',
    '<div class="submission-fields submission-source">',
    input('expiresOn','展示截止日期',{type:'date',optional:true,full:true,help:'当天结束后退出首页推荐；长期内容可留空。'}),
    input('source', '原始通知 / 来源链接', {type:'url', full:true, labelId:'entry-source-label', max:600, placeholder:'https://…', help:'官方页面、菜单、地图或公开通知均可。'}),
    '</div>',
    '<label class="submission-consent"><input type="checkbox" name="publicConsent" required>我确认以上信息可公开展示，并已附上可核对的来源。</label>',
    '<div class="form-actions"><span>* 为必填项 · 请勿填写私人联系方式</span><button class="pill lime" type="submit">下一步：预览投稿</button></div></div>',
    '<section id="submission-preview" hidden aria-label="投稿预览"><div class="preview-summary" id="submission-summary"></div>',
    '<p class="submission-hint" id="github-next-hint"' + (repository ? '' : ' hidden') + '>确认后前往 GitHub 提交，可粘贴或拖入图片。</p>',
    '<div class="submission-buttons"><button type="button" class="submission-back" id="edit-submission">返回修改</button><button type="button" class="pill secondary" id="copy-submission">复制投稿内容</button>',
    repository ? '<a class="pill lime" id="github-submit-link" target="_blank" rel="noopener noreferrer">提交投稿 ↗</a>' : '',
    '</div><label class="copy-fallback" hidden>长按或全选下方内容复制<textarea readonly rows="8"></textarea></label><p class="submission-feedback" id="submission-feedback" role="status"></p></section></div></div></form></div>'
  ].join('');
  document.getElementById('submit-main').append(panel);

  const form = panel.querySelector('form');
  const preview = panel.querySelector('#submission-preview');
  const editor = panel.querySelector('#submission-editor');
  let markdown = '';
  let optionType = '';

  function selectedEntry() {
    return collections[form.elements.contentType.value].find(item => item.id === form.elements.entryId.value);
  }
  function selectSource() {
    const item=selectedEntry();
    if(!item)return;
    const values={title:item.title,description:item.description,organiser:item.organiser,date:item.startDate,endDate:item.endDate,time:item.time,location:item.location,eligibility:item.audience,registration:item.registration,
      provider:item.provider,benefitAudience:item.eligibility,benefitCost:item.cost,claim:item.claim,claimUrl:item.claimUrl,benefitStart:'',benefitEnd:item.expiresOn,
      noticeAudience:item.audience,noticeDate:item.effectiveDate,noticeAction:item.action,foodDishes:item.dishes,foodBudget:item.budget || item.price,foodLocation:item.address || item.location,foodHours:item.hours,foodMenu:item.menuUrl,
      expiresOn:item.expiresOn,source:item.collectionSource || item.source,correction:''};
    for(const [name,value] of Object.entries(values))form.elements[name].value=value || '';
    const cost=form.elements.cost;
    let existingOption=[...cost.options].find(option=>option.value===item.price);
    if(item.price&&!existingOption){existingOption=new Option(item.price,item.price);cost.add(existingOption);}
    cost.value=item.price || '';
    const validity=form.elements.validity;
    let validityOption=[...validity.options].find(option=>option.value===item.validity);
    if(item.validity&&!validityOption){validityOption=new Option(item.validity,item.validity);validity.add(validityOption);}
    validity.value=item.validity || 'unknown';
    for(const field of form.querySelectorAll('[name=tags]'))field.checked=(item.tags || []).includes(field.value);
    syncFields();
  }
  function syncFields() {
    const type = form.elements.contentType.value;
    const isNew = form.elements.kind.value === 'new';
    if (optionType !== type) {
      optionType = type;
      form.elements.entryId.innerHTML = '<option value="">选择已有' + types[type] + '</option>' + collections[type].map(item => '<option value="' + escape(item.id) + '">' + escape(nameOf(item)) + '</option>').join('');

    }
    for (const section of form.querySelectorAll('[data-form-section]')) {
      const key = section.dataset.formSection;
      const active = key === 'common' || key === type || (!isNew && key === 'update');
      section.hidden = !active;
      section.querySelectorAll('input,select,textarea').forEach(field => {
        field.disabled = !active;
        field.setCustomValidity('');
      });
    }
    const limited = type === 'benefit' && form.elements.validity.value === 'limited';
    panel.querySelector('#benefit-period').hidden = !limited;
    for (const name of ['benefitStart','benefitEnd']) form.elements[name].disabled = !limited;
    panel.querySelector('#entry-title-label').textContent = ({event:'活动名称',benefit:'福利名称',notice:'提醒标题',food:'店名 / 餐厅名称'})[type] + ' *';
    panel.querySelector('#entry-description-label').textContent = ({event:'活动介绍',benefit:'福利内容',notice:'提醒内容',food:'推荐理由'})[type] + ' *';
    panel.querySelector('#entry-source-label').textContent = type === 'food' ? '店铺 / 菜单 / 地图链接 *' : '原始通知 / 来源链接 *';
  }
  function edit() {
    editor.hidden = false;
    preview.hidden = true;
    panel.querySelector('#step-edit').classList.add('current');
    panel.querySelector('#step-preview').classList.remove('current');
    panel.querySelector('#submission-feedback').textContent = '';
    panel.querySelector('.copy-fallback').hidden = true;
    panel.scrollIntoView({block:'start'});
  }
  form.addEventListener('change', event => {
    if (['contentType','kind','validity'].includes(event.target.name)) {
      syncFields();
      if (!preview.hidden) edit();
      if (event.target.name === 'kind') {
        if (form.elements.kind.value === 'update') selectSource();
        else form.elements.source.value = '';
      }
    }
    if (event.target.name === 'tags') form.querySelectorAll('[name=tags]').forEach(field => field.setCustomValidity(''));
    if (event.target.name === 'entryId') selectSource();
  });
  form.addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  });
  function httpUrl(value) {
    try {
      const url = new URL(value);
      return ['https:','http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }
  function validate() {
    for (const field of form.querySelectorAll('input,textarea,select')) field.setCustomValidity('');
    for (const field of form.querySelectorAll('[required]:not(:disabled)')) {
      if (!['checkbox','radio'].includes(field.type) && !field.value.trim()) field.setCustomValidity('请填写此项，不能只输入空格。');
    }
    for (const name of ['source','registration','claimUrl','foodMenu']) {
      const field = form.elements[name];
      if (!field.disabled && field.value.trim() && !httpUrl(field.value.trim())) field.setCustomValidity('请输入不含账号密码的完整 http:// 或 https:// 链接。');
    }
    for (const [startName,endName] of [['date','endDate'],['benefitStart','benefitEnd']]) {
      const start = form.elements[startName], end = form.elements[endName];
      if (!start.disabled && !end.disabled && start.value && end.value && end.value < start.value) end.setCustomValidity('结束日期不能早于开始日期。');
    }
    const tagInputs = [...form.querySelectorAll('[name=tags]:not(:disabled)')];
    if (tagInputs.length && !tagInputs.some(field => field.checked)) tagInputs[0].setCustomValidity('请至少选择一个活动标签。');
    return form.reportValidity();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validate()) return;
    const payload = new FormData(form);
    const values = Object.fromEntries(payload.entries());
    values.tags = payload.getAll('tags');
    const type = values.contentType;
    const updating = values.kind === 'update';
    const summary = [['内容类型',types[type]],['投稿方式',updating ? '纠错 / 更新' : '新增内容']];
    const title=values.title?.trim();
    let baseMarker='';
    if(updating) {
      const item=selectedEntry();if(!item)return;
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(item)));
      baseMarker='\n<!-- usyd-base:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')+' -->\n';
      summary.push(['条目 ID',item.id],['更新说明',values.correction.trim()]);
    }
    summary.push(['标题',title],['介绍',values.description.trim()]);
    if (type === 'event') {
      summary.push(['活动标签',values.tags.map(tag => '#' + data.tags[tag]).join('、')],['主办方',values.organiser],['日期',values.date + (values.endDate && values.endDate !== values.date ? ' 至 ' + values.endDate : '')],['悉尼当地时间',values.time],['地点',values.location],['费用',values.cost],['参加条件',values.eligibility],['报名链接',values.registration]);
    } else if (type === 'benefit') {
      const validity = {ongoing:'长期有效，以官方政策为准',limited:'有截止日期',unknown:'有效期待确认'}[values.validity] || values.validity;
      summary.push(['福利提供方',values.provider],['适用对象',values.benefitAudience],['费用与限制',values.benefitCost],['有效期',validity]);
      if (values.validity === 'limited') summary.push(['开始日期',values.benefitStart],['截止日期',values.benefitEnd]);
      summary.push(['领取 / 使用方式',values.claim],['领取入口',values.claimUrl]);
    } else if (type === 'food') {
      summary.push(['推荐菜 / 餐食',values.foodDishes],['人均预算 / 价格',values.foodBudget],['地址 / 校内位置',values.foodLocation],['营业时间',values.foodHours],['菜单链接',values.foodMenu]);
    } else {
      summary.push(['适用对象 / 范围',values.noticeAudience],['生效或相关日期',values.noticeDate],['需要注意或做什么',values.noticeAction]);
    }
    if(values.expiresOn || (updating && values.validity!=='limited'))summary.push(['展示截止日期',values.expiresOn || '清空']);
    summary.push(['来源',values.source.trim()]);
    const prefix = {event:'活动',benefit:'福利',notice:'提醒',food:'美食'}[type];
    const issueTitle = '[' + prefix + (updating ? '更新' : '投稿') + '] ' + title;
    const valueOf = value => String(value || '未提供').trim();
    markdown = '## ' + issueTitle + '\n\n' + summary.map(([label,value]) => '### ' + label + '\n' + valueOf(value) + '\n').join('\n') + '\n### 配图\n<!-- 可在这里粘贴或拖入图片；最多 3 张，第一张作为封面。 -->\n\n---\n- [x] 信息及配图可公开展示，已附可核对的来源。\n' + baseMarker;
    panel.querySelector('#submission-summary').innerHTML = '<h3>' + escape(title) + '</h3><dl class="submission-summary-facts">' + summary.filter(([label,value]) => label !== '条目 ID' && String(value || '').trim()).map(([label,value]) => '<dt>' + escape(label) + '</dt><dd>' + escape(valueOf(value)) + '</dd>').join('') + '</dl>';
    if (repository) {
      const target = new URL(repository + '/issues/new');
      target.searchParams.set('title',issueTitle);
      target.searchParams.set('body',markdown);
      target.searchParams.set('labels','投稿');
      // Use a plain Issue when the repo also has dedicated structured templates.
      target.searchParams.set('template','');
      const link = panel.querySelector('#github-submit-link');
      const long = target.href.length > 7800;
      if(long)target.searchParams.delete('body');
      link.href = target.href;
      panel.querySelector('#github-next-hint').textContent = long ? '内容较长。请先复制内容，再前往 GitHub 新建 Issue，粘贴并提交。' : '在 GitHub 的「配图」栏目上传图片，第一张作为封面。确认后提交即可。';
    }
    editor.hidden = true;
    preview.hidden = false;
    panel.querySelector('#step-edit').classList.remove('current');
    panel.querySelector('#step-preview').classList.add('current');
    panel.scrollIntoView({block:'start'});
    panel.querySelector('#edit-submission').focus({preventScroll:true});
  });
  panel.querySelector('#edit-submission').addEventListener('click', () => {
    edit();
    form.querySelector('input:not(:disabled):not([type="radio"]):not([type="checkbox"]),select:not(:disabled)')?.focus({preventScroll:true});
  });
  panel.querySelector('#copy-submission').addEventListener('click', async () => {
    const feedback = panel.querySelector('#submission-feedback');
    try {
      await navigator.clipboard.writeText(markdown);
      feedback.textContent = '已复制。内容尚未提交。';
    } catch {
      const fallback = panel.querySelector('.copy-fallback');
      fallback.hidden = false;
      fallback.querySelector('textarea').value = markdown;
      fallback.querySelector('textarea').select();
      feedback.textContent = '请手动复制下方内容。';
    }
  });
  const params = new URLSearchParams(location.search);
  const requestedType = params.get('type');
  if (Object.hasOwn(types,requestedType)) form.elements.contentType.value = requestedType;
  form.elements.kind.value = params.get('kind') === 'update' ? 'update' : 'new';
  syncFields();
  if (form.elements.kind.value === 'update' && params.get('id')) {
    form.elements.entryId.value = params.get('id');
    selectSource();
  }
})();
