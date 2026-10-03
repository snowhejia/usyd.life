import {selectHomeResources} from './home-selection.js?v=1';

(() => {
  'use strict';
  const data = window.CAMPUS_DATA;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  function resourcePhoto(id,item,type) {
    const element = document.getElementById(id);
    element.hidden = !item?.image;
    element.innerHTML = item?.image ? '<img src="' + escape(item.image) + '" alt="' + escape(item.imageAlt || item.title) + '" decoding="async">' : '';
    if (item?.image) {
      element.href = 'detail.html?type=' + type + '&id=' + encodeURIComponent(item.id);
      element.setAttribute('aria-label','查看 ' + item.title + ' 的详情');
    }
    if (item?.imagePosition) element.querySelector('img')?.style.setProperty('object-position',item.imagePosition);
  }
  const {today, benefit, notice: nextNotice, food} = selectHomeResources(data);
  const upcoming = data.events.filter(item => item.active !== false && (!item.expiresOn || item.expiresOn >= today) && (item.endDate || item.startDate) >= today).sort((a,b) => a.startDate.localeCompare(b.startDate));
  document.getElementById('home-event-count').textContent = String(upcoming.length).padStart(2,'0');
  document.getElementById('home-events').innerHTML = upcoming.slice(0,3).map(item => {
    const [,month,day] = item.startDate.split('-');
    return '<a class="home-event-link" href="detail.html?type=event&id=' + encodeURIComponent(item.id) + '"><time class="home-event-date" datetime="' + item.startDate + '"><strong>' + day + '</strong>' + Number(month) + ' 月</time><span><span class="home-event-name">' + escape(item.title) + '</span><span class="home-event-meta">' + escape(item.time) + '</span><span class="home-event-meta home-event-place">' + escape(item.location) + '</span></span><span class="home-event-arrow" aria-hidden="true">↗</span></a>';
  }).join('') || '<p class="home-feature">暂无近期活动。</p>';
  document.getElementById('perks-title').textContent = benefit?.title || '暂无学生权益';
  document.getElementById('home-benefit-cost').textContent = benefit?.cost || '';
  document.getElementById('home-benefit-cost').hidden = !benefit;
  document.getElementById('home-benefit-facts').innerHTML = benefit ? [['适用',benefit.eligibility],['领取',benefit.claim]].map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + escape(value || '详见领取说明') + '</dd></div>').join('') : '';
  document.getElementById('home-benefit-compact').textContent = benefit?.homeSummary || benefit?.subtitle || benefit?.cost || '欢迎投稿补充';
  resourcePhoto('home-benefit-photo',benefit,'benefit');
  document.getElementById('reminder-title').textContent = nextNotice?.title || '暂无生活提醒';
  document.getElementById('home-notice').textContent = nextNotice?.description || '欢迎投稿补充。';
  document.getElementById('home-notice-compact').textContent = nextNotice?.homeSummary || nextNotice?.description || '欢迎投稿补充';
  const noticeDate = document.getElementById('home-notice-date');
  noticeDate.hidden = !nextNotice?.effectiveDate;
  if (nextNotice?.effectiveDate) {
    const [year,month,day] = nextNotice.effectiveDate.split('-');
    noticeDate.dateTime = nextNotice.effectiveDate;
    noticeDate.textContent = year + ' 年 ' + Number(month) + ' 月 ' + Number(day) + ' 日';
  }
  resourcePhoto('home-notice-photo',nextNotice,'notice');

  function setupCarousel(events) {
    const carousel = document.getElementById('activity-carousel');
    const stage = document.getElementById('featured-slides');
    const counter = document.getElementById('carousel-counter');
    const controls = document.getElementById('carousel-controls');
    const dotsContainer = document.getElementById('carousel-dots');
    const playback = document.getElementById('carousel-playback');
    const progress = document.getElementById('carousel-progress');
    const progressFill = document.getElementById('carousel-progress-fill');
    const announcement = document.getElementById('carousel-announcement');
    const items = events.slice(0,5);
    carousel.dataset.slideCount = items.length;

    function eventDate(item) {
      const label = value => (value.slice(0,4) !== today.slice(0,4) ? value.slice(0,4) + ' 年 ' : '') + Number(value.slice(5,7)) + ' 月 ' + Number(value.slice(8)) + ' 日';
      const end = item.endDate || item.startDate;
      return label(item.startDate) + (end === item.startDate ? '' : ' – ' + label(end));
    }
    function artwork(item) {
      if (item.image) return '<img src="' + escape(item.image) + '" alt="' + escape(item.imageAlt || item.title) + '" decoding="async" style="object-position:' + escape(item.imagePosition || '50% 42%') + '">';
      if (item.artwork === 'icecream') {
        return '<div class="featured-art" aria-hidden="true"><span class="featured-art-title">FREE<br>GELATO</span><svg class="featured-cone" viewBox="0 0 44 60"><path d="M9 28h26v7h-3v6h-3v6h-3v6h-3v5h-4v-5h-3v-6h-3v-6h-3v-6H9Z" fill="#dfad6c" stroke="#4c302b" stroke-width="2"/><path d="M12 34h20M15 41h14M18 48h8M15 31v7m6 3v7m6-17v7" fill="none" stroke="#bc864f" stroke-width="2"/><path d="M15 3h14v4h6v6h4v13h-4v5h-8v-3H17v3H9v-5H5V13h4V7h6Z" fill="#f1aaab" stroke="#4c302b" stroke-width="2"/><path d="M13 10h6v3h-6Zm14 8h4v3h-4ZM9 21h4v3H9Z" fill="#fff1dc"/></svg><span class="featured-art-stamp">FREE ICE CREAM</span></div>';
      }
      return '<div class="featured-art featured-generic" aria-hidden="true"><span class="featured-art-title">' + escape(data.tags[item.tags?.[0]] || '最近活动') + '</span><svg class="pixel-icon"><use href="#pixel-star"></use></svg></div>';
    }
    if (!items.length) {
      counter.textContent = '暂无近期活动';
      stage.innerHTML = '<div class="featured-empty"><h2>暂无近期活动</h2><a class="pill" href="events.html">去活动广场看看 ↗</a></div>';
      return;
    }
    stage.innerHTML = items.map((item,position) => '<article class="featured-slide" role="group" aria-roledescription="幻灯片" aria-label="' + (position + 1) + ' / ' + items.length + ' · ' + escape(item.name || item.title) + '"' + (position ? ' hidden' : '') + '><a class="featured-link" href="detail.html?type=event&id=' + encodeURIComponent(item.id) + '" aria-label="查看 ' + escape(item.name || item.title) + ' 的活动详情"><div class="featured-media">' + artwork(item) + '<span class="featured-category">' + (item.tags || []).slice(0,2).map(tag => '#' + escape(data.tags[tag] || tag)).join(' · ') + '</span></div><div class="featured-caption"><div class="featured-copy"><h2>' + escape(item.title) + '</h2><p class="featured-meta"><span>' + escape(eventDate(item)) + '</span><span>' + escape(item.time) + '</span></p></div><span class="featured-caption-arrow" aria-hidden="true">↗</span></div></a></article>').join('');
    dotsContainer.innerHTML = items.map((item,position) => '<button class="carousel-dot" type="button" data-slide="' + position + '" aria-label="第 ' + (position + 1) + ' 场：' + escape(item.name || item.title) + '" aria-pressed="' + (position === 0) + '" aria-controls="featured-slides"><span aria-hidden="true"></span></button>').join('');
    controls.hidden = items.length < 2;

    const slides = Array.from(stage.querySelectorAll('.featured-slide'));
    const dots = Array.from(dotsContainer.querySelectorAll('button'));
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let autoEnabled = !motionPreference.matches;
    let hovered = false;
    let inView = true;
    const slideDuration = 6500;
    let elapsed = 0;
    let runningSince = null;
    let frame;
    let slideAnimations = [];
    let transitionVersion = 0;

    function settleSlides() {
      ++transitionVersion;
      slideAnimations.forEach(animation => animation.cancel());
      slideAnimations = [];
      slides.forEach((slide,position) => {
        slide.hidden = position !== index;
        slide.inert = position !== index;
        slide.setAttribute('aria-hidden',String(position !== index));
      });
      stage.dataset.transition = 'idle';
    }

    function showSlide(next, announce = false) {
      const previous = index;
      const direction = next < index ? -1 : 1;
      // Finish an interrupted move before starting the latest requested one.
      settleSlides();
      index = (next + items.length) % items.length;
      const animate = previous !== index && !motionPreference.matches && typeof stage.animate === 'function';
      slides.forEach((slide,position) => {
        slide.hidden = position !== index && !(animate && position === previous);
        slide.inert = position !== index;
        slide.setAttribute('aria-hidden',String(position !== index));
      });
      dots.forEach((dot,position) => dot.setAttribute('aria-pressed',String(position === index)));
      counter.textContent = String(index + 1).padStart(2,'0') + ' / ' + String(items.length).padStart(2,'0');
      if (announce) announcement.textContent = '第 ' + (index + 1) + ' 场，共 ' + items.length + ' 场。' + items[index].title;
      if (!animate) return;

      stage.dataset.transition = 'sliding';
      const version = transitionVersion;
      const timing = {duration:900,easing:'cubic-bezier(.45,0,.55,1)',fill:'both'};
      slideAnimations = [
        slides[previous].animate([
          {transform:'translateX(0)'},
          {transform:'translateX(' + (-direction * 100) + '%)'}
        ],timing),
        slides[index].animate([
          {transform:'translateX(' + (direction * 100) + '%)'},
          {transform:'translateX(0)'}
        ],timing)
      ];
      Promise.all(slideAnimations.map(animation => animation.finished)).then(() => {
        if (version === transitionVersion) settleSlides();
      },() => {});
    }
    function updatePlayback() {
      playback.setAttribute('aria-label',autoEnabled ? '暂停自动轮播' : '开始自动轮播');
      playback.innerHTML = autoEnabled ? '<span aria-hidden="true">Ⅱ</span> 暂停' : '<span aria-hidden="true">▶</span> 播放';
    }
    function paintProgress(time = elapsed) {
      const fraction = Math.min(1,time / slideDuration);
      progressFill.style.transform = 'scaleX(' + fraction + ')';
      const percent = String(Math.floor(fraction * 100));
      if (progress.getAttribute('aria-valuenow') !== percent) progress.setAttribute('aria-valuenow',percent);
    }
    function pauseProgress() {
      if (runningSince !== null) {
        elapsed = Math.min(slideDuration,elapsed + performance.now() - runningSince);
        runningSince = null;
      }
      window.cancelAnimationFrame(frame);
      frame = undefined;
      progress.dataset.state = 'paused';
      paintProgress();
    }
    function advance(now) {
      if (runningSince === null) return;
      let time = elapsed + now - runningSince;
      if (time >= slideDuration) {
        elapsed = 0;
        runningSince = now;
        time = 0;
        showSlide(index + 1);
      }
      paintProgress(time);
      frame = window.requestAnimationFrame(advance);
    }
    function schedule() {
      pauseProgress();
      if (!autoEnabled || items.length < 2 || hovered || !inView || document.hidden || carousel.contains(document.activeElement)) return;
      runningSince = performance.now();
      progress.dataset.state = 'running';
      frame = window.requestAnimationFrame(advance);
    }
    function manualSlide(next) {
      pauseProgress();
      elapsed = 0;
      showSlide(next,true);
      schedule();
    }
    document.getElementById('carousel-prev').addEventListener('click', () => manualSlide(index - 1));
    document.getElementById('carousel-next').addEventListener('click', () => manualSlide(index + 1));
    dots.forEach((dot,position) => dot.addEventListener('click', () => manualSlide(position)));
    playback.addEventListener('click', () => {
      autoEnabled = !autoEnabled;
      updatePlayback();
      schedule();
    });
    carousel.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const linkFocused = event.target.closest('.featured-link');
      manualSlide(index + (event.key === 'ArrowLeft' ? -1 : 1));
      if (linkFocused) slides[index].querySelector('a').focus({preventScroll:true});
    });
    carousel.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = true;
      schedule();
    });
    carousel.addEventListener('pointerleave', () => {
      hovered = false;
      schedule();
    });
    carousel.addEventListener('focusin',schedule);
    carousel.addEventListener('focusout', () => window.queueMicrotask(schedule));
    document.addEventListener('visibilitychange',schedule);
    window.addEventListener('pagehide',() => { pauseProgress(); settleSlides(); });
    window.addEventListener('pageshow',schedule);
    motionPreference.addEventListener('change', () => {
      if (motionPreference.matches) { autoEnabled = false; settleSlides(); }
      updatePlayback();
      schedule();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.25;
        schedule();
      },{threshold:0.25}).observe(carousel);
    }
    showSlide(0);
    updatePlayback();
    schedule();
  }
  document.getElementById('home-food-title').textContent = food?.title || '暂无美食推荐';
  document.getElementById('home-food-price').textContent = food?.price || '欢迎投稿补充';
  document.getElementById('home-food-dishes').textContent = food?.dishes || '';
  document.getElementById('home-food-location').textContent = food?.location || '';
  resourcePhoto('home-food-photo',food,'food');
  setupCarousel(upcoming);

})();
