import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {StatsStore} from './store.mjs';
import {createSiteServer} from './server.mjs';

test('content likes are independent, idempotent and persistent without inflating site statistics',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'usyd-content-'));
  const filename=path.join(directory,'stats.sqlite3');
  let store=new StatsStore(filename);
  try {
    assert.deepEqual(store.likeContent('event','same-id','alice',true),{likes:1,liked:true});
    assert.deepEqual(store.likeContent('event','same-id','alice',true),{likes:1,liked:true});
    assert.deepEqual(store.readContentLikes('food','same-id','alice'),{likes:0,liked:false});
    assert.deepEqual(store.readContentLikes('event','another-id','alice'),{likes:0,liked:false});
    assert.deepEqual(store.readContentLikes('event','same-id','bob'),{likes:1,liked:false});
    store.likeContent('event','same-id','bob',true);
    store.likeContent('food','same-id','alice',true);
    assert.equal(store.read().likes,0);
    assert.equal(store.read().totalVisits,0);
    store.close();
    store=new StatsStore(filename);
    assert.deepEqual(store.readContentLikes('event','same-id','alice'),{likes:2,liked:true});
    assert.deepEqual(store.likeContent('event','same-id','alice',false),{likes:1,liked:false});
    assert.deepEqual(store.likeContent('event','same-id','alice',false),{likes:1,liked:false});
    assert.deepEqual(store.readContentLikes('food','same-id','alice'),{likes:1,liked:true});
  } finally {store.close();rmSync(directory,{recursive:true});}
});

test('all four detail types support cookie-scoped likes and GitHub comments; invalid writes are rejected',async()=>{
  const calls=[];
  const commentsFetch=async url=>{
    calls.push(url);
    return Response.json([{id:101,user:{login:'reader'},created_at:'2026-10-03T01:00:00Z',body_html:'<p>Thanks!</p>'}]);
  };
  const server=createSiteServer({database:':memory:',commentsFetch});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let cookie;
  const get=route=>fetch(base+route,{headers:cookie?{Cookie:cookie}:{}});
  const post=(route,body,origin=base)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie || ''},body:JSON.stringify(body)});
  try {
    const identity=await get('/api/stats');
    cookie=identity.headers.get('set-cookie').split(';')[0];
    for(const [type,id] of [['event','gelato'],['benefit','canva'],['notice','daylight-saving-2026'],['food','kura-ichi']]) {
      const prefix='/api/content/'+type+'/'+id;
      assert.deepEqual(await (await get(prefix+'/likes')).json(),{likes:0,liked:false});
      const responses=await Promise.all(Array.from({length:6},()=>post(prefix+'/likes',{liked:true})));
      for(const response of responses)assert.deepEqual(await response.json(),{likes:1,liked:true});
      assert.deepEqual(await (await get(prefix+'/likes')).json(),{likes:1,liked:true});
      const other=await fetch(base+prefix+'/likes');
      assert.deepEqual(await other.json(),{likes:1,liked:false});
      assert.equal((await post(prefix+'/likes',{liked:'yes'})).status,400);
      assert.equal((await post(prefix+'/likes',{liked:true},'https://other.example')).status,403);
      assert.equal((await fetch(base+prefix+'/likes',{method:'DELETE'})).status,405);
      assert.deepEqual(await (await post(prefix+'/likes',{liked:false})).json(),{likes:0,liked:false});
      const comments=await (await get(prefix+'/comments')).json();
      assert.equal(comments.items[0].author,'reader');
      assert.match(comments.items[0].url,/^https:\/\/github\.com\/snowhejia\/usyd\.life\/issues\/\d+#issuecomment-101$/);
      assert.equal(comments.items[0].html,'<p>Thanks!</p>');
      assert.equal(comments.nextPage,null);
      assert.equal((await post(prefix+'/comments',{text:'test'})).status,405);
      assert.equal((await get(prefix+'/comments?page=-1')).status,400);
      assert.equal((await get(prefix+'/comments?page=1.5')).status,400);
    }
    assert.equal(calls.length,4);
    assert.equal((await get('/api/content/event/missing/likes')).status,404);
    assert.equal((await get('/api/content/event/missing/comments')).status,404);
    assert.equal((await post('/api/content/food/missing/likes',{liked:true})).status,404);
    const stats=await (await get('/api/stats')).json();
    assert.equal(stats.likes,0);
    assert.equal(stats.totalVisits,0);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
