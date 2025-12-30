// utils/productFilters.js

export function detectPrice(message) {
  const msg = message.toLowerCase();

  const between = msg.match(/(\d+)\s*(?:to|and|-)\s*(\d+)/);
  if (between) return { min: parseInt(between[1]), max: parseInt(between[2]) };

  const under = msg.match(/(under|below|less than)\s*(\d+)/);
  if (under) return { min: null, max: parseInt(under[2]) };

  const above = msg.match(/(above|over|greater than|more than)\s*(\d+)/);
  if (above) return { min: parseInt(above[2]), max: null };

  const single = msg.match(/(\d{3,6})/);
  if (single) return { min: null, max: parseInt(single[1]) };

  return null;
}

export function detectSize(message) {
  const s = message.match(/\b(xs|s|m|l|xl|xxl|xxxl|28|30|32|34|36|38|40|42|44|46)\b/i);
  return s ? s[0].toUpperCase() : null;
}

export function detectColor(message, colorsMeta) {
  const msg = message.toLowerCase();
  return colorsMeta.find(c => msg.includes(c.toLowerCase())) || null;
}

export function detectCategory(message, productTypesMeta) {
  const msg = message.toLowerCase();
  for (const [cat, terms] of Object.entries(productTypesMeta)) {
    if (terms.some(t => msg.includes(t.toLowerCase()))) return cat;
  }
  return null;
}

export function buildDynamicQuery({ category, color, size, price }) {
  const q = [];

  if (category) {
    q.push({
      $or: [
        { category: new RegExp(category, "i") },
        { name: new RegExp(category, "i") },
        { tags: new RegExp(category, "i") }
      ]
    });
  }

  if (color) {
    q.push({
      $or: [
        { name: new RegExp(color, "i") },
        { tags: new RegExp(color, "i") },
        { "variants.option1": new RegExp(color, "i") }
      ]
    });
  }

  if (size) {
    q.push({
      $or: [
        { "variants.option2": new RegExp(size, "i") },
        { tags: new RegExp(size, "i") }
      ]
    });
  }

  if (price) {
    if (price.min != null) q.push({ price: { $gte: price.min } });
    if (price.max != null) q.push({ price: { $lte: price.max } });
  }

  return q.length > 0 ? { $and: q } : {};
}