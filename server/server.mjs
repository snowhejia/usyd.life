import http from 'node:http';
import {createReadStream,readFileSync} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {StatsStore} from './store.mjs';
import {runInNewContext} from 'node:vm';
import {GitHubComments} from './comments.mjs';
import {GitHubAuth} from './auth.mjs';
import {GitHubCommunity} from './community.mjs';
import {collections,contentHash} from './content-identity.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(res,status,payload) {
  const body=JSON.stringify(payload);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});
  res.end(body);
}
function fail(status,message) { return Object.assign(new Error(message),{status}); }
async function readJson(req,limit=1024) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail(415,'请使用 JSON 请求。');
  if (Number(req.headers['content-length'])>limit) throw fail(413,'请求过大。');
  const chunks=[];
  let length=0;
  for await (const chunk of req) {
    length+=chunk.length;
    if (length>limit) throw fail(413,'请求过大。');
    chunks.push(chunk);
  }
  try {
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body!=='object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw fail(400,'请求格式有误。'); }
}
function visitorFor(req,res,secret) {
  const signature=id=>createHmac('sha256',secret).update(id).digest('hex');
  const token=(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('usyd_visitor='))?.slice(13) || '';
  let [id,sig]=token.split('.');
  const valid=uuid.test(id || '') && /^[a-f0-9]{64}$/.test(sig || '') && timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(id),'hex'));
  if (!valid) {
    id=randomUUID();
    const secure=req.socket.encrypted || req.headers['x-forwarded-proto']?.split(',')[0].trim()==='https';
    res.setHeader('Set-Cookie',`usyd_visitor=${id}.${signature(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure?'; Secure':''}`);
  }
  return createHash('sha256').update(id).digest('hex');
}
function checkOrigin(req,configuredOrigin) {
  if (req.headers['sec-fetch-site']==='cross-site') throw fail(403,'不允许跨站请求。');
  if (req.headers.origin) {
    let origin;
    try { origin=new URL(req.headers.origin); } catch { throw fail(403,'来源不正确。'); }
    const expectedHost=(configuredOrigin || process.env.PUBLIC_ORIGIN) ? new URL(configuredOrigin || process.env.PUBLIC_ORIGIN).host : req.headers.host;
    if (origin.host!==expectedHost || !['http:','https:'].includes(origin.protocol)) throw fail(403,'不允许跨站请求。');
  }
}

