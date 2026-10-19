import i18n, { deviceLanguage } from '@/i18n';
import { en } from '@/i18n/en';
import { fil } from '@/i18n/fil';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

const placeholders = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const english = flatten(en);
  const filipino = flatten(fil as Tree);

  it('has a Filipino string for every English key', () => {
    expect(Object.keys(filipino).sort()).toEqual(Object.keys(english).sort());
  });

  it('keeps the same {{placeholders}} in every Filipino string', () => {
    const mismatched = Object.keys(english).filter(
      (key) => placeholders(english[key]).join() !== placeholders(filipino[key] ?? '').join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('has no empty strings', () => {
    expect(Object.entries(filipino).filter(([, v]) => !v.trim())).toEqual([]);
  });
});

describe('language selection', () => {
  it('uses Filipino for Filipino or Tagalog devices', () => {
    expect(deviceLanguage('fil')).toBe('fil');
    expect(deviceLanguage('tl')).toBe('fil');
    expect(deviceLanguage('en')).toBe('en');
    expect(deviceLanguage('ja')).toBe('en');
    expect(deviceLanguage(undefined)).toBe('en');
  });

  it('translates and pluralizes in both languages', async () => {
    await i18n.changeLanguage('fil');
    expect(i18n.t('card.toConfirm', { count: 3 })).toBe('3 presyong kukumpirmahin');
    expect(i18n.t('age.days', { count: 1 })).toBe('1 araw ang nakalipas');
    await i18n.changeLanguage('en');
    expect(i18n.t('card.toConfirm', { count: 1 })).toBe('1 price to confirm');
    expect(i18n.t('card.toConfirm', { count: 3 })).toBe('3 prices to confirm');
  });
});
