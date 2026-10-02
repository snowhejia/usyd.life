import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {parseSubmission,applySubmission,sectionsOf,imageLinks} from '../scripts/lib/issue-content.mjs';
import {verifyApproval} from '../scripts/lib/approval.mjs';
import {attachmentUrl,saveImage,imageExtension} from '../scripts/lib/issue-images.mjs';
import {prepareSubmission,publishIssue,readData} from '../scripts/publish-issue.mjs';

const consent='\n---\n- [x] 信息及配图可公开展示，已附可核对的来源。';
const fields=values=>Object.entries(values).map(([key,value])=>'### '+key+'\n'+value).join('\n\n')+consent;
const issue=(title,values)=>({number:25,title,body:fields(values),user:{login:'student'},state:'open',labels:[{name:'审核通过'}]});
const data=()=>({updatedAt:'2026-10-03',tags:{club:'社团',social:'社交',free:'免费'},events:[],benefits:[],notices:[],foods:[]});
const eventValues={标题:'社团桌游夜',介绍:'欢迎一起玩桌游。',活动标签:'#社团、#社交、#免费',主办方:'Boardgames Club',日期:'2026-10-10 至 2026-10-11',悉尼当地时间:'17:00–20:00',地点:'Manning House',费用:'免费',来源:'https://example.org/event'};
const samples=[
 issue('[活动投稿] 社团桌游夜',eventValues),
 issue('[福利投稿] 学生权益',{福利名称:'学生权益',福利内容:'学生折扣',福利提供方:'学校',适用对象:'悉大学生',费用与限制:'免费',有效期:'有截止日期',起止日期:'2026-10-01 至 2026-12-31',领取或使用方式:'出示学生证',可核对的来源:'https://example.org/benefit'}),
 issue('[提醒投稿] 校园提醒',{提醒标题:'校园提醒',提醒内容:'留意日期',适用对象或范围:'学生',生效或相关日期:'2026-10-15',需要注意或做什么:'提前准备',可核对的来源:'https://example.org/notice'}),
 issue('[美食投稿] 小餐馆',{店名或餐厅名称:'小餐馆',推荐理由:'有学生餐',推荐菜或餐食:'丼饭',人均预算或价格:'A$12',地址或校内位置:'Camperdown','店铺、菜单或地图链接':'https://example.org/food'})
];
function fixture(t,seed=data()) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'usyd-submissions-'));
 fs.mkdirSync(path.join(dir,'dist'));fs.writeFileSync(path.join(dir,'dist/data.js'),'window.CAMPUS_DATA='+JSON.stringify(seed)+';');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;
}

test('four content types accept website and GitHub template field labels',()=>{
 const types=['event','benefit','notice','food'];
 for(const [i,sample] of samples.entries()) {
  const parsed=parseSubmission(sample,data());assert.equal(parsed.type,types[i]);assert.equal(parsed.id,'issue-25');
  const updated=applySubmission(data(),parsed,{date:'2026-10-03'});
  assert.equal(updated[{event:'events',benefit:'benefits',notice:'notices',food:'foods'}[types[i]]].length,1);
 }
 const parsed=parseSubmission(samples[0],data());assert.deepEqual(parsed.patch.tags,['club','social','free']);assert.equal(parsed.patch.entryFree,true);
 assert.equal(parseSubmission(samples[1],data()).patch.expiresOn,'2026-12-31');
 assert.equal(parseSubmission(samples[2],data()).patch.expiresOn,undefined);
});

test('bad dates, links, categories, missing consent and duplicate headings never produce content',()=>{
 for(const change of [{日期:'2026-02-30'},{日期:'2026-10-12 至 2026-10-10'},{活动标签:'#不存在'},{活动标签:'constructor'},{来源:'javascript:alert(1)'},{来源:'https://user:password@example.org/'},{主办方:''}]) {
  assert.throws(()=>parseSubmission(issue('[活动投稿] test',{...eventValues,...change}),data()));
 }
 assert.throws(()=>parseSubmission({...samples[0],body:samples[0].body.replace('[x]','[ ]')},data()),/勾选/);
 assert.throws(()=>parseSubmission({...samples[0],title:'[留言] test'},data()));
 assert.throws(()=>sectionsOf('### 标题\none\n### 标题\ntwo'),/重复/);
 assert.equal(sectionsOf('### 介绍\n```text\n### 标题\n```\n### 来源\nhttps://example.org').get('介绍'),'```text\n### 标题\n```');
});

test('approval requires a maintainer, unchanged reviewed body, an open issue and the approval label',()=>{
 const permission={permission:'write'};verifyApproval(samples[0],structuredClone(samples[0]),permission);
 assert.throws(()=>verifyApproval(samples[0],samples[0],{permission:'read'}),/维护者/);
 assert.throws(()=>verifyApproval(samples[0],{...samples[0],body:samples[0].body+' changed'},permission),/修改/);
 assert.throws(()=>verifyApproval(samples[0],{...samples[0],labels:[]},permission),/标签/);
 assert.throws(()=>verifyApproval(samples[0],{...samples[0],state:'closed'},permission),/关闭/);
 assert.throws(()=>verifyApproval(samples[0],{...samples[0],pull_request:{}},permission),/标识/);
});

