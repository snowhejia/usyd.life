import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const maxSize=5*1024*1024;
export function attachmentUrl(value,redirect=false) {
  let url;try{url=new URL(value);}catch{throw new Error('配图链接无效。');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)throw new Error('配图请使用 GitHub 上传后的 HTTPS 图片链接。');
  const direct=(url.hostname==='github.com'&&/^\/user-attachments\/assets\/[a-f0-9-]{36}$/.test(url.pathname)) || (url.hostname==='user-images.githubusercontent.com'&&/^\/\d+\/[^/]+$/.test(url.pathname));
  const redirected=redirect&&['private-user-images.githubusercontent.com','github-production-user-asset-6210df.s3.amazonaws.com','github-production-user-asset-6210df.s3.us-east-1.amazonaws.com'].includes(url.hostname);
  if(!direct&&!redirected)throw new Error('请把图片直接上传到 GitHub Issue，再使用生成的图片链接。');
  return url;
}
export function imageExtension(buffer) {
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(buffer.length>=3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return 'jpg';
  if(['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString()))return 'gif';
  if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')return 'webp';
  throw new Error('配图仅支持 PNG、JPG、GIF 或 WebP，请勿上传 SVG、PDF 或其他文件。');
}
export async function saveImage(value,directory,{fetcher=fetch}={}) {
  let url=attachmentUrl(value),response;
  for(let redirects=0;redirects<=3;redirects++) {
    response=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'image/png,image/jpeg,image/webp,image/gif'}});
    if([301,302,303,307,308].includes(response.status)) {
      const next=response.headers.get('location');await response.body?.cancel();
      if(!next||redirects===3)throw new Error('图片链接跳转过多，请重新上传图片。');
      url=attachmentUrl(new URL(next,url).href,true);continue;
    }
    break;
  }
  if(!response.ok)throw new Error('无法读取配图，请确认图片已公开上传到此 GitHub Issue。');
  if(Number(response.headers.get('content-length'))>maxSize){await response.body?.cancel();throw new Error('每张配图不能超过 5 MB。');}
  const chunks=[];let size=0;
  try {for await(const chunk of response.body){size+=chunk.length;if(size>maxSize)throw new Error('每张配图不能超过 5 MB。');chunks.push(chunk);}}
  catch(error){throw new Error(error.message==='每张配图不能超过 5 MB。'?error.message:'配图下载中断，请重试。');}
  const buffer=Buffer.concat(chunks),extension=imageExtension(buffer);
  const filename=createHash('sha256').update(buffer).digest('hex')+'.'+extension;
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,filename),buffer);
  return 'assets/submissions/'+filename;
}
