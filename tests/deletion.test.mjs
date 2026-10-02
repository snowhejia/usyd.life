import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {contentHash,collections,deletionPayload} from '../server/content-identity.mjs';
import {prepareDeletion,verifyDeletion,deleteContent} from '../scripts/delete-content.mjs';
import {prepareSubmission,readData} from '../scripts/publish-issue.mjs';
const repository='snowhejia/usyd.life';
const maintainer={id:123,login:'maintainer'};
const permission={permission:'write'};
function fixture(t,type='event') {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'usyd-delete-'));
  fs.mkdirSync(path.join(dir,'dist'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const item={id:'issue-25',title:'待删除的测试内容',description:'test'};
  const other={id:'keep-me',title:'保留的内容'};
  const data={updatedAt:'2026-10-03',events:[],benefits:[],notices:[],foods:[]};data[collections[type]]=[item,other];
  fs.writeFileSync(path.join(dir,'dist/data.js'),'window.CAMPUS_DATA='+JSON.stringify(data)+';');
  fs.writeFileSync(path.join(dir,'dist/discussions.js'),'window.CAMPUS_DISCUSSIONS='+JSON.stringify({repository,items:{[type+':issue-25']:1,[type+':keep-me']:2}})+';');
  const payload={type,id:item.id,hash:contentHash(item),userId:123};
  const issue={number:300,title:'[删除内容] test',body:'<!-- usyd-delete:'+JSON.stringify(payload)+' -->',user:maintainer,state:'open',labels:[{name:'删除内容'}]};
  return {dir,data,item,issue,payload};
}
test('deletion removes all four types and discussion mappings, retains unrelated entries, and leaves a durable tombstone',t=>{
  for(const type of Object.keys(collections)) {
    const f=fixture(t,type),result=prepareDeletion({directory:f.dir,issue:f.issue,reviewer:'maintainer',date:'2026-10-03T01:00:00Z'});
    assert.equal(result.changed,true);assert.deepEqual(readData(f.dir)[collections[type]].map(item=>item.id),['keep-me']);
    const tombstone=JSON.parse(fs.readFileSync(path.join(f.dir,'content/deletions/'+type+'--issue-25.json'),'utf8'));
    assert.equal(tombstone.discussion,1);assert.equal(tombstone.deletedBy,'maintainer');
    assert.doesNotMatch(fs.readFileSync(path.join(f.dir,'dist/discussions.js'),'utf8'),/issue-25/);
    assert.equal(prepareDeletion({directory:f.dir,issue:f.issue,reviewer:'maintainer'}).changed,false);
  }
});
test('forged, closed, modified or deauthorized deletion requests are rejected',t=>{
  const f=fixture(t);
  assert.deepEqual(verifyDeletion(f.issue,f.issue,permission,permission),f.payload);
  for(const current of [{...f.issue,state:'closed'},{...f.issue,labels:[]},{...f.issue,pull_request:{}},{...f.issue,body:f.issue.body+'edited'},{...f.issue,user:{id:456,login:'other'}}])assert.throws(()=>verifyDeletion(f.issue,current,permission,permission));
  assert.throws(()=>verifyDeletion(f.issue,f.issue,{permission:'read'},permission));
  assert.throws(()=>verifyDeletion(f.issue,f.issue,permission,{permission:'read'}));
  assert.throws(()=>deletionPayload('<!-- usyd-delete:{"type":"__proto__","id":"../data","hash":"x","userId":1} -->'));
  assert.throws(()=>deletionPayload(f.issue.body+'\n'+f.issue.body));
  const changed=structuredClone(f.data);changed.events[0].description='updated';
  fs.writeFileSync(path.join(f.dir,'dist/data.js'),'window.CAMPUS_DATA='+JSON.stringify(changed)+';');
  assert.throws(()=>prepareDeletion({directory:f.dir,issue:f.issue,reviewer:'maintainer'}),/已更新/);
  assert.equal(readData(f.dir).events.length,2);
});
test('old approved submissions cannot resurrect deleted content, including the unchanged-hash fast path',async t=>{
  const f=fixture(t);prepareDeletion({directory:f.dir,issue:f.issue,reviewer:'maintainer'});
  const body='### 标题\n桌游\n\n### 介绍\n大家一起来玩。\n\n### 活动标签\n#免费\n\n### 主办方\n学生社团\n\n### 日期\n2026-10-10\n\n### 悉尼当地时间\n12:00\n\n### 地点\nManning\n\n### 费用\n免费\n\n### 来源\nhttps://example.com/event\n\n- [x] 信息及配图可公开展示，已附可核对的来源。';
  const issue={number:25,title:'[活动投稿] 桌游',body,user:maintainer};
  const d=readData(f.dir);d.tags={free:'免费'};fs.writeFileSync(path.join(f.dir,'dist/data.js'),'window.CAMPUS_DATA='+JSON.stringify(d)+';');
  await assert.rejects(prepareSubmission({directory:f.dir,repository,issue,reviewer:'maintainer'}),/已经删除/);
  fs.mkdirSync(path.join(f.dir,'content/submissions'),{recursive:true});
  fs.writeFileSync(path.join(f.dir,'content/submissions/25.json'),JSON.stringify({type:'event',id:'issue-25',hash:'old'}));
  await assert.rejects(prepareSubmission({directory:f.dir,repository,issue,reviewer:'maintainer'}),/已经删除/);
});
test('workflow rechecks authorization before committing and never pushes after permission loss',async t=>{
  const f=fixture(t);let checks=0,pushed=false;
  const api=async(route)=>{
    if(route==='/issues/300')return f.issue;
    if(route.startsWith('/collaborators/'))return ++checks>4?{permission:'read'}:permission;
    if(route.startsWith('/issues/300/comments'))return [];
    return {};
  };
  await assert.rejects(deleteContent({directory:f.dir,event:{issue:f.issue,repository:{full_name:repository}},repository,actor:'maintainer',token:'test',api,gitRunner:(...args)=>{if(args[0]==='push')pushed=true;return '';},argsRunner:()=>{}}),/维护者/);
  assert.equal(pushed,false);
});
test('workflow publishes a verified deletion and dispatches checks once, while keeping original GitHub discussions',async t=>{
  const f=fixture(t),calls=[],gitCalls=[];
  const api=async(route,options={})=>{calls.push([route,options]);if(route==='/issues/300')return f.issue;if(route.startsWith('/collaborators/'))return permission;if(route.startsWith('/issues/300/comments')&&!options.method)return [];return {};};
  const result=await deleteContent({directory:f.dir,event:{issue:f.issue,repository:{full_name:repository}},repository,actor:'maintainer',token:'test',api,gitRunner:(...args)=>{gitCalls.push(args);return '';},argsRunner:()=>{}});
  assert.equal(result.changed,true);assert.equal(gitCalls.filter(args=>args[0]==='push').length,1);
  assert.ok(calls.some(([route])=>route==='/actions/workflows/ci.yml/dispatches'));
  assert.ok(!calls.some(([,options])=>options.method==='DELETE'));
});
