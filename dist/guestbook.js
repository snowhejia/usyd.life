(() => {
  'use strict';
  const container=document.getElementById('guestbook-feed');
  if(!container)return;
  const repository=window.CAMPUS_CONFIG?.repositoryUrl || 'https://github.com/snowhejia/usyd.life';
  window.Community.feed(container,{endpoint:'/api/guestbook',guestbook:true,githubUrl:repository.replace(/\/$/,'')+'/issues?q=is%3Aissue+in%3Atitle+%22%5B留言%5D%22'});
  const messages=document.createElement('section');
  messages.className='guestbook-messages';
  messages.setAttribute('aria-labelledby','guestbook-messages-title');
  const heading=document.createElement('h2');
  heading.id='guestbook-messages-title';
  heading.textContent='最新留言';
  messages.append(heading,...container.querySelectorAll('.community-list,.community-empty,.community-controls'));
  container.append(messages);
})();
