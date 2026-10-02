export class GitHubComments {
  constructor(repository,{fetcher=fetch,clock=()=>Date.now(),token=process.env.GITHUB_READ_TOKEN || '',ttl=180000}={}) {
    if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) throw new Error('Invalid discussion repository');
    Object.assign(this,{repository,fetcher,clock,token,ttl});
    this.cache=new Map();
    this.pending=new Map();
    this.revision=new Map();
    this.backoffUntil=0;
  }
  async read(issue,page=1,refresh=false) {
    const key=issue+':'+page;
    const previous=this.cache.get(key);
    if (previous && previous.expires>this.clock() && (!refresh || this.clock()-previous.savedAt<30000)) return previous.data;
    if (this.pending.has(key)) return this.pending.get(key);
    const revision=this.revision.get(issue) || 0;
    const request=this.load(issue,page,previous).then(data=>{
      if(revision!==(this.revision.get(issue) || 0))return this.read(issue,page,true);
      this.cache.delete(key);
      this.cache.set(key,{data,savedAt:this.clock(),expires:this.clock()+(data.stale?30000:this.ttl)});
      if (this.cache.size>200) this.cache.delete(this.cache.keys().next().value);
      return data;
    }).finally(()=>{if(this.pending.get(key)===request)this.pending.delete(key);});
    this.pending.set(key,request);
    return request;
  }
  invalidate(issue) {
    this.revision.set(issue,(this.revision.get(issue) || 0)+1);
    for(const key of this.cache.keys())if(key.startsWith(issue+':'))this.cache.delete(key);
    for(const key of this.pending.keys())if(key.startsWith(issue+':'))this.pending.delete(key);
  }
  async load(issue,page,previous) {
    try {
      if(this.clock()<this.backoffUntil) throw new Error('GitHub rate limited');
      const response=await this.fetcher('https://api.github.com/repos/'+this.repository+'/issues/'+issue+'/comments?per_page=20&page='+page,{
        headers:{Accept:'application/vnd.github.html+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'usyd.life',...(this.token?{Authorization:'Bearer '+this.token}:{})},
        signal:AbortSignal.timeout(8000),redirect:'error'
      });
      if (!response.ok) {
        if ([403,429].includes(response.status)) {
          const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;
          this.backoffUntil=Math.max(this.clock()+60000,Number.isFinite(reset)?reset:0);
        }
        // Never keep serving deleted or private discussion contents from cache.
        if ([401,404,410].includes(response.status)) throw Object.assign(new Error('Discussion unavailable'),{discard:true});
        throw new Error('GitHub unavailable');
      }
      const records=await response.json();
      if (!Array.isArray(records)) throw new Error('Invalid GitHub response');
      return {
        items:records.filter(item=>Number.isSafeInteger(item.id)&&!item.minimized).map(item=>({
          id:item.id,author:String(item.user?.login || 'GitHub 用户'),userId:item.user?.id,createdAt:item.created_at,
          html:String(item.body_html || ''),text:String(item.body || ''),
          url:'https://github.com/'+this.repository+'/issues/'+issue+'#issuecomment-'+item.id
        })),
        nextPage:/rel="next"/.test(response.headers.get('link') || '')?page+1:null,stale:false
      };
    } catch(error) {
      if (previous && !error.discard) return {...previous.data,stale:true};
      if (error.discard) this.cache.delete(issue+':'+page);
      throw Object.assign(new Error('评论暂时无法加载，请到 GitHub 查看。'),{status:503});
    }
  }
}
