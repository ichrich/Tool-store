const slugify = require("slugify");

const CYRILLIC_TO_LATIN = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function transliterate(input) {
  return String(input)
    .toLowerCase()
    .split("")
    .map((ch) =>
      CYRILLIC_TO_LATIN[ch] !== undefined ? CYRILLIC_TO_LATIN[ch] : ch,
    )
    .join("");
}

function slugFromTitle(title, existingSlug) {
  if (existingSlug && String(existingSlug).trim()) {
    return slugify(String(existingSlug).trim(), { lower: true, strict: true });
  }
  const base = transliterate(String(title || ""));
  return slugify(base, { lower: true, strict: true });
}

module.exports = { slugFromTitle, transliterate };
