const fs = require('fs');
const path = require('path');

const DICT_PATH = process.env.SKILL_DICTIONARY_PATH || path.join(__dirname, '../../../shared/skill_dictionary.json');
const dictionary = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
const bySlug = new Map(dictionary.map((d) => [d.slug, d]));
const byName = new Map(dictionary.map((d) => [d.name.toLowerCase(), d]));
const aliasIndex = new Map();
for (const d of dictionary) for (const a of d.aliases) aliasIndex.set(a.toLowerCase(), d);

module.exports = { dictionary, bySlug, byName, aliasIndex, DICT_PATH };
