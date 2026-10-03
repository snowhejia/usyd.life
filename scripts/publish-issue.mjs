import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {githubApi,allPages} from './lib/github.mjs';
import {parseSubmission,applySubmission,submissionHash,collections,approvalLabel} from './lib/issue-content.mjs';
import {canPublish,verifyApproval} from './lib/approval.mjs';
import {saveImage} from './lib/issue-images.mjs';
import {syncDiscussions} from './sync-discussions.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function readData(directory) {
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(directory,'dist/data.js'),'utf8'),context,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
  return structuredClone(context.window.CAMPUS_DATA);
}
export async function prepareSubmission({directory,repository,issue,reviewer,date=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),imageSaver=saveImage}) {
  const data=readData(directory),hash=submissionHash(issue),auditPath='content/submissions/'+issue.number+'.json';
  const auditFile=path.join(directory,auditPath);
  const previous=fs.existsSync(auditFile)?JSON.parse(fs.readFileSync(auditFile,'utf8')):undefined;
  const assertNotDeleted=({type,id})=>{if(fs.existsSync(path.join(directory,'content/deletions/'+type+'--'+id+'.json')))throw new Error('这条内容已经删除，不能通过旧投稿重新收录。需要恢复时请联系维护者。');};
  if(previous)assertNotDeleted(previous);
  if(previous?.hash===hash)return {changed:false,...previous,files:[]};
  const parsed=parseSubmission(issue,data);
  assertNotDeleted(parsed);
  if(previous&&(previous.type!==parsed.type||previous.id!==parsed.id))throw new Error('已收录投稿不能更改内容类型或目标 ID，请新建投稿。');
  if(!parsed.updating&&!previous) {
    const duplicate=data[collections[parsed.type]].find(item=>item.id===parsed.id||(item.title.toLowerCase().trim()===parsed.patch.title.toLowerCase().trim()&&item.source===parsed.patch.source&&(parsed.type!=='event'||item.startDate===parsed.patch.startDate)&&(parsed.type!=='food'||item.address===parsed.patch.address)));
    if(duplicate)throw new Error('已有相同条目，请通过纠错入口更新，避免重复收录。');
  }
  const saved=[];
  for(const url of parsed.images)saved.push(await imageSaver(url,path.join(directory,'dist/assets/submissions')));
  if(saved.length) {
    parsed.patch.image=saved[0];parsed.patch.imageAlt=parsed.patch.title || data[collections[parsed.type]].find(item=>item.id===parsed.id)?.title;
    parsed.patch.imageSource=parsed.images[0];parsed.patch.imageCredit='GitHub 投稿 @'+issue.user.login;
    parsed.patch.imageFit='cover';parsed.patch.imagePosition='50% 50%';
    parsed.patch.gallery=saved.slice(1).map((image,i)=>({image,imageAlt:parsed.patch.imageAlt+' · 配图 '+(i+2),imageSource:parsed.images[i+1]}));
  }
  if(parsed.sourceImage) {
    parsed.patch.screenshot=saved[parsed.images.indexOf(parsed.sourceImage)];
    parsed.patch.source='https://github.com/'+repository+'/issues/'+issue.number;
    parsed.patch.sourceLabel='查看投稿来源';
    parsed.patch.collectionSource=undefined;
  }
  const metadata={issue:issue.number,url:'https://github.com/'+repository+'/issues/'+issue.number,type:parsed.type,id:parsed.id,hash,reviewedBy:reviewer,publishedOn:date,images:parsed.images,savedImages:saved,sourceImage:parsed.sourceImage};
  const next=applySubmission(data,parsed,{date});
  const output='// Content is maintained through reviewed GitHub submissions and repository changes.\nwindow.CAMPUS_DATA = '+JSON.stringify(next,null,2)+';\n';
  fs.mkdirSync(path.dirname(auditFile),{recursive:true});
  fs.writeFileSync(path.join(directory,'dist/data.js'),output);fs.writeFileSync(auditFile,JSON.stringify(metadata,null,2)+'\n');
  return {changed:true,...metadata,files:['dist/data.js',auditPath,...saved.map(file=>'dist/'+file)]};
}
async function report(api,number,hash,message,label) {
  await api('/issues/'+number+'/labels',{method:'POST',body:{labels:[label]}});
  if(label==='已收录')try{await api('/issues/'+number+'/labels/'+encodeURIComponent('需补充'),{method:'DELETE'});}catch(error){if(error.status!==404)throw error;}
  const marker='<!-- usyd-publish:'+hash+':'+label+' -->';
  const comments=await allPages(api,'/issues/'+number+'/comments');
  if(!comments.some(comment=>comment.body?.includes(marker)))await api('/issues/'+number+'/comments',{method:'POST',body:{body:marker+'\n\n'+message}});
}
export async function publishIssue({directory=root,event,repository,token,actor,dryRun=false,api=githubApi(repository,token),gitRunner,argsRunner,imageSaver=saveImage}={}) {
  const git=gitRunner || ((...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim());
  const run=argsRunner || ((...args)=>execFileSync(process.execPath,args,{cwd:directory,stdio:'inherit'}));
  const number=Number(event.issue?.number || event.inputs?.issue_number);
  if(!Number.isSafeInteger(number)||number<1||!/^[-A-Za-z0-9]+$/.test(actor||'')||event.repository?.full_name!==repository)throw new Error('无效的审核事件。');
  const permission=await api('/collaborators/'+encodeURIComponent(actor)+'/permission');
  if(!canPublish(permission))throw new Error('只有仓库维护者可以执行收录。');
  let snapshot=event.issue;
  if(!snapshot)snapshot=await api('/issues/'+number);
  const hash=submissionHash(snapshot);
  let pushed=false;
  try {
    let result;
    for(let attempt=0;attempt<4;attempt++) {
      const current=await api('/issues/'+number);verifyApproval(snapshot,current,permission);
      if(!dryRun){git('fetch','--no-tags','origin','main');git('reset','--hard','origin/main');}
      result=await prepareSubmission({directory,repository,issue:snapshot,reviewer:actor,imageSaver});
      if(!result.changed){pushed=true;break;}
      run('scripts/check-content.mjs');
      run('--test','server/*.test.mjs','tests/*.test.mjs');
      if(dryRun){console.log('预览检查通过，未提交任何内容。');return result;}
      verifyApproval(snapshot,await api('/issues/'+number),await api('/collaborators/'+encodeURIComponent(actor)+'/permission'));
      await syncDiscussions({root:directory,repository,token,api});
      git('add','--',...result.files,'dist/discussions.js');
      git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m','Collect reviewed submission #'+number);
      verifyApproval(snapshot,await api('/issues/'+number),permission);
      try {git('push','origin','HEAD:main');pushed=true;break;}
      catch {if(attempt===3)throw new Error('仓库同时有其他更新，本次提交未写入。请重新运行此任务。');}
    }
    if(dryRun)return result;
    const commit=git('rev-parse','HEAD');
    const backups=(result.savedImages || []).map((image,i)=>'![投稿配图 '+(i+1)+'](https://raw.githubusercontent.com/'+repository+'/'+commit+'/dist/'+image+')').join('\n\n');
    await report(api,number,hash,'已收录。\n\n- [查看收录记录](https://github.com/'+repository+'/blob/main/content/submissions/'+number+'.json)\n- [查看代码更新](https://github.com/'+repository+'/commit/'+commit+')\n- 详情路径：`detail.html?type='+result.type+'&id='+result.id+'`\n\n部署完成后会显示在网站。'+(backups?'\n\n### 配图备份\n\n'+backups:''),'已收录');
    // GITHUB_TOKEN pushes do not start other push workflows, so request checks explicitly.
    await api('/actions/workflows/ci.yml/dispatches',{method:'POST',body:{ref:'main'}});
    return result;
  } catch(error) {
    if(!dryRun&&!pushed) {
      const message=error.code || error.status?'自动收录暂时失败，请在 Actions 查看日志并重试。':String(error.message).slice(0,600);
      await report(api,number,hash,'暂未收录：'+message+'\n\n补充或修改后，请维护者移除并重新添加「'+approvalLabel+'」标签。原有网站内容保持不变。','需补充').catch(()=>{});
    }
    throw error;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  if(process.env.GITHUB_ACTIONS!=='true')throw new Error('发布命令仅在 GitHub Actions 的临时检出目录中运行。');
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const dryRun=event.inputs?.dry_run==='true'||event.inputs?.dry_run===true;
  await publishIssue({event,repository:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN,actor:event.sender?.login || process.env.GITHUB_ACTOR,dryRun});
}
