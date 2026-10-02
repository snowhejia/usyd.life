import {randomUUID} from 'node:crypto';
import {fail,digest} from './auth.mjs';
import {imageExtension} from '../scripts/lib/issue-images.mjs';

export const uploadLimit=5*1024*1024;
export const uploadOrigin='https://usyd.life';
const mime={png:'image/png',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
export class SubmissionUploads {
  constructor(db,{clock=()=>Date.now()}={}) {
    Object.assign(this,{db,clock});
    db.exec(`CREATE TABLE IF NOT EXISTS submission_uploads (
      name TEXT PRIMARY KEY,user_id INTEGER NOT NULL,request_id TEXT NOT NULL,
      hash TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,bytes BLOB NOT NULL,
      created INTEGER NOT NULL,published INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id,request_id));`);
  }
  result(row) {return {url:uploadOrigin+'/media/submissions/'+row.name,previewUrl:'/media/submissions/'+row.name};}
  save(session,requestId,bytes) {
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || ''))throw fail(400,'上传标识无效，请重新选择图片。');
    if(!bytes.length || bytes.length>uploadLimit)throw fail(413,'每张配图不能超过 5 MB。');
    let extension;
    try{extension=imageExtension(bytes);}catch(error){throw fail(400,error.message);}
    const user=session.user.id,hash=digest(bytes);
    const previous=this.db.prepare('SELECT name,hash FROM submission_uploads WHERE user_id=? AND request_id=?').get(user,requestId);
    if(previous){if(previous.hash!==hash)throw fail(409,'这次上传的图片已变更，请重新选择。');return this.result(previous);}
    // Only abandoned drafts expire. Images attached to an Issue remain available.
    this.db.prepare('DELETE FROM submission_uploads WHERE published=0 AND created<?').run(this.clock()-7*86400000);
    const recent=this.db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS size FROM submission_uploads WHERE user_id=? AND created>?').get(user,this.clock()-86400000);
    if(recent.count>=50 || recent.size+bytes.length>100*1024*1024)throw fail(429,'今天上传的图片较多，请明天再试。');
    const total=this.db.prepare('SELECT COALESCE(SUM(size),0) AS size FROM submission_uploads').get();
    if(total.size+bytes.length>512*1024*1024)throw fail(507,'图片空间暂时不足，请先提交文字，稍后在 GitHub 补图。');
    const name=randomUUID()+'.'+extension;
    this.db.prepare('INSERT INTO submission_uploads(name,user_id,request_id,hash,mime,size,bytes,created) VALUES(?,?,?,?,?,?,?,?)').run(name,user,requestId,hash,mime[extension],bytes.length,bytes,this.clock());
    return this.result({name});
  }
  ownNames(session,urls) {
    return urls.filter(url=>new URL(url).origin===uploadOrigin).map(url=>{
      const name=new URL(url).pathname.split('/').pop();
      const row=this.db.prepare('SELECT user_id FROM submission_uploads WHERE name=?').get(name);
      if(!row)throw fail(400,'配图已过期或不存在，请重新上传。');
      if(row.user_id!==session.user.id)throw fail(403,'请移除其他账号上传的图片，再使用当前账号上传。');
      return name;
    });
  }
  publish(names) {
    const update=this.db.prepare('UPDATE submission_uploads SET published=1 WHERE name=?');
    for(const name of names)update.run(name);
  }
  read(name,session) {
    const row=this.db.prepare('SELECT * FROM submission_uploads WHERE name=?').get(name);
    return row && (row.published || row.user_id===session?.user.id)?row:null;
  }
}
