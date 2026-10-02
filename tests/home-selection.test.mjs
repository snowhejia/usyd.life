import assert from 'node:assert/strict';
import {test} from 'node:test';
import {selectHomeResources} from '../dist/home-selection.js';

const content = overrides => ({timezone:'Australia/Sydney', benefits:[], notices:[], foods:[], ...overrides});
const now = new Date('2026-10-03T02:00:00Z');

test('each module draws independently from current entries, excluding expired and inactive records', () => {
  const entries = [
    {id:'expired', expiresOn:'2026-10-02'},
    {id:'ongoing'},
    {id:'withdrawn', active:false},
    {id:'last-day', expiresOn:'2026-10-03'},
    {id:'later', active:true, expiresOn:'2026-11-01'}
  ];
  const draws = [0, 0.5, 0.9999];
  const selection = selectHomeResources(content({benefits:entries, notices:entries, foods:entries}), {now, random:() => draws.shift()});
  assert.equal(selection.benefit.id, 'ongoing');
  assert.equal(selection.notice.id, 'last-day');
  assert.equal(selection.food.id, 'later');
  assert.equal(selection.foodCount, 3);
});

test('expiration includes the final Sydney day, across the daylight-saving change', () => {
  const data = content({benefits:[{id:'limited', expiresOn:'2026-10-04'}]});
  for (const instant of ['2026-10-03T14:00:00Z', '2026-10-04T12:59:59.999Z']) {
    const selection = selectHomeResources(data, {now:new Date(instant)});
    assert.equal(selection.today, '2026-10-04');
    assert.equal(selection.benefit.id, 'limited');
  }
  const nextDay = selectHomeResources(data, {now:new Date('2026-10-04T13:00:00Z')});
  assert.equal(nextDay.today, '2026-10-05');
  assert.equal(nextDay.benefit, null);
});

test('notices remain eligible after their effective date and undated ongoing records remain eligible', () => {
  const data = content({notices:[{id:'ongoing-rule', effectiveDate:'2026-10-01'}, {id:'everyday'}]});
  assert.equal(selectHomeResources(data, {now, random:() => 0}).notice.id, 'ongoing-rule');
  assert.equal(selectHomeResources(data, {now, random:() => 0.9999}).notice.id, 'everyday');
});

test('empty or fully expired modules do not fall back to stale content', () => {
  const selection = selectHomeResources(content({
    benefits:[{id:'old-benefit', expiresOn:'2026-10-02'}],
    foods:[{id:'closed-cafe', active:false}]
  }), {now});
  assert.equal(selection.benefit, null);
  assert.equal(selection.notice, null);
  assert.equal(selection.food, null);
  assert.equal(selection.foodCount, 0);
});

test('the one-off clock-change reminder retires, while the ongoing rule stays available', () => {
  const data = content({notices:[
    {id:'clock-change', effectiveDate:'2026-10-04', expiresOn:'2026-10-04'},
    {id:'ongoing-rule', effectiveDate:'2026-10-01'}
  ]});
  assert.equal(selectHomeResources(data, {now, random:() => 0}).notice.id, 'clock-change');
  assert.equal(selectHomeResources(data, {now:new Date('2026-10-04T13:00:00Z'), random:() => 0}).notice.id, 'ongoing-rule');
});
