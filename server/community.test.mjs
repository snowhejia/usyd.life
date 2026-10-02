import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createSiteServer} from './server.mjs';
import {returnPath} from './auth.mjs';
import {writeTestContent} from './test-fixture.mjs';

async function fixture(t,{persist=false}={}) {
  let now=Date.now(),admin=true,failAfterWrite=false,revoked=false;
  const dir=mkdtempSync(path.join(tmpdir(),'usyd-community-')),database=persist?path.join(dir,'test.sqlite3'):':memory:';
  const staticDir=writeTestContent(path.join(dir,'dist'));
  const comments=[],issues=[],calls=[];let lastExchange;
  const users={student:{id:101,login:'student'},maintainer:{id:102,login:'maintainer'}};
  const fetcher=async(url,options={})=>{
    calls.push({url,method:options.method || 'GET'});
    if(url==='https://github.com/login/oauth/access_token') {lastExchange=JSON.parse(options.body);return Response.json({access_token:lastExchange.code,expires_in:28800});}
    const token=options.headers?.Authorization?.replace('Bearer ','');
    const user=users[token];
    if(revoked&&token)return Response.json({}, {status:401});
    if(url==='https://api.github.com/user')return Response.json(user || {},{status:user?200:401});
    const route=new URL(url).pathname.replace('/repos/snowhejia/usyd.life',''),method=options.method || 'GET',body=options.body?JSON.parse(options.body):{};
    if(!route)return Response.json({permissions:{push:user?.id===102&&admin}});
    if(route==='/issues' && method==='POST') {
      const item={id:issues.length+500,number:issues.length+200,...body,user,state:'open',created_at:new Date(now).toISOString()};issues.unshift(item);
      if(failAfterWrite){failAfterWrite=false;throw new Error('Connection lost after write');}return Response.json(item,{status:201});
    }
    if(route==='/issues')return Response.json(issues);
    const issue=route.match(/^\/issues\/(\d+)$/);
    if(issue){const item=issues.find(item=>item.number===Number(issue[1]));if(!item)return Response.json({},{status:404});if(method==='PATCH')Object.assign(item,body);return Response.json(item);}
    const list=route.match(/^\/issues\/(\d+)\/comments$/);
    if(list) {
      if(method==='POST') {
        const item={id:comments.length+1000,user,body:body.body,created_at:new Date(now).toISOString(),issue_url:'https://api.github.com/repos/snowhejia/usyd.life/issues/'+list[1]};comments.push(item);
        if(failAfterWrite){failAfterWrite=false;throw new Error('Connection lost after write');}return Response.json(item,{status:201});
      }
      return Response.json(comments.filter(item=>item.issue_url.endsWith('/'+list[1])));
    }
    const comment=route.match(/^\/issues\/comments\/(\d+)$/);
    if(comment) {const index=comments.findIndex(item=>item.id===Number(comment[1]));if(index<0)return Response.json({},{status:404});if(method==='DELETE'){comments.splice(index,1);return new Response(null,{status:204});}return Response.json(comments[index]);}
    throw new Error('Unexpected fake GitHub request '+method+' '+route);
  };
  let server,base;
  async function start(){server=createSiteServer({database,staticDir,githubFetch:fetcher,commentsFetch:fetcher,authOptions:{clientId:'test-client',repositoryId:1402408149,clientSecret:'test-secret-never-public',origin:'http://localhost',clock:()=>now}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;}
  await start();t.after(async()=>{await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});});
  const get=(route,cookie='')=>fetch(base+route,{headers:{Cookie:cookie},redirect:'manual'});
  const write=(route,body,session={},method='POST',headers={})=>fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost',Cookie:session.cookie || '','X-CSRF-Token':session.csrf || '',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  async function begin(returnTo='/guestbook.html') {const response=await get('/auth/github/start?returnTo='+encodeURIComponent(returnTo));return {response,oauth:new URL(response.headers.get('location')),cookie:response.headers.getSetCookie()[0].split(';')[0]};}
  async function login(name='student') {
    const login=await begin();
    const response=await get('/auth/github/callback?code='+name+'&state='+login.oauth.searchParams.get('state'),login.cookie);
    const cookie=response.headers.getSetCookie().find(value=>value.startsWith('usyd_session=')).split(';')[0];
    const session=await (await get('/api/session',cookie)).json();return {...session,cookie};
  }
  return {get,write,begin,login,comments,issues,calls,database,users,fetcher,get exchange(){return lastExchange;},tick:()=>now+=6000,revoke:()=>revoked=true,demote:()=>admin=false,timeout:()=>failAfterWrite=true,expire:()=>now+=28800001,restart:async()=>{await new Promise(resolve=>server.close(resolve));await start();}};
}
test('GitHub login binds a single-use state and PKCE, encrypts persistent sessions, and rejects open redirects',async t=>{
  const f=await fixture(t,{persist:true}),login=await f.begin('https://evil.example');
  assert.equal(login.oauth.searchParams.get('code_challenge_method'),'S256');
  assert.equal((await f.get('/auth/github/callback?code=student&state='+login.oauth.searchParams.get('state'))).status,400);
  const callback='/auth/github/callback?code=student&state='+login.oauth.searchParams.get('state');
  const response=await f.get(callback,login.cookie);assert.equal(response.headers.get('location'),'/guestbook.html');
  assert.equal(f.exchange.repository_id,1402408149);
  assert.equal(createHash('sha256').update(f.exchange.code_verifier).digest('base64url'),login.oauth.searchParams.get('code_challenge'));
  assert.equal((await f.get(callback,login.cookie)).status,400);
  const session=await f.login(),db=new DatabaseSync(f.database);
  assert.ok(!db.prepare('SELECT token FROM auth_sessions LIMIT 1').get().token.includes('student'));db.close();
  assert.ok(!JSON.stringify(session).includes('access_token'));assert.equal(session.user.login,'student');
  await f.restart();assert.equal((await (await f.get('/api/session',session.cookie)).json()).user.id,101);
  await f.write('/api/logout',{},session);assert.equal((await (await f.get('/api/session',session.cookie)).json()).user,null);
  for(const route of ['//evil.example','/\\evil.example','/detail.html\r\nLocation: bad','/auth/github/start'])assert.equal(returnPath(route),'/guestbook.html');
});
test('anonymous, cross-origin, missing-CSRF and expired sessions cannot submit or delete',async t=>{
  const f=await fixture(t),s=await f.login();
  const route='/api/content/event/gelato/comments',body={text:'你好',requestId:randomUUID()};
  assert.equal((await f.write(route,body)).status,401);
  assert.equal((await f.write(route,body,s,'POST',{'X-CSRF-Token':''})).status,403);
  assert.equal((await f.write(route,body,s,'POST',{'X-CSRF-Token':'é'.repeat(43)})).status,403);
  assert.equal((await f.write(route,body,s,'POST',{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.write(route,body,s,'POST',{Origin:''})).status,403);
  assert.equal((await f.write('/api/guestbook/200',undefined,{},'DELETE')).status,401);
  f.expire();assert.equal((await f.write(route,body,s)).status,401);assert.equal(f.comments.length,0);
});
test('all content types submit as the logged-in user; duplicate retries and ambiguous timeouts never double-post',async t=>{
  const f=await fixture(t),s=await f.login();
  for(const [type,id] of [['event','gelato'],['benefit','canva'],['notice','daylight-saving-2026'],['food','kura-ichi']]) {
    f.tick();const route='/api/content/'+type+'/'+id+'/comments',body={text:'一起去看看！',requestId:randomUUID()};
    assert.equal((await f.get(route)).status,200);
    const first=await f.write(route,body,s),value=await first.json();assert.equal(first.status,201);assert.equal(value.userId,101);
    assert.equal((await (await f.get(route)).json()).items.length,1);
    assert.equal((await (await f.write(route,body,s)).json()).id,value.id);
    assert.equal((await f.write(route,{...body,text:'different'},s)).status,409);
  }
  assert.equal(f.comments.length,4);f.tick();f.timeout();
  const body={text:'网络中断后的同一条评论',requestId:randomUUID()},route='/api/content/food/kura-ichi/comments';
  assert.equal((await f.write(route,body,s)).status,503);
  assert.equal((await f.write(route,body,s)).status,201);assert.equal(f.comments.length,5);
  assert.equal((await f.write(route,{text:'',requestId:randomUUID()},s)).status,400);
  assert.equal((await f.write(route,{text:'x'.repeat(4001),requestId:randomUUID()},s)).status,400);
});
test('only authors and maintainers can remove comments; the issue and content must match',async t=>{
  const f=await fixture(t),s=await f.login(),admin=await f.login('maintainer'),route='/api/content/event/gelato/comments';
  f.comments.push({id:9000,user:{id:555,login:'other'},body:'other',issue_url:'https://api.github.com/repos/snowhejia/usyd.life/issues/1'});
  assert.equal((await f.write(route+'/9000',undefined,s,'DELETE')).status,403);
  assert.equal((await f.write('/api/content/food/kura-ichi/comments/9000',undefined,admin,'DELETE')).status,404);
  f.demote();assert.equal((await f.write(route+'/9000',undefined,admin,'DELETE')).status,403);
  const item=await (await f.write(route,{text:'mine',requestId:randomUUID()},s)).json();
  assert.equal((await f.write(route+'/'+item.id,undefined,s,'DELETE')).status,200);
  assert.equal(f.comments.length,1);
});
test('guestbook publishes Issues, recovers failed responses and only closes an authorized guestbook entry',async t=>{
  const f=await fixture(t),s=await f.login();
  const body={title:'校园生活',text:'有空来聊聊。',requestId:randomUUID()};f.timeout();
  assert.equal((await f.write('/api/guestbook',body,s)).status,503);
  const created=await (await f.write('/api/guestbook',body,s)).json();assert.equal(f.issues.length,1);assert.equal(created.title,'校园生活');
  assert.equal((await (await f.get('/api/guestbook')).json()).items.length,1);
  f.issues.push({id:700,number:500,title:'[留言] other',state:'open',user:{id:555}});
  assert.equal((await f.write('/api/guestbook/500',undefined,s,'DELETE')).status,403);
  f.issues.push({id:701,number:501,title:'[活动投稿] test',state:'open',user:s.user});
  assert.equal((await f.write('/api/guestbook/501',undefined,s,'DELETE')).status,404);
  assert.equal((await f.write('/api/guestbook/'+created.number,undefined,s,'DELETE')).status,200);
  assert.equal(f.issues.find(item=>item.number===created.number).state,'closed');
  assert.ok(!(await (await f.get('/api/guestbook')).json()).items.some(item=>item.number===created.number));
});
test('content deletion checks current permissions and snapshot, uses an auditable Issue, and deduplicates requests',async t=>{
  const f=await fixture(t),student=await f.login(),admin=await f.login('maintainer'),route='/api/content/event/gelato';
  assert.equal((await f.get(route+'/manage',student.cookie)).status,403);
  const {hash}=await (await f.get(route+'/manage',admin.cookie)).json();
  const body={hash,reason:'重复投稿',requestId:randomUUID()};
  assert.equal((await f.write(route+'/delete',body,student)).status,403);
  assert.equal((await f.write(route+'/delete',{...body,hash:'outdated'},admin)).status,409);
  const first=await f.write(route+'/delete',body,admin);assert.equal(first.status,202);
  const result=await first.json();assert.equal(result.pending,true);assert.match(result.url,/github\.com\/snowhejia\/usyd\.life\/issues\/\d+$/);
  await f.write(route+'/delete',body,admin);assert.equal(f.issues.length,1);assert.deepEqual(f.issues[0].labels,['删除内容']);
  assert.match(f.issues[0].body,/usyd-delete:/);f.demote();
  assert.equal((await f.write(route+'/delete',body,admin)).status,403);
  assert.equal((await f.get('/detail.html?type=event&id=not-found')).status,404);
});
test('revoking the GitHub token invalidates the server session and prevents further writes',async t=>{
  const f=await fixture(t),s=await f.login();f.revoke();
  const current=await (await f.get('/api/session',s.cookie)).json();
  assert.equal(current.user,null);assert.equal(current.configured,true);
  assert.equal((await f.write('/api/guestbook',{title:'test',text:'test',requestId:randomUUID()},s)).status,401);
});
