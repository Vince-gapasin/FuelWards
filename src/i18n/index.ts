import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './en';
import { fil } from './fil';

export type Language = 'en' | 'fil';
export type LanguagePreference = Language | 'system';

const PREFERENCE_KEY = 'fw.language';

/** Filipino when the device is set to Filipino or Tagalog, otherwise English. */
export function deviceLanguage(languageCode = getLocales()[0]?.languageCode): Language {
  return languageCode === 'fil' || languageCode === 'tl' ? 'fil' : 'en';
}

// One app-wide instance; react-i18next hooks use it via initReactI18next.
const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fil: { translation: fil } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes text.
  returnNull: false,
});

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  const saved = await AsyncStorage.getItem(PREFERENCE_KEY).catch(() => null);
  return saved === 'en' || saved === 'fil' ? saved : 'system';
}

export async function applyLanguagePreference(preference: LanguagePreference) {
  await i18n.changeLanguage(preference === 'system' ? deviceLanguage() : preference);
}

export async function setLanguagePreference(preference: LanguagePreference) {
  await applyLanguagePreference(preference);
  await AsyncStorage.setItem(PREFERENCE_KEY, preference).catch(() => {});
}

export default i18n;
