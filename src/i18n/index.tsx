import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, TranslationKey } from './en';
import { hi } from './hi';

export type Language = 'en' | 'hi';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  // Labelled in its own script on purpose — someone who needs Hindi shouldn't
  // have to read the word "Hindi" in English to find it.
  { value: 'hi', label: 'हिन्दी' },
];

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, hi };

const STORAGE_KEY = 'parknext.language';

export type TranslateVars = Record<string, string | number>;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Looks up `key` in the active language and fills any `{{placeholders}}`. */
  t: (key: TranslationKey, vars?: TranslateVars) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function translate(language: Language, key: TranslationKey, vars?: TranslateVars): string {
  // `hi` is typed against `en`'s keys, so a miss here means a bad cast
  // somewhere rather than an untranslated string — fall back to English so a
  // screen degrades to readable rather than blank.
  const template = DICTIONARIES[language][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    name in vars ? String(vars[name]) : `{{${name}}}`
  );
}

/**
 * App language, persisted per device.
 *
 * Defaults to English rather than reading the device locale: detecting that
 * needs `expo-localization`, which is a native module and so a rebuild, and
 * this app is distributed as a dev build today. Swapping the default for the
 * device's own language is a two-line change once that dependency is worth
 * adding.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored === 'en' || stored === 'hi') setLanguageState(stored);
      })
      .catch(() => {
        // A device that can't read storage still gets a working app in English.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    // Applied immediately; the write is fire-and-forget so switching never
    // waits on the disk.
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

export type { TranslationKey };
