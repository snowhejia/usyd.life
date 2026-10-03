import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createSiteServer} from './server.mjs';
import {writeTestContent} from './test-fixture.mjs';

test('published content, discussion links and pages bypass browser and CDN caches while other assets retain revalidation',async t=>{
  const directory=realpathSync(mkdtempSync(path.join(tmpdir(),'usyd-cache-')));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  writeTestContent(directory);
  writeFileSync(path.join(directory,'index.html'),'<!doctype html><title>Home</title>');
  writeFileSync(path.join(directory,'theme.css'),'body {color: brown}');
  const server=createSiteServer({database:':memory:',staticDir:directory});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    for(const route of ['/','/index.html','/detail.html?type=event&id=gelato','/data.js?v=17','/discussions.js?v=2']) {
      const response=await fetch(base+route);
      assert.equal(response.status,200,route);
      assert.equal(response.headers.get('cache-control'),'no-store');
      assert.equal(response.headers.get('cdn-cache-control'),'no-store');
      const current=await fetch(base+route,{headers:{'If-None-Match':response.headers.get('etag')}});
      assert.equal(current.status,200,'old browser cache must not be reused for '+route);
      assert.equal(await current.text(),await response.text());
      const head=await fetch(base+route,{method:'HEAD'});
      assert.equal(head.headers.get('cache-control'),'no-store');
      assert.equal(await head.text(),'');
    }
    for(const name of ['data.js','discussions.js']) {
      const before=await fetch(base+'/'+name);
      const contents=readFileSync(path.join(directory,name),'utf8')+'\n// Newly collected issue-18\n';
      writeFileSync(path.join(directory,name),contents);
      const after=await fetch(base+'/'+name,{headers:{'If-None-Match':before.headers.get('etag')}});
      assert.equal(after.status,200);
      assert.equal(await after.text(),contents);
      assert.equal(after.headers.get('cache-control'),'no-store');
    }
    const missing=await fetch(base+'/detail.html?type=event&id=not-yet-published');
    assert.equal(missing.status,404);
    assert.equal(missing.headers.get('cache-control'),'no-store');
    const css=await fetch(base+'/theme.css');
    assert.equal(css.headers.get('cache-control'),'no-cache');
    const unchanged=await fetch(base+'/theme.css',{headers:{'If-None-Match':css.headers.get('etag')}});
    assert.equal(unchanged.status,304);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
