import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

// API tests use fixed fixtures so maintaining or deleting real content cannot break CI.
export function writeTestContent(directory) {
  mkdirSync(directory,{recursive:true});
  const data={tags:{club:'社团',social:'社交',free:'免费'},events:[{id:'gelato',title:'Test event'}],benefits:[{id:'canva',title:'Test benefit'}],notices:[{id:'daylight-saving-2026',title:'Test notice'}],foods:[{id:'kura-ichi',title:'Test restaurant'}]};
  writeFileSync(path.join(directory,'data.js'),'window.CAMPUS_DATA='+JSON.stringify(data)+';');
  writeFileSync(path.join(directory,'discussions.js'),'window.CAMPUS_DISCUSSIONS='+JSON.stringify({repository:'snowhejia/usyd.life',items:{'event:gelato':1,'benefit:canva':6,'notice:daylight-saving-2026':9,'food:kura-ichi':14}})+';');
  writeFileSync(path.join(directory,'detail.html'),'<!doctype html><title>Detail</title>');
  return directory;
}
