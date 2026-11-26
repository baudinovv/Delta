import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BmiFields,
  BodyFields,
  bodyIsValid,
  bodyToApi,
  PlanFields,
  type BodyDraft,
  type Plan,
} from '@/components/profile-fields';
import { Button, Card, ErrorText, Field, IconButton, Loading, Segmented } from '@/components/ui';
import { api, type Lang, type Me } from '@/lib/api';
import { bmiIsValid, parseNum } from '@/lib/bmi';
import { errorText, useI18n } from '@/lib/i18n';
import { useSession, useToken } from '@/lib/session';
import { colors, space, type, webFrame } from '@/lib/theme';

const str = (n?: number | null) => (n == null ? '' : String(n));

export default function SettingsScreen() {
  const token = useToken();
  const { signOut } = useSession();
  const { t, lang, setLang } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [plan, setPlan] = useState<Plan>({ goal: null, days: null, minutes: null });
  const [body, setBody] = useState<BodyDraft>({ sex: null, birthYear: '', heightCm: '', weightKg: '' });
  const [custom, setCustom] = useState('');
  const [bmi, setBmi] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me(token)
      .then((m) => {
        setMe(m);
        setPlan({ goal: m.goal, days: m.daysPerWeek, minutes: m.minutesPerSession });
        setBody({ sex: m.sex ?? null, birthYear: str(m.birthYear), heightCm: str(m.heightCm), weightKg: str(m.weightKg) });
        setCustom(str(m.calorieTarget));
        setBmi(str(m.bmi));
      })
      .catch((e) => setError(errorText(e, t)));
  }, [token, t]);

  const customKcal = custom.trim() ? Number(custom) : null;
  const customOk = customKcal == null || (customKcal >= 800 && customKcal <= 6000);

  const save = async () => {
    if (!plan.goal || !plan.days || !plan.minutes) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateProfile(token, {
        goal: plan.goal,
        daysPerWeek: plan.days,
        minutesPerSession: plan.minutes,
        ...bodyToApi(body),
        bmi: parseNum(bmi) ?? null,
        calorieTarget: customKcal,
      });
      setMe(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSaving(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.screen} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
      <View style={[styles.head, webFrame]}>
        <Text style={[type.h1, { flex: 1 }]}>{t('settings.title')}</Text>
        <IconButton icon="close" label="close" onPress={close} />
      </View>
      {!me && !error ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, webFrame]} keyboardShouldPersistTaps="handled">
          <ErrorText message={error} />

          <Card style={styles.section}>
            <Text style={type.h3}>{t('settings.language')}</Text>
            <Segmented<Lang>
              options={[
                { value: 'ru', label: 'Русский' },
                { value: 'en', label: 'English' },
              ]}
              value={lang}
              onChange={setLang}
            />
          </Card>

          <Card style={styles.section}>
            <Text style={type.h3}>{t('settings.bmi')}</Text>
            <BmiFields bmi={bmi} onChange={setBmi} showHelper={false} />
          </Card>

          <Card style={styles.section}>
            <Text style={type.h3}>{t('settings.body')}</Text>
            <BodyFields body={body} onChange={setBody} />
          </Card>

          <Card style={styles.section}>
            <Text style={type.h3}>{t('settings.calories')}</Text>
            {me?.targets && !me.targets.custom && (
              <Text style={[type.body, { color: colors.accent }]}>{t('settings.auto', { n: me.targets.kcal })}</Text>
            )}
            <Field
              label={t('settings.custom')}
              value={custom}
              onChangeText={setCustom}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="—"
            />
            <Text style={[type.small, { fontSize: 13 }]}>{t('settings.customHint')}</Text>
            <Button title={t('calc.title')} icon="calculator" variant="secondary" onPress={() => router.push('/calculator')} />
          </Card>

          <Card style={styles.section}>
            <Text style={type.h3}>{t('settings.plan')}</Text>
            <PlanFields plan={plan} onChange={setPlan} />
          </Card>

          <Button
            title={saved ? t('settings.saved') : t('common.save')}
            icon={saved ? 'checkmark-circle' : undefined}
            onPress={save}
            loading={saving}
            disabled={!bodyIsValid(body) || !customOk || !plan.goal || (bmi.trim() !== '' && !bmiIsValid(parseNum(bmi)))}
          />

          <View style={{ gap: space(2), marginTop: space(6) }}>
            <Button title={t('settings.signOut')} icon="log-out-outline" variant="danger" onPress={signOut} />
            <Text style={[type.small, { textAlign: 'center', fontSize: 12 }]}>{t('settings.signOutHint')}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: space(4), paddingBottom: space(2) },
  content: { padding: space(4), paddingBottom: space(16), gap: space(3) },
  section: { gap: space(3) },
});
