import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist = path.join(root,'dist');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(dist,'data.js'),'utf8'),context);
const data = context.window.CAMPUS_DATA;
const errors = [];
const check = (condition,message) => { if (!condition) errors.push(message); };
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
check(isDate(data.updatedAt),'updatedAt must be a valid YYYY-MM-DD date');
const fields = {
  events:['title','description','startDate','time','location','price','organiser','source'],
  benefits:['title','description','provider','eligibility','cost','validity','claim','source'],
  notices:['title','description','audience','action','source'],
  foods:['title','description','dishes','location','address','price','source']
};
for (const [collection,required] of Object.entries(fields)) {
  const entries = data[collection];
  check(Array.isArray(entries),`${collection} must be an array`);
  const ids = new Set();
  for (const item of entries || []) {
    const ref = `${collection}/${item.id}`;
    check(typeof item.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id),`${ref}: use a lowercase URL-safe id`);
    check(!ids.has(item.id),`${ref}: duplicate id`);
    ids.add(item.id);
    for (const field of required) check(typeof item[field] === 'string' && item[field].trim(),`${ref}: missing ${field}`);
    for (const field of ['startDate','endDate','effectiveDate','verifiedAt','expiresOn']) {
      if (item[field] !== undefined) check(isDate(item[field]),`${ref}: invalid ${field}`);
    }
    if (item.active !== undefined) check(typeof item.active === 'boolean',`${ref}: active must be true or false`);
    if (item.startDate && item.endDate) check(item.endDate >= item.startDate,`${ref}: endDate precedes startDate`);
    for (const field of ['source','collectionSource','registration','claimUrl','menuUrl','imageSource','mapUrl']) {
      if (!item[field]) continue;
      try { const url=new URL(item[field]); check(['http:','https:'].includes(url.protocol) && !url.username && !url.password,`${ref}: unsafe ${field}`); }
      catch { check(false,`${ref}: invalid ${field}`); }
    }
    for (const field of ['image','screenshot']) {
      if (item[field]) check(/^assets\/[\w./-]+$/.test(item[field]) && fs.existsSync(path.join(dist,item[field])),`${ref}: missing local ${field}`);
    }
    if (item.image) check(typeof item.imageAlt === 'string' && item.imageAlt.trim(),`${ref}: imageAlt is required for images`);
    if (item.imageFit) check(['cover','contain'].includes(item.imageFit),`${ref}: imageFit must be cover or contain`);
    if (item.imagePosition) check(/^(?:100|\d{1,2})% (?:100|\d{1,2})%$/.test(item.imagePosition),`${ref}: imagePosition must be two percentages from 0 to 100`);
    if (collection === 'events') {
      check(Array.isArray(item.tags) && item.tags.length > 0,`${ref}: at least one tag is required`);
      for (const tag of item.tags || []) check(Object.hasOwn(data.tags,tag),`${ref}: unknown tag ${tag}`);
      check(new Set(item.tags).size === item.tags?.length,`${ref}: duplicate tags`);
      if (typeof item.entryFree === 'boolean') check(item.entryFree === item.tags.includes('free'),`${ref}: free tag and entryFree disagree`);
    }
  }
}
for (const filename of fs.readdirSync(dist).filter(file => file.endsWith('.html'))) {
  const html=fs.readFileSync(path.join(dist,filename),'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) {
    const target=match[1].split(/[?#]/)[0];
    if (/^(?:https?:|mailto:)/.test(target)) continue;
    check(fs.existsSync(path.resolve(dist,target)),`${filename}: missing resource ${target}`);
  }
}
const issueTemplate = fs.readFileSync(path.join(root,'.github/ISSUE_TEMPLATE/new-event.yml'),'utf8');
const tagOptions = issueTemplate.match(/id: tags[\s\S]*?options:([\s\S]*?)\n    validations:/)?.[1];
check(!!tagOptions,'Issue event template must include tag options');
for (const label of Object.values(data.tags)) check(tagOptions?.includes('- '+label),`Issue template is missing tag ${label}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
else console.log(`Content valid: ${data.events.length} events, ${data.benefits.length} benefits, ${data.notices.length} notices, ${data.foods.length} restaurants; local resources and tags valid.`);
