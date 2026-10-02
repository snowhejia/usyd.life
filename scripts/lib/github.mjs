export function githubApi(repository,token,{fetcher=fetch}={}) {
  if(!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')||!token)throw new Error('GitHub repository and token are required');
  return async(route,{method='GET',body}={})=>{
    const response=await fetcher('https://api.github.com/repos/'+repository+route,{
      method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),redirect:'error'
    });
    if(!response.ok)throw Object.assign(new Error('GitHub 请求失败（'+response.status+'）。'),{status:response.status});
    return response.status===204?undefined:response.json();
  };
}
export async function allPages(api,route) {
  const items=[];
  for(let page=1;;page++) {
    const batch=await api(route+(route.includes('?')?'&':'?')+'per_page=100&page='+page);
    if(!Array.isArray(batch))throw new Error('GitHub 返回了无效的数据。');
    items.push(...batch);if(batch.length<100)return items;
  }
}
