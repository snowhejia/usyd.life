(() => {
  'use strict';
  const actions=document.getElementById('guestbook-actions');
  if (!actions) return;

  let repository;
  try {
    const url=new URL(window.CAMPUS_CONFIG?.repositoryUrl || '');
    if (url.protocol!=='https:' || url.hostname!=='github.com' || url.username || url.password || url.port || url.search || url.hash) return;
    const path=url.pathname.replace(/\/$/,'').replace(/\.git$/,'');
    if (!/^\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(path) || /\/\.{1,2}$/.test(path)) return;
    repository='https://github.com'+path;
  } catch { return; }

  const write=new URL(repository+'/issues/new');
  write.searchParams.set('template','new-guestbook.yml');
  const read=new URL(repository+'/issues');
  read.searchParams.set('q','is:issue in:title "[留言]" sort:created-desc');

  document.getElementById('guestbook-write').href=write.href;
  document.getElementById('guestbook-read').href=read.href;
  document.getElementById('guestbook-status').textContent='使用 GitHub 账号，留言公开保存在 Issues。';
  actions.hidden=false;
})();
