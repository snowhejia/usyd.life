import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {StatsStore,sydneyDay} from './store.mjs';
import {createSiteServer} from './server.mjs';

test('total visitors are unique across refreshes and days; daily visitors follow Sydney dates',()=>{
  let now=new Date('2026-10-03T13:59:59Z');
  const db=new StatsStore(':memory:',()=>now);
  try {
    assert.equal(sydneyDay(now),'2026-10-03');
    const first=db.visit('browser-a');
    assert.equal(first.todayVisitors,1);
    assert.equal(first.totalVisits,1);
    db.visit('browser-a');
    assert.equal(db.read().totalVisits,1);
    const refresh=db.visit('browser-a');
    assert.equal(refresh.todayVisitors,1);
    assert.equal(refresh.totalVisits,1);
    const secondVisitor=db.visit('browser-b');
    assert.equal(secondVisitor.todayVisitors,2);
    assert.equal(secondVisitor.totalVisits,2);
    now=new Date('2026-10-03T14:00:00Z');
    const midnight=db.visit('browser-a');
    assert.equal(midnight.date,'2026-10-04');
    assert.equal(midnight.todayVisitors,1);
    assert.equal(midnight.totalVisits,2);
    assert.equal(midnight.runningDays,2);
    now=new Date('2026-10-04T13:30:00Z');
    assert.equal(db.read().date,'2026-10-05');
    assert.equal(db.read().runningDays,3);
    assert.equal(db.read().todayVisitors,0);
    assert.equal(db.read().totalVisits,2);
    assert.equal(db.visit('browser-a').todayVisitors,1);
    assert.equal(db.read().totalVisits,2);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS count FROM visits').get().count,0);
  } finally { db.close(); }
});

test('likes are idempotent, can be cancelled, and persist with statistics and signing key',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'usyd-stats-'));
  const filename=path.join(directory,'stats.sqlite3');
  let db=new StatsStore(filename,()=>new Date('2026-10-03T01:00:00Z'));
  try {
    db.visit('browser-a');
    db.like('browser-a',true);
    assert.equal(db.like('browser-a',true).likes,1);
    assert.equal(db.read('browser-a').liked,true);
    assert.equal(db.read('browser-b').liked,false);
    const secret=db.secret;
    db.close();
    db=new StatsStore(filename,()=>new Date('2026-10-06T01:00:00Z'));
    assert.equal(db.secret,secret);
    assert.equal(db.read('browser-a').liked,true);
    assert.equal(db.read().totalVisits,1);
    assert.equal(db.read().runningDays,4);
    assert.equal(db.visit('browser-a').totalVisits,1);
    db.like('browser-a',false);
    assert.equal(db.like('browser-a',false).likes,0);
  } finally { db.close(); rmSync(directory,{recursive:true}); }
});