export function createSiteServer({database=path.join(process.env.DATA_DIR || path.join(root,'.data'),'stats.sqlite3'),staticDir=path.join(root,'dist'),clock,commentsFetch,githubFetch,authOptions}={}) {
  const content={window:{}};
  runInNewContext(readFileSync(path.join(staticDir,'data.js'),'utf8'),content,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
  runInNewContext(readFileSync(path.join(staticDir,'discussions.js'),'utf8'),content,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
  const items=new Map(Object.entries(collections).flatMap(([type,collection])=>(content.window.CAMPUS_DATA?.[collection] || []).map(item=>[type+':'+item.id,item])));
  const contentIds=new Set(items.keys());
  const discussions=content.window.CAMPUS_DISCUSSIONS;
  const comments=new GitHubComments(discussions.repository,{fetcher:commentsFetch});
  const store=new StatsStore(database,clock);
  const auth=new GitHubAuth(store.db,{fetcher:githubFetch,...authOptions});
  const community=new GitHubCommunity({repository:discussions.repository,auth,comments,items,discussions:discussions.items,fetcher:githubFetch,clock:auth.clock});
  const server=http.createServer({requestTimeout:10000,headersTimeout:10000,maxHeaderSize:16384},async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    try {
      const url=new URL(req.url,'http://local');
      if (url.pathname==='/api/health' && req.method==='GET') return json(res,200,{ok:true});
      if(url.pathname.startsWith('/auth/')) {
        res.setHeader('Cache-Control','no-store');
        if(req.method!=='GET')throw fail(405,'不支持该请求方式。');
        const destination=url.pathname==='/auth/github/start'?auth.start(req,res,url.searchParams.get('returnTo')):url.pathname==='/auth/github/callback'?await auth.callback(req,res,url):null;
        if(!destination)throw fail(404,'页面不存在。');
        res.writeHead(303,{Location:destination});return res.end();
      }
      if (url.pathname.startsWith('/api/')) {
        checkOrigin(req,auth.origin);
        if(url.pathname==='/api/session' && req.method==='GET') {
          const session=auth.session(req);
          const canManage=session?await community.canManage(session):false;
          const current=auth.session(req);
          return json(res,200,{configured:auth.configured,user:current?.user || null,csrf:current?.csrf || null,canManage:!!current&&canManage});
        }
        if(url.pathname==='/api/logout' && req.method==='POST') {auth.logout(req,res);return json(res,200,{ok:true});}
        if(url.pathname==='/api/guestbook') {
          if(req.method==='POST')return json(res,201,await community.postGuestbook(auth.require(req),await readJson(req,24000)));
          if(req.method!=='GET')throw fail(405,'不支持该请求方式。');
          const page=Number(url.searchParams.get('page') || 1);
          if(!Number.isSafeInteger(page)||page<1||page>100)throw fail(400,'页码无效。');
          return json(res,200,await community.guestbook(page,url.searchParams.get('refresh')==='1'));
        }
        const guest=url.pathname.match(/^\/api\/guestbook\/([1-9]\d*)$/);
        if(guest && req.method==='DELETE')return json(res,200,await community.withdrawGuestbook(auth.require(req),Number(guest[1])));
        const target=url.pathname.match(/^\/api\/content\/(event|benefit|notice|food)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(likes|comments|manage|delete)(?:\/([1-9]\d*))?$/);
        if (target) {
          const [,type,id,action,commentId]=target;
          if (!contentIds.has(type+':'+id)) return json(res,404,{error:'没有找到这条内容。'});
          if(commentId) {
            if(action!=='comments'||req.method!=='DELETE')throw fail(405,'不支持该请求方式。');
            return json(res,200,await community.deleteComment(auth.require(req),type,id,Number(commentId)));
          }
          if(action==='manage' || action==='delete') {
            const session=action==='delete'?auth.require(req):auth.session(req);
            if(!session)throw fail(401,'请先使用 GitHub 登录。');
            if(action==='manage' && req.method==='GET'){await community.requireManager(session);return json(res,200,{hash:contentHash(items.get(type+':'+id))});}
            if(action==='delete' && req.method==='POST')return json(res,202,await community.deleteContent(session,type,id,await readJson(req,6000)));
            throw fail(405,'不支持该请求方式。');
          }
          if (action==='comments') {
            if(req.method==='POST')return json(res,201,await community.postComment(auth.require(req),type,id,await readJson(req,24000)));
            if (req.method!=='GET') return json(res,405,{error:'不支持该请求方式。'});
            const issue=discussions.items[type+':'+id];
            if (!Number.isSafeInteger(issue) || issue<1) return json(res,404,{error:'评论区准备中。'});
            const page=Number(url.searchParams.get('page') || 1);
            if (!Number.isSafeInteger(page) || page<1 || page>100) throw fail(400,'页码无效。');
            return json(res,200,await comments.read(issue,page,url.searchParams.get('refresh')==='1'));
          }
          if (!['GET','POST'].includes(req.method)) return json(res,405,{error:'不支持该请求方式。'});
          if (req.method==='GET') return json(res,200,store.readContentLikes(type,id,visitorFor(req,res,store.secret)));
          const body=await readJson(req);
          if (typeof body.liked!=='boolean') throw fail(400,'点赞状态无效。');
          return json(res,200,store.likeContent(type,id,visitorFor(req,res,store.secret),body.liked));
        }
        if (!['/api/stats','/api/visits','/api/like'].includes(url.pathname)) return json(res,404,{error:'接口不存在。'});
        const reading=url.pathname==='/api/stats' && req.method==='GET';
        if (!reading && req.method!=='POST') return json(res,405,{error:'不支持该请求方式。'});
        const body=reading ? {} : await readJson(req);
        if (url.pathname==='/api/visits' && !uuid.test(body.requestId || '')) throw fail(400,'访问标识无效。');
        if (url.pathname==='/api/like' && typeof body.liked!=='boolean') throw fail(400,'点赞状态无效。');
        const visitor=visitorFor(req,res,store.secret);
        const result=url.pathname==='/api/visits' ? store.visit(visitor) : url.pathname==='/api/like' ? store.like(visitor,body.liked) : store.read(visitor);
        return json(res,200,result);
      }
      if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'不支持该请求方式。'});
      let relative;
      try { relative=decodeURIComponent(url.pathname); } catch { throw fail(400,'路径无效。'); }
      if (relative.includes('\0') || relative.split('/').some(part=>part.startsWith('.'))) throw fail(404,'页面不存在。');
      const filename=path.resolve(staticDir,'.'+(relative.endsWith('/')?relative+'index.html':relative));
      if (!filename.startsWith(path.resolve(staticDir)+path.sep)) throw fail(404,'页面不存在。');
      let info,actual;
      try { [info,actual]=await Promise.all([stat(filename),realpath(filename)]); } catch { throw fail(404,'页面不存在。'); }
      if (!info.isFile() || !actual.startsWith(path.resolve(staticDir)+path.sep) || !mime[path.extname(filename)]) throw fail(404,'页面不存在。');
      const missing=relative==='/detail.html' && url.searchParams.has('id') && !contentIds.has((url.searchParams.get('type') || 'event')+':'+url.searchParams.get('id'));
      const etag=`W/"${info.size}-${Math.trunc(info.mtimeMs)}${missing?'-missing':''}"`;
      res.setHeader('ETag',etag);
      res.setHeader('Cache-Control','no-cache');
      if (req.headers['if-none-match']===etag) { res.writeHead(304); return res.end(); }
      res.writeHead(missing?404:200,{'Content-Type':mime[path.extname(filename)],'Content-Length':info.size});
      if (req.method==='HEAD') return res.end();
      const stream=createReadStream(filename);
      stream.on('error',()=>res.destroy());
      stream.pipe(res);
    } catch(error) {
      if (!res.headersSent) json(res,error.status || 500,{error:error.status?error.message:'暂时无法读取数据，请稍后重试。'});
      else res.destroy();
      if (!error.status) console.error('Request failed:',error.message);
    }
  });
  server.on('close',()=>store.close());
  return server;
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const port=Number(process.env.PORT || 4173);
  const host=process.env.HOST || '127.0.0.1';
  const server=createSiteServer();
  server.listen(port,host,()=>console.log(`USYD EVENTS WALL running at http://${host}:${port}`));
  const stop=()=>server.close(()=>process.exit(0));
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
}
