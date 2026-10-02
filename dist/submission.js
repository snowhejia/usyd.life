(() => {
  'use strict';
  const data = window.CAMPUS_DATA;
  const types = data.contentTypes;
  const collections = {event: data.events, benefit: data.benefits, notice: data.notices, food: data.foods || []};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const nameOf = item => item.title || item.name;
  const community = window.Community;
  const params = new URLSearchParams(location.search);
  const draftKey = 'usyd-submission:' + ['type','kind','id'].map(key => params.get(key) || '').join(':');

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
    '<div class="submission-progress" aria-label="投稿步骤"><span id="step-edit" class="current">01 填写</span><i></i><span id="step-preview">02 预览</span><i></i><span id="step-done">03 提交</span></div>',
    '<p class="submission-hint">审核通过后自动收录。</p>',
    '<div class="submission-type-options" role="group" aria-label="内容类型">',
    ...Object.entries(types).map(([key, label]) => '<label><input type="radio" name="contentType" value="' + key + '" aria-label="' + label + '"' + (key === 'event' ? ' checked' : '') + '><strong>' + label + '</strong></label>'),
    '</div>',
    '<div class="submission-kind" role="group" aria-label="投稿方式"><label><input type="radio" name="kind" value="new" checked>新增内容</label><label><input type="radio" name="kind" value="update">纠错 / 更新</label></div>',
    '</div></aside><div class="submission-content"><div id="submission-auth"></div><p class="submission-feedback" id="submission-feedback" role="status"></p><div id="submission-editor">',
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
    '<div class="submission-images"><label class="form-field"><span>配图 <b>可选</b></span><input type="file" id="submission-images" accept="image/png,image/jpeg,image/gif,image/webp" multiple disabled><small>最多 3 张，每张 5 MB。第一张作为封面，可拖入图片。</small></label><p id="image-feedback" class="submission-hint" role="status"></p><div id="image-list" class="submission-image-list"></div><div id="image-recovery" hidden><button type="button" class="text-link" id="retry-images">重试上传</button><button type="button" class="text-link" id="cancel-images">取消待上传</button></div></div>',
    '<label class="submission-consent"><input type="checkbox" name="publicConsent" required>我确认以上信息可公开展示，并已附上可核对的来源。</label>',
    '<div class="form-actions"><span>* 为必填项 · 请勿填写私人联系方式</span><button class="pill lime" type="submit">下一步：预览投稿</button></div></div>',
    '<section id="submission-preview" hidden aria-label="投稿预览"><div class="preview-summary" id="submission-summary"></div>',
    '<p class="submission-hint">投稿将公开保存在 GitHub，审核通过后出现在网站。</p>',
    '<div class="submission-buttons"><button type="button" class="submission-back" id="edit-submission">返回修改</button><button type="button" class="pill lime" id="send-submission" disabled>确认投稿</button>',
    '</div></section><section id="submission-success" class="submission-success" hidden tabindex="-1"></section></div></div></form></div>'
  ].join('');
  document.getElementById('submit-main').append(panel);

  const form = panel.querySelector('form');
  const preview = panel.querySelector('#submission-preview');
  const editor = panel.querySelector('#submission-editor');
  const feedback = panel.querySelector('#submission-feedback');
  const send = panel.querySelector('#send-submission');
  const success = panel.querySelector('#submission-success');
  let markdown = '';
  let optionType = '';
  let baseEntry = null;
  let prepared = null;
  let completed = null;
  let sending = false;
  let images = [];
  let uploadQueue = [];
  let uploading = false;
  const imageInput = panel.querySelector('#submission-images');
  const imageFeedback = panel.querySelector('#image-feedback');
  const imageList = panel.querySelector('#image-list');
  const retryImages = panel.querySelector('#retry-images');
  const imageRecovery = panel.querySelector('#image-recovery');

  function saveDraft() {
    const fields={};
    for(const field of form.elements) {
      if(!field.name || field.type==='file')continue;
      if(field.type==='radio'){if(field.checked)fields[field.name]=field.value;}
      else if(field.name==='tags'){if(field.checked)(fields.tags ||= []).push(field.value);}
      else fields[field.name]=field.type==='checkbox'?field.checked:field.value;
    }
    try{sessionStorage.setItem(draftKey,JSON.stringify({fields,baseEntry,prepared,completed,images,preview:!preview.hidden}));}catch{}
  }
  function renderSession() {
    send.disabled=sending || !community.session().user || !!completed;
    send.textContent=sending?'正在提交…':'确认投稿';
    imageInput.disabled=uploading || !community.session().user || images.length>=3;
    if(!uploading && !images.length && !uploadQueue.length)imageFeedback.textContent=community.session().user?'':'登录后可上传图片。';
  }
  community.authControl(panel.querySelector('#submission-auth'),{action:'提交投稿',beforeLogin:saveDraft,onError:error=>feedback.textContent=error.message});
  community.subscribe(renderSession);
  function renderImages() {
    imageList.replaceChildren();
    images.forEach((item,index)=>{
      const tile=document.createElement('figure');
      tile.innerHTML='<img src="'+escape(item.previewUrl)+'" alt="投稿配图 '+(index+1)+'"><figcaption>'+(index===0?'封面':'配图 '+(index+1))+'<button type="button" class="text-link" aria-label="移除配图 '+(index+1)+'">移除</button></figcaption>';
      tile.querySelector('button').disabled=uploading;
      tile.querySelector('button').onclick=()=>{images.splice(index,1);renderImages();renderSession();saveDraft();};
      imageList.append(tile);
    });
  }
  async function uploadImages() {
    if(uploading || !community.session().user)return;
    uploading=true;imageRecovery.hidden=true;renderSession();renderImages();
    try {
      while(uploadQueue.length) {
        const {file,requestId}=uploadQueue[0];
        imageFeedback.textContent='正在上传 '+file.name+'…';
        const item=await community.request('/api/submissions/images',{method:'POST',body:file,raw:true,requestId});
        images.push(item);uploadQueue.shift();saveDraft();renderImages();
      }
      imageFeedback.textContent='';
    } catch(error) {imageFeedback.textContent=error.name==='TimeoutError'?'上传结果尚未确认，请点击重试。':error.message;imageRecovery.hidden=false;}
    finally {uploading=false;renderSession();renderImages();imageInput.value='';}
  }
  function queueImages(files) {
    if(uploading || !community.session().user)return;
    const chosen=[...files];
    if(images.length+uploadQueue.length+chosen.length>3){imageFeedback.textContent='最多上传 3 张图片，请先移除已有图片。';imageInput.value='';return;}
    if(chosen.some(file=>!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)||file.size>5*1024*1024||!file.size)){imageFeedback.textContent='请选择 5 MB 以内的 PNG、JPG、GIF 或 WebP 图片。';imageInput.value='';return;}
    uploadQueue.push(...chosen.map(file=>({file,requestId:crypto.randomUUID()})));uploadImages();
  }
  imageInput.addEventListener('change',()=>queueImages(imageInput.files));
  const dropArea=panel.querySelector('.submission-images');
  dropArea.addEventListener('dragover',event=>{event.preventDefault();});
  dropArea.addEventListener('drop',event=>{event.preventDefault();queueImages(event.dataTransfer.files);});
  retryImages.onclick=uploadImages;
  panel.querySelector('#cancel-images').onclick=()=>{uploadQueue=[];imageRecovery.hidden=true;imageFeedback.textContent='';renderSession();};

  function selectedEntry() {
    return collections[form.elements.contentType.value].find(item => item.id === form.elements.entryId.value);
  }
  function selectSource() {
    const item=selectedEntry();
    if(!item)return;
    baseEntry=structuredClone(item);
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
    feedback.textContent = '';
    saveDraft();
    panel.scrollIntoView({block:'start'});
  }
  form.addEventListener('change', event => {
    if (['contentType','kind','validity'].includes(event.target.name)) {
      syncFields();
      if (!preview.hidden) edit();
      if (event.target.name === 'kind') {
        if (form.elements.kind.value === 'update') selectSource();
        else {form.elements.source.value = '';baseEntry=null;}
      }
    }
    if (event.target.name === 'tags') form.querySelectorAll('[name=tags]').forEach(field => field.setCustomValidity(''));
    if (event.target.name === 'entryId') selectSource();
    saveDraft();
  });
  form.addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    saveDraft();
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
  async function showPreview() {
    if(uploading || uploadQueue.length){feedback.textContent='请先完成配图上传。';return false;}
    if (!validate()) return false;
    const payload = new FormData(form);
    const values = Object.fromEntries(payload.entries());
    values.tags = payload.getAll('tags');
    const type = values.contentType;
    const updating = values.kind === 'update';
    const summary = [['内容类型',types[type]],['投稿方式',updating ? '纠错 / 更新' : '新增内容']];
    const title=values.title?.trim();
    let baseMarker='';
    if(updating) {
      const item=baseEntry;
      if(!item || item.id!==values.entryId){feedback.textContent='请重新选择要更新的内容。';return false;}
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
    markdown = '## ' + issueTitle + '\n\n' + summary.map(([label,value]) => '### ' + label + '\n' + valueOf(value) + '\n').join('\n') + '\n### 配图\n' + images.map((image,index)=>'![配图 '+(index+1)+']('+image.url+')').join('\n') + '\n\n---\n- [x] 信息及配图可公开展示，已附可核对的来源。\n' + baseMarker;
    panel.querySelector('#submission-summary').innerHTML = '<h3>' + escape(title) + '</h3>'+ (images.length?'<div class="submission-image-list preview-images">'+images.map((image,i)=>'<img src="'+escape(image.previewUrl)+'" alt="投稿配图 '+(i+1)+'">').join('')+'</div>':'')+'<dl class="submission-summary-facts">' + summary.filter(([label,value]) => label !== '条目 ID' && String(value || '').trim()).map(([label,value]) => '<dt>' + escape(label) + '</dt><dd>' + escape(valueOf(value)) + '</dd>').join('') + '</dl>';
    if(!prepared || prepared.title!==issueTitle || prepared.body!==markdown)prepared={title:issueTitle,body:markdown,requestId:crypto.randomUUID()};
    editor.hidden = true;
    preview.hidden = false;
    panel.querySelector('#step-edit').classList.remove('current');
    panel.querySelector('#step-preview').classList.add('current');
    saveDraft();renderSession();
    panel.scrollIntoView({block:'start'});
    panel.querySelector('#edit-submission').focus({preventScroll:true});
    return true;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    try{await showPreview();}catch{feedback.textContent='暂时无法生成预览，请重试。';}
  });
  panel.querySelector('#edit-submission').addEventListener('click', () => {
    edit();
    form.querySelector('input:not(:disabled):not([type="radio"]):not([type="checkbox"]),select:not(:disabled)')?.focus({preventScroll:true});
  });
  function showSuccess() {
    editor.hidden=true;preview.hidden=true;success.hidden=false;feedback.textContent='';
    for(const step of panel.querySelectorAll('.submission-progress span'))step.classList.toggle('current',step.id==='step-done');
    panel.querySelector('.submission-type-options').inert=true;
    panel.querySelector('.submission-kind').inert=true;
    success.innerHTML='<span class="submission-receipt"># '+escape(completed.number)+'</span><h2>投稿已提交</h2><p>审核通过后会自动收录到网站。</p><div class="submission-buttons"><a class="pill lime" target="_blank" rel="noopener noreferrer" href="'+escape(completed.url)+'">查看投稿进度 ↗</a><button type="button" class="submission-back" id="new-submission">再投一条</button></div>';
    success.querySelector('#new-submission').onclick=()=>{sessionStorage.removeItem(draftKey);location.href='submit.html?type='+form.elements.contentType.value;};
    saveDraft();renderSession();success.focus({preventScroll:true});
  }
  send.addEventListener('click',async()=>{
    if(sending || completed || !prepared || !community.session().user)return;
    sending=true;form.inert=true;form.setAttribute('aria-busy','true');renderSession();feedback.textContent='正在提交…';
    try {
      completed=await community.request('/api/submissions',{method:'POST',body:prepared});
      showSuccess();
    } catch(error) {
      feedback.textContent=error.name==='TimeoutError'?'提交结果尚未确认，内容已保留。请再次点击确认投稿以核对结果。':error.message;
      saveDraft();
    } finally {sending=false;form.inert=false;form.removeAttribute('aria-busy');renderSession();if(completed)success.focus({preventScroll:true});}
  });
  const requestedType = params.get('type');
  if (Object.hasOwn(types,requestedType)) form.elements.contentType.value = requestedType;
  form.elements.kind.value = params.get('kind') === 'update' ? 'update' : 'new';
  syncFields();
  if (form.elements.kind.value === 'update' && params.get('id')) {
    form.elements.entryId.value = params.get('id');
    selectSource();
  }
  try {
    const saved=JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    if(saved?.fields && Object.hasOwn(types,saved.fields.contentType)) {
      form.elements.contentType.value=saved.fields.contentType;
      form.elements.kind.value=saved.fields.kind==='update'?'update':'new';syncFields();
      for(const [name,value] of Object.entries(saved.fields)) {
        if(name==='tags'){for(const field of form.querySelectorAll('[name=tags]'))field.checked=Array.isArray(value)&&value.includes(field.value);continue;}
        const field=form.elements[name];if(!field)continue;
        if(field.type==='checkbox')field.checked=value===true;
        else {
          if(['cost','validity'].includes(name) && value && ![...field.options].some(option=>option.value===value))field.add(new Option(value,value));
          field.value=String(value ?? '');
        }
      }
      baseEntry=saved.baseEntry || null;prepared=saved.prepared || null;completed=saved.completed || null;images=Array.isArray(saved.images)?saved.images:[];syncFields();renderImages();
      if(completed)showSuccess();else if(saved.preview)showPreview().catch(()=>{});
    }
  } catch{}
  if(params.has('login'))feedback.textContent=params.get('login')==='cancelled'?'已取消登录，填写的内容已保留。':'登录未完成，填写的内容已保留，请重试。';
})();