test('legacy page views migrate to unique visitors without resetting history, likes or cookie identity',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'usyd-stats-migration-'));
  const filename=path.join(directory,'stats.sqlite3');
  const legacy=new DatabaseSync(filename);
  legacy.exec(`
    CREATE TABLE metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE visits (visitor TEXT NOT NULL,request_id TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(visitor,request_id));
    CREATE TABLE daily_visitors (day TEXT NOT NULL,visitor TEXT NOT NULL,PRIMARY KEY(day,visitor));
    CREATE TABLE likes (visitor TEXT PRIMARY KEY,created_at TEXT NOT NULL);
    INSERT INTO metadata VALUES ('started_at','2026-10-01'),('cookie_secret','legacy-test-secret');
    INSERT INTO visits VALUES
      ('browser-a','view-1','2026-10-02'),('browser-a','view-2','2026-10-03'),
      ('browser-a','view-3','2026-10-03'),('browser-b','view-4','2026-10-03');
    INSERT INTO daily_visitors VALUES ('2026-10-02','browser-a'),('2026-10-03','browser-a'),('2026-10-03','browser-b');
    INSERT INTO likes VALUES ('browser-a','2026-10-02T01:00:00Z');
  `);
  legacy.close();
  let db;
  try {
    db=new StatsStore(filename,()=>new Date('2026-10-03T01:00:00Z'));
    assert.equal(db.read().totalVisits,2);
    assert.equal(db.read().todayVisitors,2);
    assert.equal(db.read().runningDays,3);
    assert.equal(db.read().likes,1);
    assert.equal(db.read('browser-a').liked,true);
    assert.equal(db.secret,'legacy-test-secret');
    assert.equal(db.visit('browser-a').totalVisits,2);
    assert.equal(db.visit('browser-c').totalVisits,3);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS count FROM visits').get().count,4);
    db.close();
    db=new StatsStore(filename,()=>new Date('2026-10-04T01:00:00Z'));
    assert.equal(db.read().totalVisits,3);
    assert.equal(db.read().todayVisitors,0);
    assert.equal(db.visit('browser-c').totalVisits,3);
    assert.equal(db.visit('browser-c').todayVisitors,1);
    assert.equal(db.secret,'legacy-test-secret');
    assert.equal(db.read().likes,1);
  } finally { db?.close(); rmSync(directory,{recursive:true}); }
});

test('HTTP integration: cookies deduplicate concurrent page loads, retries and returning visitors',async()=>{
  const server=createSiteServer({database:':memory:'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(route,body,cookie,origin=base)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  try {
    const id=randomUUID();
    const first=await post('/api/visits',{requestId:id});
    assert.equal(first.status,200);
    const setCookie=first.headers.get('set-cookie');
    assert.match(setCookie,/HttpOnly; SameSite=Lax/);
    const cookie=setCookie.split(';')[0];
    assert.equal((await first.json()).todayVisitors,1);
    assert.equal((await (await post('/api/visits',{requestId:id},cookie)).json()).totalVisits,1);
    await Promise.all(Array.from({length:8},()=>post('/api/visits',{requestId:randomUUID()},cookie)));
    const afterViews=await (await fetch(base+'/api/stats',{headers:{Cookie:cookie}})).json();
    assert.equal(afterViews.totalVisits,1);
    assert.equal(afterViews.todayVisitors,1);
    assert.equal((await (await post('/api/like',{liked:true},cookie)).json()).likes,1);
    assert.equal((await (await post('/api/like',{liked:true},cookie)).json()).likes,1);
    const restored=await (await fetch(base+'/api/stats',{headers:{Cookie:cookie}})).json();
    assert.equal(restored.liked,true);
    const newVisitor=await (await post('/api/visits',{requestId:randomUUID()})).json();
    assert.equal(newVisitor.todayVisitors,2);
    assert.equal(newVisitor.totalVisits,2);
    const returningVisitor=await (await post('/api/visits',{requestId:randomUUID()},cookie)).json();
    assert.equal(returningVisitor.todayVisitors,2);
    assert.equal(returningVisitor.totalVisits,2);
    assert.equal((await post('/api/like',{liked:'yes'},cookie)).status,400);
    assert.equal((await post('/api/visits',{requestId:'bad'},cookie)).status,400);
    assert.equal((await post('/api/like',{liked:true},cookie,'https://example.org')).status,403);
    assert.equal((await post('/api/like',{liked:false},cookie)).status,200);
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/.data/stats.sqlite3')).status,404);
    assert.equal((await fetch(base+'/server/server.mjs')).status,404);
    assert.equal((await fetch(base+'/api/health')).status,200);
    assert.equal((await fetch(base+'/api/guestbook?page=-1')).status,400);
    assert.equal((await post('/api/guestbook',{nickname:'test',message:'test',requestId:randomUUID()},cookie)).status,401);
    assert.equal((await fetch(base+'/api/guestbook/'+randomUUID(),{method:'DELETE',headers:{Cookie:cookie,Origin:base}})).status,404);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