test('automatic writes preserve content as data, stable ids, old entries and idempotent reruns',async t=>{
 const seed=data();seed.foods.push({id:'existing',title:'原餐馆',source:'https://example.org/old'});
 const directory=fixture(t,seed);
 const sample=issue('[活动投稿] quotes',{...eventValues,标题:'"; throw new Error("injection"); //',介绍:'$(touch /tmp/never) `commands` </script>'});
 const args={directory,repository:'snowhejia/usyd.life',issue:sample,reviewer:'maintainer',date:'2026-10-03'};
 const first=await prepareSubmission(args);assert.equal(first.changed,true);
 const content=readData(directory);assert.equal(content.events[0].title,'"; throw new Error("injection"); //');assert.equal(content.foods[0].id,'existing');
 const before=fs.readFileSync(path.join(directory,'dist/data.js'),'utf8');
 assert.equal((await prepareSubmission(args)).changed,false);
 assert.equal(fs.readFileSync(path.join(directory,'dist/data.js'),'utf8'),before);
 assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'content/submissions/25.json'))).reviewedBy,'maintainer');
});

test('field corrections preserve ids and full website corrections require the current original version',()=>{
 const seed=data();seed.events.push({...parseSubmission(samples[0],seed).patch,id:'old-event'});
 const correction=issue('[内容更新] 时间',{内容类型:'校园活动','条目 ID':'old-event',更新字段:'时间',更新后的内容:'18:00',可核对的来源:'https://example.org/event'});
 const changed=applySubmission(seed,parseSubmission(correction,seed),{date:'2026-10-03'});
 assert.equal(changed.events[0].id,'old-event');assert.equal(changed.events[0].time,'18:00');assert.equal(changed.events[0].title,'社团桌游夜');
 const full=issue('[活动更新] 名称',{...eventValues,'条目 ID':'old-event'});
 assert.throws(()=>parseSubmission(full,seed),/版本/);
 const hash=createHash('sha256').update(JSON.stringify(seed.events[0])).digest('hex');full.body+='\n<!-- usyd-base:'+hash+' -->';
 assert.equal(parseSubmission(full,seed).id,'old-event');
 assert.throws(()=>parseSubmission(full,changed),/原条目已更新/);
 seed.events[0].expiresOn='2026-11-01';
 const clearExpiry=issue('[活动更新] 取消截止日期',{...eventValues,'条目 ID':'old-event',展示截止日期:'清空'});
 clearExpiry.body+='\n<!-- usyd-base:'+createHash('sha256').update(JSON.stringify(seed.events[0])).digest('hex')+' -->';
 assert.equal(applySubmission(seed,parseSubmission(clearExpiry,seed),{date:'2026-10-03'}).events[0].expiresOn,undefined);
});

test('Markdown and HTML GitHub attachments support covers and galleries without including ordinary source URLs',()=>{
 const a='https://github.com/user-attachments/assets/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const b='https://user-images.githubusercontent.com/123/456-photo.png';
 assert.deepEqual(imageLinks('![image]('+a+')\n<img width="20" src="'+b+'" />'),[a,b]);
 assert.deepEqual(imageLinks('https://example.org/source',false),[]);
 assert.throws(()=>imageLinks([a,b,a+'a',b+'b'].map(url=>'![]('+url+')').join('\n')),/最多/);
});

