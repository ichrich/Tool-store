async function ensureUniqueSlug(base, existsAsync) {
  let slug = base || "item";
  let n = 2;
  while (await existsAsync(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

module.exports = { ensureUniqueSlug };
