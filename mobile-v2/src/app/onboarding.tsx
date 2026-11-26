import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BmiFields,
  BodyFields,
  bodyIsValid,
  bodyToApi,
  emptyBody,
  PlanFields,
  type BodyDraft,
  type Plan,
} from '@/components/profile-fields';
import { Button, Card, Choice, ErrorText } from '@/components/ui';
import { api, type Screening } from '@/lib/api';
import { bmiIsValid, parseNum } from '@/lib/bmi';
import { errorText, useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, radius, space, type, webFrame } from '@/lib/theme';

const QUESTIONS: (keyof Screening)[] = ['heartCondition', 'chestPain', 'dizziness', 'injury', 'pregnant'];

type Step = 'age' | 'health' | 'week' | 'bmi' | 'body' | 'consent' | 'referred';
const ORDER: Step[] = ['age', 'health', 'week', 'bmi', 'body', 'consent'];
type Referral = 'UNDER_18' | 'HEALTH_SCREENING';

export default function Onboarding() {
  const { signIn } = useSession();
  const { t, lang, setLang } = useI18n();
  const [step, setStep] = useState<Step>('age');
  const [referral, setReferral] = useState<Referral>('UNDER_18');
  const [answers, setAnswers] = useState<Partial<Screening>>({});
  const [plan, setPlan] = useState<Plan>({ goal: null, days: null, minutes: null });
  const [body, setBody] = useState<BodyDraft>(emptyBody);
  const [bmi, setBmi] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refer = (r: Referral) => {
    setReferral(r);
    setStep('referred');
  };

  const allAnswered = QUESTIONS.every((q) => answers[q] !== undefined);
  const stepIndex = ORDER.indexOf(step);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.onboard({
        adult: true,
        screening: answers as Screening,
        consent,
        goal: plan.goal!,
        daysPerWeek: plan.days!,
        minutesPerSession: plan.minutes!,
        bmi: parseNum(bmi),
        body: bodyToApi(body),
      });
      if (res.status === 'ADMITTED') await signIn(res.token);
      else refer(res.reason);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setBmi('');
    setConsent(false);
    setStep('age');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, webFrame]} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>Δ</Text>
            </View>
            <Text style={type.h3}>Delta</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')}
            style={styles.langBtn}
            hitSlop={8}>
            <Ionicons name="language" size={16} color={colors.muted} />
            <Text style={[type.small, { color: colors.text, fontWeight: '700' }]}>{lang === 'ru' ? 'RU' : 'EN'}</Text>
          </Pressable>
        </View>

        {stepIndex > 0 && (
          <View style={styles.progress}>
            {ORDER.map((s, i) => (
              <View key={s} style={[styles.progressSeg, i <= stepIndex && { backgroundColor: colors.accent }]} />
            ))}
          </View>
        )}

        {step === 'age' && (
          <>
            <View style={styles.hero}>
              <Text style={[type.display, { fontSize: 38, lineHeight: 44 }]}>{t('ob.tagline')}</Text>
              <Text style={[type.body, { color: colors.muted, fontSize: 17, lineHeight: 24 }]}>{t('ob.lead')}</Text>
              <View style={styles.features}>
                <Feature icon="barbell" color={colors.accent} />
                <Feature icon="camera" color={colors.fat} />
                <Feature icon="sparkles" color={colors.protein} />
                <Feature icon="stats-chart" color={colors.carbs} />
              </View>
            </View>
            <Card style={{ gap: space(4) }}>
              <Text style={type.h2}>{t('ob.adult')}</Text>
              <View style={styles.row}>
                <Button title={t('common.yes')} onPress={() => setStep('health')} style={{ flex: 1 }} />
                <Button title={t('common.no')} variant="secondary" onPress={() => refer('UNDER_18')} style={{ flex: 1 }} />
              </View>
            </Card>
          </>
        )}

        {step === 'health' && (
          <>
            <Text style={type.h1}>{t('ob.healthTitle')}</Text>
            <Text style={styles.lead}>{t('ob.healthLead')}</Text>
            {QUESTIONS.map((q, i) => (
              <Card key={q} style={{ gap: space(3) }}>
                <Text style={type.body}>
                  <Text style={{ color: colors.faint }}>{i + 1}. </Text>
                  {t(`ob.q.${q}`)}
                </Text>
                <View style={styles.row}>
                  <YesNo label={t('common.no')} on={answers[q] === false} onPress={() => setAnswers((a) => ({ ...a, [q]: false }))} />
                  <YesNo label={t('common.yes')} on={answers[q] === true} onPress={() => setAnswers((a) => ({ ...a, [q]: true }))} />
                </View>
              </Card>
            ))}
            <Button
              title={t('common.continue')}
              disabled={!allAnswered}
              onPress={() => (QUESTIONS.some((q) => answers[q]) ? refer('HEALTH_SCREENING') : setStep('week'))}
            />
          </>
        )}

        {step === 'week' && (
          <>
            <Text style={type.h1}>{t('ob.weekTitle')}</Text>
            <PlanFields plan={plan} onChange={setPlan} />
            <Button
              title={t('common.continue')}
              disabled={!plan.goal || !plan.days || !plan.minutes}
              onPress={() => setStep('bmi')}
              style={{ marginTop: space(4) }}
            />
          </>
        )}

        {step === 'bmi' && (
          <>
            <Text style={type.h1}>{t('ob.bmiTitle')}</Text>
            <Text style={styles.lead}>{t('bmi.lead')}</Text>
            <Card>
              <BmiFields
                bmi={bmi}
                onChange={setBmi}
                onCalculated={(h, w) => setBody((b) => ({ ...b, heightCm: String(h), weightKg: String(w) }))}
              />
            </Card>
            <Button
              title={t('common.continue')}
              disabled={!bmiIsValid(parseNum(bmi))}
              onPress={() => setStep('body')}
              style={{ marginTop: space(2) }}
            />
          </>
        )}

        {step === 'body' && (
          <>
            <Text style={type.h1}>{t('ob.bodyTitle')}</Text>
            <Text style={styles.lead}>{t('ob.bodyLead')}</Text>
            <BodyFields body={body} onChange={setBody} />
            <Button
              title={t('common.continue')}
              disabled={!bodyIsValid(body)}
              onPress={() => setStep('consent')}
              style={{ marginTop: space(4) }}
            />
            <Button
              title={t('ob.skip')}
              variant="ghost"
              onPress={() => {
                setBody(emptyBody);
                setStep('consent');
              }}
            />
          </>
        )}

        {step === 'consent' && (
          <>
            <Text style={type.h1}>{t('ob.consentTitle')}</Text>
            <Card>
              <Text style={[type.body, { lineHeight: 25 }]}>{t('ob.consentText')}</Text>
            </Card>
            <Choice label={t('ob.agree')} selected={consent} onPress={() => setConsent((c) => !c)} />
            <Button title={t('ob.start')} disabled={!consent} loading={submitting} onPress={submit} />
            <ErrorText message={error} />
          </>
        )}

        {step === 'referred' && (
          <>
            <Text style={type.h1}>{t('ob.referredTitle')}</Text>
            <Card style={{ flexDirection: 'row', gap: space(3) }}>
              <Ionicons name="medkit" size={22} color={colors.warn} />
              <Text style={[type.body, { flex: 1 }]}>{t(`ob.${referral}`)}</Text>
            </Card>
            <Button title={t('ob.back')} variant="secondary" onPress={restart} />
          </>
        )}

        {stepIndex > 0 && step !== 'referred' && (
          <Button
            title="←"
            variant="ghost"
            size="md"
            onPress={() => setStep(ORDER[stepIndex - 1])}
            style={{ alignSelf: 'flex-start' }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ icon, color }: { icon: 'barbell' | 'camera' | 'sparkles' | 'stats-chart'; color: string }) {
  return (
    <View style={[styles.feature, { backgroundColor: `${color}1F` }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
  );
}

function YesNo({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.yesNo, on && styles.yesNoOn]}>
      <Text style={[type.h3, { color: on ? colors.accentInk : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), paddingBottom: space(12), gap: space(4) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontWeight: '900', color: colors.accentInk },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  progress: { flexDirection: 'row', gap: space(1.5) },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface3 },
  hero: { gap: space(4), paddingVertical: space(8) },
  features: { flexDirection: 'row', gap: space(3), marginTop: space(2) },
  feature: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  lead: { ...type.body, color: colors.muted },
  row: { flexDirection: 'row', gap: space(2) },
  yesNo: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesNoOn: { backgroundColor: colors.accent },
});
