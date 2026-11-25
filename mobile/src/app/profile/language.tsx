import { router } from 'expo-router';

import { Choice, Screen } from '@/components/ui';
import type { Lang } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const LANGS: { value: Lang; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

export default function LanguageScreen() {
  const { lang, setLang } = useI18n();
  return (
    <Screen inStack>
      {LANGS.map((l) => (
        <Choice
          key={l.value}
          label={l.label}
          selected={lang === l.value}
          onPress={() => {
            setLang(l.value);
            router.back();
          }}
        />
      ))}
    </Screen>
  );
}
