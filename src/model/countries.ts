// the countries the Enable Banking application covers
// biome-ignore format: the codes read best on one line
const COUNTRY_CODES = 'AT BE BG CY DE DK EE ES FI FR GR HR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK'.split(' ');

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: regionNames.of(code) ?? code })).sort(
  (left, right) => left.name.localeCompare(right.name),
);