test('image downloading checks redirect destinations, size and bytes, and never sends repository credentials',async t=>{
 const directory=fixture(t);
 const url='https://github.com/user-attachments/assets/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yTioAAAAASUVORK5CYII=','base64');
 let calls=0;
 const relative=await saveImage(url,directory,{fetcher:async(target,options)=>{
  calls++;assert.equal(options.headers.Authorization,undefined);
  if(calls===1)return new Response(null,{status:302,headers:{location:'https://private-user-images.githubusercontent.com/123/photo.png?signature=test'}});
  return new Response(png,{headers:{'content-type':'image/png'}});
 }});
 assert.match(relative,/^assets\/submissions\/[a-f0-9]{64}\.png$/);assert.equal(calls,2);
 assert.deepEqual(fs.readFileSync(path.join(directory,path.basename(relative))),png);
 for(const bad of ['http://github.com/a','https://127.0.0.1/image.png','https://github.com.evil.example/image.png','https://github.com@evil.example/image.png','https://raw.githubusercontent.com/a/b/main/file'])assert.throws(()=>attachmentUrl(bad));
 for(const bad of ['https://usyd.life/api/session','https://usyd.life/media/submissions/../data.png','https://usyd.life.evil.example/media/submissions/11111111-1111-4111-8111-111111111111.png','https://usyd.life/media/submissions/11111111-1111-4111-8111-111111111111.png?url=http://localhost'])assert.throws(()=>attachmentUrl(bad));
 await assert.rejects(saveImage(url,directory,{fetcher:async()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/metadata'}})}),/HTTPS/);
 await assert.rejects(saveImage(url,directory,{fetcher:async()=>new Response('<svg onload="alert(1)"></svg>')}),/仅支持/);
 await assert.rejects(saveImage(url,directory,{fetcher:async()=>new Response('x',{headers:{'content-length':String(6*1024*1024)}})}),/5 MB/);
 await assert.rejects(saveImage(url,directory,{fetcher:async()=>new Response(new Uint8Array(5*1024*1024+1))}),/5 MB/);
 assert.throws(()=>imageExtension(Buffer.from('<!doctype html>')),/仅支持/);
});

test('additional images are saved as local files and source audit, without changing other content',async t=>{
 const directory=fixture(t),a='https://github.com/user-attachments/assets/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const sample=issue('[活动投稿] with images',{...eventValues,配图:'![]('+a+')\n![](https://user-images.githubusercontent.com/123/2.png)'});
 let count=0;
 await prepareSubmission({directory,repository:'snowhejia/usyd.life',issue:sample,reviewer:'maintainer',imageSaver:async()=> 'assets/submissions/'+(++count)+'.png'});
 const item=readData(directory).events[0];assert.equal(item.image,'assets/submissions/1.png');assert.equal(item.gallery[0].image,'assets/submissions/2.png');
 const record=JSON.parse(fs.readFileSync(path.join(directory,'content/submissions/25.json')));assert.equal(record.images[0],a);
});

test('publish retries a competing main update, backs website images up in GitHub, and records success before triggering CI',async t=>{
 const directory=fixture(t),sample=issue('[活动投稿] with website photo',{...eventValues,配图:'![](https://usyd.life/media/submissions/11111111-1111-4111-8111-111111111111.png)'});let attempts=0,pushes=0,discussions=0;const writes=[];
 const api=async(route,options={})=>{
  if(route.includes('/permission'))return {permission:'admin'};
  if(route==='/issues/25')return structuredClone(sample);
  if(route.startsWith('/labels?'))return [{name:'content-discussion'}];
  if(route.startsWith('/issues?'))return discussions?[{number:40,body:'<!-- usyd-discussion:event:issue-25 -->'}]:[];
  if(route==='/issues'&&options.method==='POST'){discussions++;return {number:40};}
  if(route.includes('/comments?'))return [];
  writes.push({route,...options});return {};
 };
 const gitRunner=(...args)=>{
  if(args[0]==='reset'){attempts++;const base=data();if(attempts>1)base.foods.push({id:'other',title:'并发新增',source:'https://example.org/other'});fs.writeFileSync(path.join(directory,'dist/data.js'),'window.CAMPUS_DATA='+JSON.stringify(base)+';');fs.rmSync(path.join(directory,'content/submissions/25.json'),{force:true});}
  if(args[0]==='push'&&++pushes===1)throw new Error('Non fast forward');
  return 'testcommit';
 };
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yTioAAAAASUVORK5CYII=','base64');
 const imageSaver=(url,directory)=>saveImage(url,directory,{fetcher:async()=>new Response(png)});
 const result=await publishIssue({directory,event:{issue:sample,repository:{full_name:'snowhejia/usyd.life'}},repository:'snowhejia/usyd.life',actor:'maintainer',token:'test',api,gitRunner,argsRunner:()=>{},imageSaver});
 assert.equal(result.id,'issue-25');assert.equal(attempts,2);assert.equal(pushes,2);assert.equal(discussions,2);
 assert.equal(readData(directory).foods[0].id,'other');
 assert.ok(writes.some(item=>item.route==='/actions/workflows/ci.yml/dispatches'));
 assert.ok(writes.some(item=>item.body?.labels?.includes('已收录')));
 assert.ok(writes.some(item=>item.body?.body?.includes('https://raw.githubusercontent.com/snowhejia/usyd.life/testcommit/dist/'+result.savedImages[0])));
 assert.deepEqual(fs.readFileSync(path.join(directory,'dist',result.savedImages[0])),png);
});

test('edits after approval abort before pushing, with an actionable reply',async t=>{
 const directory=fixture(t),sample=samples[0];let reads=0,pushed=false;const writes=[];
 const api=async(route,options={})=>{
  if(route.includes('/permission'))return {permission:'write'};
  if(route==='/issues/25')return ++reads===1?sample:{...sample,body:sample.body+' new unreviewed text'};
  if(route.includes('/comments?'))return [];
  writes.push({route,...options});return {};
 };
 await assert.rejects(publishIssue({directory,event:{issue:sample,repository:{full_name:'snowhejia/usyd.life'}},repository:'snowhejia/usyd.life',actor:'maintainer',token:'test',api,gitRunner:(...args)=>{if(args[0]==='push')pushed=true;return '';},argsRunner:()=>{}}),/审核后被修改/);
 assert.equal(pushed,false);assert.ok(writes.some(item=>item.body?.labels?.includes('需补充')));
 assert.ok(writes.some(item=>item.body?.body?.includes('重新核对')));
});
