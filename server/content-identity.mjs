import {createHash} from 'node:crypto';
export const collections={event:'events',benefit:'benefits',notice:'notices',food:'foods'};
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export const contentHash=item=>createHash('sha256').update(JSON.stringify(canonical(item))).digest('hex');
export const deletionLabel='删除内容';
export function deletionPayload(body) {
  const matches=[...(body || '').matchAll(/<!-- usyd-delete:(\{[^\n]+\}) -->/g)];
  if(matches.length!==1)throw new Error('删除请求格式无效。');
  const value=JSON.parse(matches[0][1]);
  if(!Object.hasOwn(collections,value.type)||!/^\w+(?:-\w+)*$/.test(value.id || '')||!/^[a-f0-9]{64}$/.test(value.hash || '')||!Number.isSafeInteger(value.userId)||value.userId<1)throw new Error('删除目标无效。');
  return {type:value.type,id:value.id,hash:value.hash,userId:value.userId};
}
