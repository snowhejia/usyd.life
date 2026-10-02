import {randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';

export const fail=(status,message)=>Object.assign(new Error(message),{status});
export const digest=value=>createHash('sha256').update(value).digest('hex');
const random=()=>randomBytes(32).toString('base64url');
export function cookie(req,name) {
  return (req.headers.cookie || '').split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1) || '';
}
function setCookie(res,name,value,seconds,secure) {
  const existing=res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:[existing]),`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`]);
}
export function returnPath(value) {
  if(typeof value!=='string' || !/^\/(?:detail|guestbook|submit)\.html(?:\?[^#]*)?$/.test(value) || /[\\\r\n]/.test(value))return '/guestbook.html';
  return value.slice(0,1000);
}
export class GitHubAuth {
  constructor(db,{clientId=process.env.GITHUB_CLIENT_ID,clientSecret=process.env.GITHUB_CLIENT_SECRET,repositoryId=process.env.GITHUB_REPOSITORY_ID,origin=process.env.PUBLIC_ORIGIN,fetcher=fetch,clock=()=>Date.now()}={}) {
    Object.assign(this,{db,clientId,clientSecret,fetcher,clock});
    this.repositoryId=Number(repositoryId);
    this.origin=origin?new URL(origin).origin:'';
    this.configured=Boolean(clientId&&clientSecret&&this.origin&&Number.isSafeInteger(this.repositoryId)&&this.repositoryId>0);
    this.secure=this.origin.startsWith('https:');
    if(this.configured && !this.secure && !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(this.origin))throw new Error('GitHub login requires an HTTPS origin');
    this.key=createHash('sha256').update(clientSecret || 'unconfigured').digest();
    db.exec(`CREATE TABLE IF NOT EXISTS auth_states (id TEXT PRIMARY KEY,verifier TEXT NOT NULL,return_to TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,login TEXT NOT NULL,token TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS community_writes (user_id INTEGER NOT NULL,request_id TEXT NOT NULL,route TEXT NOT NULL,hash TEXT NOT NULL,result TEXT,created INTEGER NOT NULL,PRIMARY KEY(user_id,request_id));`);
    this.clean();
  }
  clean() {
    this.db.prepare('DELETE FROM auth_states WHERE expires<=?').run(this.clock());
    this.db.prepare('DELETE FROM auth_sessions WHERE expires<=?').run(this.clock());
    // Keep write receipts: an old retry must never create a duplicate GitHub record.
  }
  seal(token) {
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);
    const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
  }
  unseal(value) {
    const bytes=Buffer.from(value,'base64url'),decipher=createDecipheriv('aes-256-gcm',this.key,bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
  }
  session(req) {
    if(!this.configured)return null;
    const id=cookie(req,'usyd_session');
    if(!/^[\w-]{43}$/.test(id))return null;
    const row=this.db.prepare('SELECT * FROM auth_sessions WHERE id=? AND expires>?').get(digest(id),this.clock());
    if(!row)return null;
    try{return {id:row.id,user:{id:row.user_id,login:row.login},csrf:row.csrf,token:this.unseal(row.token)};}
    catch{this.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(row.id);return null;}
  }
  require(req) {
    const session=this.session(req);
    if(!session)throw fail(401,'请先使用 GitHub 登录。');
    const supplied=req.headers['x-csrf-token'] || '';
    if(req.headers.origin!==this.origin || req.headers['sec-fetch-site']==='cross-site' || typeof supplied!=='string' || !/^[\w-]{43}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(session.csrf)))throw fail(403,'登录校验失效，请刷新页面后重试。');
    return session;
  }
  start(req,res,value) {
    if(!this.configured)throw fail(503,'站内登录暂未开放。');
    this.clean();
    const state=random(),verifier=random();
    this.db.prepare('INSERT INTO auth_states VALUES(?,?,?,?)').run(digest(state),verifier,returnPath(value),this.clock()+600000);
    setCookie(res,'usyd_oauth',state,600,this.secure);
    const url=new URL('https://github.com/login/oauth/authorize');
    for(const [key,val] of Object.entries({client_id:this.clientId,redirect_uri:this.origin+'/auth/github/callback',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))url.searchParams.set(key,val);
    return url.href;
  }
  async callback(req,res,url) {
    if(!this.configured)throw fail(503,'站内登录暂未开放。');
    const state=url.searchParams.get('state') || '';
    if(!/^[\w-]{43}$/.test(state) || cookie(req,'usyd_oauth')!==state)throw fail(400,'登录请求已失效，请重新登录。');
    const pending=this.db.prepare('DELETE FROM auth_states WHERE id=? RETURNING *').get(digest(state));
    setCookie(res,'usyd_oauth','',0,this.secure);
    if(!pending || pending.expires<=this.clock())throw fail(400,'登录请求已过期，请重新登录。');
    const destination=pending.return_to;
    if(url.searchParams.has('error'))return destination+(destination.includes('?')?'&':'?')+'login=cancelled';
    const code=url.searchParams.get('code');
    if(!code || code.length>512)throw fail(400,'登录请求无效。');
    try {
      const response=await this.fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:this.clientId,client_secret:this.clientSecret,code,redirect_uri:this.origin+'/auth/github/callback',code_verifier:pending.verifier,repository_id:this.repositoryId}),signal:AbortSignal.timeout(10000),redirect:'error'});
      const data=await response.json();
      if(!response.ok || typeof data.access_token!=='string' || data.error)throw new Error('Token exchange failed');
      const identity=await this.fetcher('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+data.access_token,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'usyd.life'},signal:AbortSignal.timeout(10000),redirect:'error'});
      const user=await identity.json();
      if(!identity.ok || !Number.isSafeInteger(user.id) || !/^[-a-zA-Z0-9]+$/.test(user.login || ''))throw new Error('Identity invalid');
      const sessionId=random(),csrf=random();
      const seconds=Math.max(1,Math.min(28800,Number(data.expires_in)||28800));
      const old=this.session(req);
      if(old)this.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(old.id);
      this.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?,?)').run(digest(sessionId),user.id,user.login,this.seal(data.access_token),csrf,this.clock()+seconds*1000);
      setCookie(res,'usyd_session',sessionId,seconds,this.secure);
      return destination;
    } catch {return destination+(destination.includes('?')?'&':'?')+'login=failed';}
  }
  logout(req,res) {
    const session=this.require(req);
    this.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(session.id);
    setCookie(res,'usyd_session','',0,this.secure);
  }
}
