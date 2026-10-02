import {fail,digest} from './auth.mjs';
import {contentHash,deletionLabel} from './content-identity.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(value,max,label)=>{
  if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(400,label+'需填写 1–'+max+' 个字。');
  return value.trim();
};
export class GitHubCommunity {
  constructor({repository,auth,comments,items,discussions,fetcher=fetch,clock=()=>Date.now(),readToken=process.env.GITHUB_READ_TOKEN || ''}) {
    Object.assign(this,{repository,auth,comments,items,discussions,fetcher,clock,readToken});
    this.running=new Set();this.guestCache=new Map();this.generation=0;
  }
  async api(route,{session,method='GET',body}={}) {
    let response;
    try {
      response=await this.fetcher('https://api.github.com/repos/'+this.repository+route,{method,headers:{Accept:'application/vnd.github.full+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'usyd.life','Content-Type':'application/json',...((session?.token || this.readToken)?{Authorization:'Bearer '+(session?.token || this.readToken)}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'});
    } catch {throw fail(503,method==='GET'?'暂时无法连接 GitHub，请稍后重试。':'暂未确认提交结果，请保留内容并重试，不要重复新建。');}
    if(!response.ok) {
      if(response.status===401 && session)this.auth.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(session.id);
      const message={401:'登录已过期，请重新登录。',403:'GitHub 暂不允许此操作，请确认授权或稍后重试。',404:'内容不存在或已删除。',422:'GitHub 未接受此内容，请检查后重试。',429:'操作太频繁，请稍后再试。'}[response.status] || 'GitHub 暂不可用，请稍后重试。';
      throw Object.assign(fail(response.status<500?response.status:503,message),{definitive:response.status<500});
    }
    return {data:response.status===204?null:await response.json(),next:/rel="next"/.test(response.headers.get('link') || '')};
  }
  async canManage(session) {
    if(!session)return false;
    try {
      const {data}=await this.api('',{session});
      return data.permissions?.admin===true || data.permissions?.push===true || data.permissions?.maintain===true;
    } catch(error) {if([401,403,404].includes(error.status))return false;throw error;}
  }
  async requireManager(session) {
    if(!await this.canManage(session))throw fail(403,'只有网站维护者可以删除已收录内容。');
  }
  record(item,issue) {
    return {id:item.id,number:item.number,author:item.user?.login || 'GitHub 用户',userId:item.user?.id,title:item.title?.replace(/^\[留言\]\s*/,''),createdAt:item.created_at,html:item.body_html || '',text:(item.body || '').replace(/<!-- usyd-write:[a-f0-9]+ -->/g,''),url:'https://github.com/'+this.repository+'/issues/'+(issue || item.number)+(issue?'#issuecomment-'+item.id:''),state:item.state};
  }
  async guestbook(page=1,refresh=false) {
    const previous=this.guestCache.get(page);
    if(previous && this.clock()-previous.time<(refresh?30000:180000))return previous.value;
    const generation=this.generation;
    const {data,next}=await this.api('/issues?state=open&sort=created&direction=desc&per_page=100&page='+page);
    if(!Array.isArray(data))throw fail(503,'留言暂时无法加载。');
    const value={items:data.filter(item=>!item.pull_request && item.title?.startsWith('[留言]') && item.state==='open').map(item=>this.record(item)),nextPage:next?page+1:null};
    if(generation===this.generation){this.guestCache.set(page,{time:this.clock(),value});if(this.guestCache.size>100)this.guestCache.delete(this.guestCache.keys().next().value);}
    return value;
  }
  async once(session,requestId,route,payload,write,recover) {
    if(!uuid.test(requestId || ''))throw fail(400,'提交标识无效，请刷新后重试。');
    const db=this.auth.db,userId=session.user.id,key=userId+':'+requestId,hash=digest(JSON.stringify(payload));
    if(this.running.has(key))throw fail(409,'正在提交，请稍候再试。');
    const previous=db.prepare('SELECT * FROM community_writes WHERE user_id=? AND request_id=?').get(userId,requestId);
    if(previous && (previous.route!==route || previous.hash!==hash))throw fail(409,'此提交标识已使用，请刷新后重试。');
    if(previous?.result)return JSON.parse(previous.result);
    const marker='<!-- usyd-write:'+digest(key+':'+route)+' -->';
    this.running.add(key);
    try {
      if(previous) {
        const recovered=await recover(marker,previous.created);
        if(recovered){db.prepare('UPDATE community_writes SET result=? WHERE user_id=? AND request_id=?').run(JSON.stringify(recovered),userId,requestId);return recovered;}
        throw fail(409,'上次提交的结果尚未确认，请稍后重试，或到 GitHub 核对。');
      }
      const recent=db.prepare('SELECT COUNT(*) AS count,MAX(created) AS latest FROM community_writes WHERE user_id=? AND created>?').get(userId,this.clock()-3600000);
      if(recent.count>=30 || (recent.latest && this.clock()-recent.latest<5000))throw fail(429,'操作太频繁，请稍后再试。');
      db.prepare('INSERT INTO community_writes VALUES(?,?,?,?,NULL,?)').run(userId,requestId,route,hash,this.clock());
      try {
        const result=await write(marker);
        db.prepare('UPDATE community_writes SET result=? WHERE user_id=? AND request_id=?').run(JSON.stringify(result),userId,requestId);
        return result;
      } catch(error) {
        // A timeout can occur after GitHub saved the record. Keep the receipt pending.
        if(error.definitive)db.prepare('DELETE FROM community_writes WHERE user_id=? AND request_id=?').run(userId,requestId);
        throw error;
      }
    } finally {this.running.delete(key);}
  }
  async postComment(session,type,id,body) {
    const issue=this.discussions[type+':'+id],message=text(body.text,4000,'评论');
    if(!issue)throw fail(404,'评论区准备中。');
    const result=await this.once(session,body.requestId,'comment:'+type+':'+id,{text:message},async marker=>{
      const {data}=await this.api('/issues/'+issue+'/comments',{session,method:'POST',body:{body:message+'\n\n'+marker}});
      return this.record(data,issue);
    },async(marker,created)=>{
      const {data}=await this.api('/issues/'+issue+'/comments?per_page=100&since='+encodeURIComponent(new Date(created-60000).toISOString()),{session});
      const found=data.find(item=>item.user?.id===session.user.id&&item.body?.includes(marker));
      return found?this.record(found,issue):null;
    });
    this.comments.invalidate(issue);return result;
  }
  async postGuestbook(session,body) {
    const title=text(body.title,80,'标题'),message=text(body.text,4000,'留言');
    const result=await this.once(session,body.requestId,'guestbook',{title,text:message},async marker=>{
      const {data}=await this.api('/issues',{session,method:'POST',body:{title:'[留言] '+title,body:message+'\n\n'+marker}});
      return this.record(data);
    },marker=>this.findOwnIssue(session,marker));
    this.guestCache.clear();this.generation++;return result;
  }
  async findOwnIssue(session,marker) {
    const {data}=await this.api('/issues?state=all&creator='+encodeURIComponent(session.user.login)+'&sort=created&direction=desc&per_page=100',{session});
    const item=data.find(item=>!item.pull_request&&item.user?.id===session.user.id&&item.body?.includes(marker));
    return item?this.record(item):null;
  }
  async deleteComment(session,type,id,commentId) {
    const issue=this.discussions[type+':'+id];
    const {data}=await this.api('/issues/comments/'+commentId,{session});
    if(data.issue_url!=='https://api.github.com/repos/'+this.repository+'/issues/'+issue)throw fail(404,'没有找到这条评论。');
    if(data.user?.id!==session.user.id && !await this.canManage(session))throw fail(403,'只能删除自己的评论。');
    await this.api('/issues/comments/'+commentId,{session,method:'DELETE'});
    this.comments.invalidate(issue);return {deleted:true};
  }
  async withdrawGuestbook(session,number) {
    const {data}=await this.api('/issues/'+number,{session});
    if(data.pull_request || !data.title?.startsWith('[留言]'))throw fail(404,'没有找到这条留言。');
    if(data.user?.id!==session.user.id && !await this.canManage(session))throw fail(403,'只能撤回自己的留言。');
    if(data.state!=='closed')await this.api('/issues/'+number,{session,method:'PATCH',body:{state:'closed',state_reason:'not_planned'}});
    this.guestCache.clear();this.generation++;return {deleted:true};
  }
  async deleteContent(session,type,id,body) {
    await this.requireManager(session);
    const item=this.items.get(type+':'+id),reason=text(body.reason,500,'删除原因');
    if(body.hash!==contentHash(item))throw fail(409,'内容已更新，请刷新页面后重新确认删除。');
    const payload={type,id,hash:body.hash,userId:session.user.id};
    const result=await this.once(session,body.requestId,'delete:'+type+':'+id,{hash:body.hash,reason},async marker=>{
      const {data}=await this.api('/issues',{session,method:'POST',body:{title:('[删除内容] '+item.title).slice(0,200),body:'删除目标：`'+type+':'+id+'`\n\n原因：'+reason+'\n\n<!-- usyd-delete:'+JSON.stringify(payload)+' -->\n'+marker,labels:[deletionLabel]}});
      return this.record(data);
    },marker=>this.findOwnIssue(session,marker));
    return {number:result.number,url:result.url,pending:true};
  }
}
