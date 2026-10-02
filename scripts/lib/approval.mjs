import {approvalLabel,submissionHash} from './issue-content.mjs';
export function canPublish(permission) {return ['admin','write','maintain'].includes(permission?.permission);}
export function verifyApproval(snapshot,current,permission) {
  if(!canPublish(permission))throw new Error('只有具有仓库写入权限的维护者可以审核收录。');
  if(snapshot.pull_request||current.pull_request||snapshot.number!==current.number)throw new Error('投稿标识无效。');
  if(current.state!=='open')throw new Error('投稿已关闭，请重新打开并审核。');
  if(!current.labels?.some(label=>(typeof label==='string'?label:label.name)===approvalLabel))throw new Error('审核通过标签已移除，本次收录停止。');
  if(submissionHash(snapshot)!==submissionHash(current))throw new Error('投稿在审核后被修改。请重新核对，再移除并重新添加「审核通过」标签。');
}
