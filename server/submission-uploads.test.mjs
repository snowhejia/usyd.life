import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {SubmissionUploads} from './submission-uploads.mjs';

test('only abandoned image drafts expire; published Issue images survive and upload quotas remain bounded',t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  let now=Date.now();const store=new SubmissionUploads(db,{clock:()=>now}),user={user:{id:1}};
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yTioAAAAASUVORK5CYII=','base64');
  const draft=store.save(user,randomUUID(),png),published=store.save(user,randomUUID(),png);
  store.publish(store.ownNames(user,[published.url]));
  now+=8*86400000;store.save(user,randomUUID(),png);
  assert.equal(store.read(draft.previewUrl.split('/').pop(),user),null);
  assert.ok(store.read(published.previewUrl.split('/').pop(),null));
  for(let i=1;i<50;i++)store.save(user,randomUUID(),png);
  assert.throws(()=>store.save(user,randomUUID(),png),error=>error.status===429);
  db.prepare('UPDATE submission_uploads SET size=? WHERE published=1').run(512*1024*1024);
  assert.throws(()=>store.save({user:{id:2}},randomUUID(),png),error=>error.status===507);
});
