import {createHash} from 'node:crypto';
import {attachmentUrl} from './issue-images.mjs';

export const approvalLabel='审核通过';
export const collections={event:'events',benefit:'benefits',notice:'notices',food:'foods'};
export const typeNames={校园活动:'event',学生权益:'benefit',生活提醒:'notice',美食推荐:'food'};
const prefixes={活动:'event',福利:'benefit',提醒:'notice',美食:'food'};
const optionalAnswers=new Set(['','_No response_','未提供','无','不适用']);
export function submissionHash(issue) {return createHash('sha256').update(JSON.stringify([issue.title,issue.body || ''])).digest('hex');}
export function sectionsOf(body) {
  if(typeof body!=='string' || body.length>60000)throw new Error('投稿正文为空或过长。');
  const result=new Map();let name;let lines=[];let fence='';
  const save=()=>{if(name){if(result.has(name))throw new Error('存在重复的表单栏目，请保留每个栏目一次。');result.set(name,lines.join('\n').trim());}};
  for(const line of body.replace(/\r\n?/g,'\n').split('\n')) {
    const marker=line.match(/^\s*(`{3,}|~{3,})/);
    if(marker){if(!fence)fence=marker[1][0];else if(fence===marker[1][0])fence='';}
    const heading=!fence && line.match(/^### ([^\n]+?)\s*$/);
    if(heading){save();name=heading[1];lines=[];}
    else if(/^---\s*$/.test(line) && !fence){save();name=undefined;lines=[];}
    else if(name)lines.push(line);
  }
  save();return result;
}
export function safeLink(value,label='链接') {
  if(!value)return undefined;
  try {const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error();return url.href;}
  catch {throw new Error(label+'需要完整的 http:// 或 https:// 地址。');}
}
function textValue(value,label,required=false,max=1600) {
  const result=optionalAnswers.has(value?.trim() || '')?'':value.trim();
  if(required&&!result)throw new Error('请补充「'+label+'」。');
  if(result.length>max)throw new Error('「'+label+'」内容过长。');
  return result || undefined;
}
export function validDate(value,label='日期') {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)throw new Error('「'+label+'」请填写有效的 YYYY-MM-DD 日期。');
  return value;
}
function dateRange(value,label) {
  const match=value?.trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s*(?:至|到|~|～|—|–| - )\s*(\d{4}-\d{2}-\d{2}))?$/);
  if(!match)throw new Error('「'+label+'」请填写 YYYY-MM-DD，或 YYYY-MM-DD 至 YYYY-MM-DD。');
  const start=validDate(match[1],label),end=validDate(match[2] || start,label);
  if(end<start)throw new Error('结束日期不能早于开始日期。');
  return [start,end];
}
function tagsOf(value,tags) {
  const inverse=Object.fromEntries(Object.entries(tags).map(([key,label])=>[label,key]));
  const tokens=value.split(/[、,，\n]+/).map(value=>value.trim().replace(/^#\s*/,''));
  const selected=tokens.map(value=>Object.hasOwn(tags,value)?value:(Object.hasOwn(inverse,value)?inverse[value]:undefined));
  if(!selected.length || selected.some(value=>!value))throw new Error('活动标签请从现有标签中选择，可用逗号分隔。');
  return [...new Set(selected)];
}
export function imageLinks(value='',allowBare=true) {
  const matches=[];
  for(const match of value.matchAll(/!\[[^\]\n]*\]\(\s*(https:\/\/[^\s)]+)(?:\s+["'][^\n]*["'])?\s*\)|<img\b[^>]*\bsrc\s*=\s*["'](https:\/\/[^"']+)["'][^>]*>|(?:^|\n)\s*(https:\/\/[^\s<>]+)\s*(?=\n|$)/gi))if(allowBare||!match[3])matches.push(match[1]||match[2]||match[3]);
  const urls=[...new Set(matches)];
  if(urls.length>3)throw new Error('最多提交 3 张配图，请保留需要展示的图片。');
  return urls;
}
function sourceLink(value) {
  const candidate=value?.match(/https?:\/\/[^\s<>"')\]]+/)?.[0];
  return safeLink(candidate,'来源') || (()=>{throw new Error('请提供来源链接，或上传邮件 / 通知截图。');})();
}

export function parseSubmission(issue,data) {
  if(!Number.isSafeInteger(issue.number)||issue.number<1||issue.pull_request)throw new Error('不是有效的投稿 Issue。');
  const fields=sectionsOf(issue.body);
  const get=(...names)=>{for(const name of names)if(fields.has(name))return textValue(fields.get(name),name);};
  const required=(...names)=>textValue(get(...names),names[0],true);
  const titleMatch=issue.title.match(/^\[(活动|福利|提醒|美食)(投稿|更新)\]/);
  const updating=titleMatch?.[2]==='更新'||/^\[内容更新\]/.test(issue.title);
  const type=titleMatch?prefixes[titleMatch[1]]:(Object.hasOwn(typeNames,get('内容类型'))?typeNames[get('内容类型')]:undefined);
  if(!type || (!titleMatch&&!/^\[内容更新\]/.test(issue.title)))throw new Error('仅支持活动、权益、提醒、美食的投稿或更新；请使用投稿模板。');
  if(get('内容类型') && (Object.hasOwn(typeNames,get('内容类型'))?typeNames[get('内容类型')]:undefined)!==type)throw new Error('标题与正文的内容类型不一致。');
  if(!/- \[[xX]\] .*?(?:可公开|可以公开)/.test(issue.body))throw new Error('请勾选公开展示与来源确认。');
  const entryId=updating?required('条目 ID','标题或条目 ID'):undefined;
  if(updating&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entryId))throw new Error('更新时请填写详情链接中的条目 ID。');
  const existing=updating?data[collections[type]].find(item=>item.id===entryId):undefined;
  if(updating&&!existing)throw new Error('没有找到需要更新的条目，请核对内容类型和 ID。');
  let images=imageLinks(get('配图') || '');
  if(!images.length)images=imageLinks(issue.body,false);
  const sourceAnswer=get('来源','可核对的来源','店铺、菜单或地图链接');
  const source=sourceAnswer?sourceLink(sourceAnswer):images[0];
  if(!source)throw new Error('请提供来源链接，或上传邮件 / 通知截图。');
  const patch={source};
  const field=get('更新字段');
  if(updating&&field) {
    const value=required('更新后的内容');
    const mappings={
      event:{标题:'title',介绍:'description',时间:'time',地点:'location',主办方:'organiser',费用:'price',参加条件:'audience',报名链接:'registration'},
      benefit:{标题:'title',介绍:'description',提供方:'provider',适用对象:'eligibility',费用:'cost',有效期:'validity',领取方式:'claim',领取入口:'claimUrl',地点:'location',营业时间:'hours'},
      notice:{标题:'title',介绍:'description',适用对象:'audience',提醒事项:'action'},
      food:{标题:'title',介绍:'description',推荐菜:'dishes',价格:'price',地址:'address',营业时间:'hours',菜单链接:'menuUrl'}
    };
    if(field==='配图'){images=imageLinks(value);if(!images.length)throw new Error('请在更新后的内容中上传配图。');}
    else if(field==='活动日期'&&type==='event'){[patch.startDate,patch.endDate]=dateRange(value,field);}
    else if(field==='活动标签'&&type==='event'){patch.tags=tagsOf(value,data.tags);patch.entryFree=patch.tags.includes('free');}
    else if(field==='生效日期'&&type==='notice')patch.effectiveDate=validDate(value,field);
    else if(field==='展示截止日期')patch.expiresOn=value==='清空'?undefined:validDate(value,field);
    else if(field==='显示状态'){if(!['显示','下架'].includes(value))throw new Error('显示状态请填写「显示」或「下架」。');patch.active=value==='显示';}
    else if(field==='来源')patch.source=safeLink(value,'来源');
    else {
      const key=Object.hasOwn(mappings[type],field)?mappings[type][field]:undefined;
      if(!key)throw new Error('此内容类型不支持该更新字段，请检查模板。');
      patch[key]=['registration','claimUrl','menuUrl'].includes(key)?safeLink(value,field):textValue(value,field,true,key==='title'?90:1600);
      if(type==='food'&&key==='price')patch.budget=value;
      if(type==='food'&&key==='address')patch.location=value;
    }
  } else if(updating&&!get('标题','活动名称','福利名称','提醒标题','店名或餐厅名称')) {
    throw new Error('这份更新使用了旧格式。请通过网站重新提交，或填写「更新字段」和「更新后的内容」。');
  } else {
    if(updating) {
      const base=issue.body.match(/<!-- usyd-base:([a-f0-9]{64}) -->/)?.[1];
      const actual=createHash('sha256').update(JSON.stringify(existing)).digest('hex');
      if(base!==actual)throw new Error('原条目已更新，或缺少版本信息。请从网站详情重新打开纠错表单。');
    }
    patch.title=textValue(required('标题','活动名称','福利名称','提醒标题','店名或餐厅名称'),'标题',true,90);
    patch.description=required('介绍','活动介绍','福利内容','提醒内容','推荐理由');
    if(type==='event') {
      patch.tags=tagsOf(required('活动标签'),data.tags);patch.entryFree=patch.tags.includes('free');
      patch.organiser=required('主办方','主办方 / 社团名称');
      [patch.startDate,patch.endDate]=dateRange(required('日期','活动日期'),'活动日期');
      patch.time=required('悉尼当地时间');patch.location=required('地点');
      patch.price=required('费用','费用与参加条件');patch.audience=get('参加条件');
      patch.registration=safeLink(get('报名链接'),'报名链接');
    } else if(type==='benefit') {
      patch.provider=required('福利提供方');patch.eligibility=required('适用对象');patch.cost=required('费用与限制');
      patch.validity=required('有效期');patch.claim=required('领取 / 使用方式','领取或使用方式');patch.claimUrl=safeLink(get('领取入口'),'领取入口');
      if(patch.validity==='有截止日期') {
        let start=get('开始日期'),end=get('截止日期');
        if(!end&&get('起止日期'))[start,end]=dateRange(get('起止日期'),'起止日期');
        patch.expiresOn=validDate(end,'截止日期');if(start&&validDate(start)>end)throw new Error('截止日期不能早于开始日期。');
        patch.validity=(start?start+' 至 ':'截至 ')+end;
      }
    } else if(type==='notice') {
      patch.audience=required('适用对象 / 范围','适用对象或范围');patch.action=required('需要注意或做什么');
      const date=get('生效或相关日期');patch.effectiveDate=date?validDate(date):undefined;
    } else {
      patch.dishes=required('推荐菜 / 餐食','推荐菜或餐食');patch.price=required('人均预算 / 价格','人均预算或价格');patch.budget=patch.price;
      patch.address=required('地址 / 校内位置','地址或校内位置');patch.location=patch.address;
      patch.hours=get('营业时间');patch.menuUrl=safeLink(get('菜单链接'),'菜单链接');
    }
    const expiry=get('展示截止日期');
    if(expiry)patch.expiresOn=updating&&expiry==='清空'?undefined:validDate(expiry,'展示截止日期');
  }
  if(patch.startDate&&patch.endDate&&(Date.parse(patch.endDate)-Date.parse(patch.startDate)>366*86400000))throw new Error('单次活动的日期跨度不能超过一年；长期服务请投稿学生权益。');
  // Keep corrections visible wherever a curated shortcut or old summary was used.
  if(updating) {
    const changed=Object.keys(patch).filter(key=>JSON.stringify(patch[key])!==JSON.stringify(existing[key]));
    if(changed.some(key=>!['source','registration','claimUrl','menuUrl','expiresOn','active'].includes(key))){patch.homeSummary=undefined;patch.search=undefined;patch.subtitle=undefined;}
    if(patch.source===existing.collectionSource)patch.source=existing.source;
    else if(patch.source!==existing.source){patch.collectionSource=undefined;patch.sourceLabel=undefined;patch.screenshot=undefined;}
  }
  const sourceImages=imageLinks(sourceAnswer || '',false);
  try{attachmentUrl(patch.source);sourceImages.push(patch.source);}catch{}
  images=imageLinks([...images,...sourceImages].join('\n'));
  const sourceImage=images.includes(patch.source)?patch.source:undefined;
  if(sourceImage)attachmentUrl(sourceImage);
  return {type,id:entryId || 'issue-'+issue.number,updating,patch,images,sourceImage,hash:submissionHash(issue)};
}
export function applySubmission(data,parsed,metadata) {
  const copy=structuredClone(data),items=copy[collections[parsed.type]];
  const index=items.findIndex(item=>item.id===parsed.id);
  if(parsed.updating&&index<0)throw new Error('条目在审核期间已被移除，请重新审核。');
  const next={...(index>=0?items[index]:{}),...parsed.patch,id:parsed.id};
  for(const [key,value] of Object.entries(next))if(value===undefined)delete next[key];
  if(index>=0)items[index]=next;else items.push(next);
  copy.updatedAt=metadata.date;
  return copy;
}
