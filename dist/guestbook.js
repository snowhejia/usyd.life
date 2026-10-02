(() => {
  'use strict';
  const container=document.getElementById('guestbook-feed');
  if(!container)return;
  const repository=window.CAMPUS_CONFIG?.repositoryUrl || 'https://github.com/snowhejia/usyd.life';
  window.Community.feed(container,{endpoint:'/api/guestbook',guestbook:true,githubUrl:repository.replace(/\/$/,'')+'/issues?q=is%3Aissue+in%3Atitle+%22%5B留言%5D%22'});
})();
