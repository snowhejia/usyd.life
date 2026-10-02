import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubComments} from './comments.mjs';

const record={id:12,user:{login:'student'},created_at:'2026-10-03T00:00:00Z',body_html:'<p>Hello</p>',body:'Hello'};
test('GitHub reads are coalesced and cached; pagination and manual refresh work',async()=>{
  let now=0;
  let calls=0;
  let release;
  const first=new Promise(resolve=>{release=resolve;});
  const service=new GitHubComments('snowhejia/usyd.life',{clock:()=>now,token:'test-read-token',fetcher:async(url,options)=>{
    calls++;
    assert.match(url,/^https:\/\/api.github.com\/repos\/snowhejia\/usyd.life\/issues\/7\/comments\?per_page=20&page=[12]$/);
    assert.equal(options.headers.Authorization,'Bearer test-read-token');
    assert.equal(options.headers.Accept,'application/vnd.github.html+json');
    if(calls===1)await first;
    return Response.json([record,{...record,id:13,minimized:true}],{headers:{Link:'<https://api.github.com/example?page=2>; rel="next"'}});
  }});
  const pending=Array.from({length:8},()=>service.read(7));
  release();
  const results=await Promise.all(pending);
  assert.equal(calls,1);
  assert.equal(results[0].items.length,1);
  assert.equal(results[0].items[0].url,'https://github.com/snowhejia/usyd.life/issues/7#issuecomment-12');
  assert.equal(results[0].nextPage,2);
  await service.read(7,1,true);
  assert.equal(calls,1);
  now=30001;
  await service.read(7,1,true);
  assert.equal(calls,2);
  await service.read(7,2);
  assert.equal(calls,3);
  now=220000;
  await service.read(7);
  assert.equal(calls,4);
});

test('temporary GitHub failure serves marked stale content; rate limits back off',async()=>{
  let now=0;
  let mode='ok';
  let calls=0;
  const service=new GitHubComments('snowhejia/usyd.life',{clock:()=>now,token:'',fetcher:async()=>{
    calls++;
    if(mode==='offline')throw new Error('Network failed');
    if(mode==='limited')return new Response('',{status:429,headers:{'x-ratelimit-reset':'300'}});
    return Response.json([record]);
  }});
  await service.read(1);
  mode='offline';now=180001;
  assert.equal((await service.read(1)).stale,true);
  mode='limited';now=220000;
  assert.equal((await service.read(1)).stale,true);
  const before=calls;
  await assert.rejects(service.read(2),{status:503});
  assert.equal(calls,before);
  mode='ok';now=300001;
  assert.equal((await service.read(1)).stale,false);
});

test('deleted or private discussions discard stale cache and failed loads can recover',async()=>{
  let now=0;
  let status=200;
  const service=new GitHubComments('snowhejia/usyd.life',{clock:()=>now,fetcher:async()=>status===200?Response.json([record]):new Response('',{status})});
  await service.read(1);
  now=180001;status=404;
  await assert.rejects(service.read(1),{status:503});
  assert.equal(service.cache.size,0);
  assert.equal(service.pending.size,0);
  status=500;
  await assert.rejects(service.read(1),{status:503});
  status=200;
  assert.equal((await service.read(1)).items.length,1);
});
