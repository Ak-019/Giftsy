const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';

// "Photo Mug" -> "photo-mug", or "photo-mug-2" if that slug is taken by another document
async function uniqueSlug(Model, text, excludeId) {
  const base = slugify(text);
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Model.exists({ slug, _id: { $ne: excludeId } })) slug = `${base}-${n++}`;
  return slug;
}

module.exports = { slugify, uniqueSlug };
