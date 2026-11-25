import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BodyFields,
  bodyIsValid,
  bodyToApi,
  emptyBody,
  PlanFields,
  type BodyDraft,
  type Plan,
} from '@/components/profile-fields';
import { PressScale } from '@/components/motion';
import { Button, Card, Choice, ErrorText, Field, IconButton, PasswordField } from '@/components/ui';
import { api, ApiError, type Screening } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, radius, space, type, webFrame } from '@/lib/theme';

const QUESTIONS: (keyof Screening)[] = ['heartCondition', 'chestPain', 'dizziness', 'injury', 'pregnant'];

type Step = 'age' | 'health' | 'week' | 'body' | 'consent' | 'account' | 'referred';
const ORDER: Step[] = ['age', 'health', 'week', 'body', 'consent', 'account'];
type Referral = 'UNDER_18' | 'HEALTH_SCREENING';

export default function Onboarding() {
  const { signIn } = useSession();
  const { t } = useI18n();
  const [step, setStepRaw] = useState<Step>('age');
  const [dir, setDir] = useState<1 | -1>(1);
  /** Moves between steps and remembers the direction, so the next step slides in from the right side. */
  const goTo = (next: Step) => {
    const a = ORDER.indexOf(step);
    const b = ORDER.indexOf(next);
    setDir(b >= a || b < 0 ? 1 : -1);
    setStepRaw(next);
  };
  const [referral, setReferral] = useState<Referral>('UNDER_18');
  const [answers, setAnswers] = useState<Partial<Screening>>({});
  const [plan, setPlan] = useState<Plan>({ goal: null, days: null, minutes: null });
  const [body, setBody] = useState<BodyDraft>(emptyBody);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refer = (r: Referral) => {
    setReferral(r);
    goTo('referred');
  };

  const allAnswered = QUESTIONS.every((q) => answers[q] !== undefined);
  const stepIndex = Math.max(0, ORDER.indexOf(step));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const accountOk = name.trim().length > 0 && emailOk && password.length >= 8;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setEmailTaken(false);
    try {
      const res = await api.register({
        adult: true,
        screening: answers as Screening,
        consent,
        goal: plan.goal!,
        daysPerWeek: plan.days!,
        minutesPerSession: plan.minutes!,
        body: bodyToApi(body),
        account: { name: name.trim(), email: email.trim(), password },
      });
      if (res.status === 'ADMITTED') await signIn(res.token);
      else refer(res.reason);
    } catch (e) {
      setEmailTaken(e instanceof ApiError && e.code === 'EMAIL_TAKEN');
      setError(errorText(e, t));
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    if (step === 'age' || step === 'referred') router.back();
    else goTo(ORDER[stepIndex - 1]);
  };

  const restart = () => {
    setAnswers({});
    setConsent(false);
    goTo('age');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, webFrame]} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <IconButton icon="chevron-back" label="back" onPress={back} />
          {step !== 'referred' && (
            <View style={styles.progress}>
              {ORDER.map((st, i) => (
                <ProgressSegment key={st} on={i <= stepIndex} />
              ))}
            </View>
          )}
          {step !== 'referred' && (
            <Text style={[type.small, type.num, { fontSize: 12 }]}>
              {stepIndex + 1}/{ORDER.length}
            </Text>
          )}
        </View>

        <Animated.View
          key={step}
          entering={(dir > 0 ? FadeInRight : FadeInLeft).duration(320)}
          style={{ gap: space(4) }}>
        {step === 'age' && (
          <>
            <Text style={type.h1}>{t('ob.adult')}</Text>
            <View style={{ gap: space(3), marginTop: space(2) }}>
              <Button title={t('common.yes')} onPress={() => goTo('health')} />
              <Button title={t('common.no')} variant="secondary" onPress={() => refer('UNDER_18')} />
            </View>
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
              onPress={() => (QUESTIONS.some((q) => answers[q]) ? refer('HEALTH_SCREENING') : goTo('week'))}
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
              onPress={() => goTo('body')}
              style={{ marginTop: space(4) }}
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
              onPress={() => goTo('consent')}
              style={{ marginTop: space(4) }}
            />
            <Button
              title={t('ob.skip')}
              variant="ghost"
              onPress={() => {
                setBody(emptyBody);
                goTo('consent');
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
            <Button title={t('common.continue')} disabled={!consent} onPress={() => goTo('account')} />
          </>
        )}

        {step === 'account' && (
          <>
            <Text style={type.h1}>{t('auth.accountTitle')}</Text>
            <Text style={styles.lead}>{t('auth.accountLead')}</Text>
            <Field
              label={t('auth.name')}
              placeholder={t('auth.namePh')}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
              maxLength={40}
            />
            <Field
              label={t('auth.email')}
              placeholder="you@example.com"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setEmailTaken(false);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={254}
            />
            <PasswordField
              label={t('auth.password')}
              hint={t('auth.passwordHint')}
              showLabel={t('auth.show')}
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              maxLength={72}
            />
            <ErrorText message={error} />
            {emailTaken && (
              <Button title={t('auth.signIn')} variant="secondary" onPress={() => router.replace('/login')} />
            )}
            <Button title={t('auth.create')} disabled={!accountOk} loading={submitting} onPress={submit} />
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

        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProgressSegment({ on }: { on: boolean }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [on, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={styles.progressSeg}>
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
}

function YesNo({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hapticKind="select"
      scaleTo={0.94}
      style={[styles.yesNo, on && styles.yesNoOn]}>
      <Text style={[type.h3, { color: on ? colors.accentInk : colors.text }]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), paddingBottom: space(12), gap: space(4) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(2) },
  progress: { flex: 1, flexDirection: 'row', gap: space(1.5) },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface3, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
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
