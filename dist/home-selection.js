export function selectHomeResources(data, {now = new Date(), random = Math.random} = {}) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.timezone || 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  // A notice's effective date is when it takes effect, not when it expires.
  const current = items => items.filter(item => item.active !== false && (!item.expiresOn || item.expiresOn >= today));
  const pick = items => items.length ? items[Math.floor(random() * items.length)] : null;
  const foods = current(data.foods);
  return {
    today,
    benefit: pick(current(data.benefits)),
    notice: pick(current(data.notices)),
    food: pick(foods),
    foodCount: foods.length
  };
}
