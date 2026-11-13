import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Choice, ErrorText } from '@/components/ui';
import { api, ApiError, type Goal, type Screening } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, space } from '@/lib/theme';

const REFERRAL = {
  UNDER_18:
    'Delta is for adults 18 and over. Please train with a qualified coach or a PE teacher who can supervise you.',
  HEALTH_SCREENING:
    "Based on your answers, Delta can't safely guide your training on its own. Please talk to a doctor or a qualified trainer before you start.",
};

const QUESTIONS: { key: keyof Screening; text: string }[] = [
  { key: 'heartCondition', text: 'Has a doctor ever said you have a heart condition or high blood pressure?' },
  { key: 'chestPain', text: 'Do you feel pain in your chest at rest or during physical activity?' },
  { key: 'dizziness', text: 'Do you lose balance because of dizziness, or have you fainted in the last 12 months?' },
  { key: 'injury', text: 'Do you have a current injury, or a bone or joint problem that exercise could make worse?' },
  { key: 'pregnant', text: 'Are you pregnant, or have you given birth in the last 6 months?' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'GET_STRONGER', label: 'Get stronger' },
  { value: 'BUILD_MUSCLE', label: 'Build muscle' },
  { value: 'GENERAL_FITNESS', label: 'General fitness' },
];
const DAYS = [2, 3, 4, 5];
const MINUTES = [30, 45, 60, 90];

type Step = 'age' | 'health' | 'week' | 'consent' | 'referred';

export default function Onboarding() {
  const { signIn } = useSession();
  const [step, setStep] = useState<Step>('age');
  const [referral, setReferral] = useState('');
  const [answers, setAnswers] = useState<Partial<Screening>>({});
  const [goal, setGoal] = useState<Goal | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refer = (message: string) => {
    setReferral(message);
    setStep('referred');
  };

  const allAnswered = QUESTIONS.every((q) => answers[q.key] !== undefined);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.onboard({
        adult: true,
        screening: answers as Screening,
        consent,
        goal: goal!,
        daysPerWeek: days!,
        minutesPerSession: minutes!,
      });
      if (res.status === 'ADMITTED') await signIn(res.token);
      else refer(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setConsent(false);
    setStep('age');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Δ Delta</Text>

        {step === 'age' && (
          <>
            <Text style={styles.title}>See whether your training is working.</Text>
            <Text style={styles.lead}>Log your sets, and every Sunday get one screen with what actually changed.</Text>
            <Card>
              <Text style={styles.question}>Are you 18 or older?</Text>
              <View style={styles.row}>
                <Choice label="Yes" selected={false} onPress={() => setStep('health')} />
                <Choice label="No" selected={false} onPress={() => refer(REFERRAL.UNDER_18)} />
              </View>
            </Card>
          </>
        )}

        {step === 'health' && (
          <>
            <Text style={styles.title}>A few health questions</Text>
            <Text style={styles.lead}>Your answers are only used to check it's safe to start. They aren't stored.</Text>
            {QUESTIONS.map((q, i) => (
              <Card key={q.key} style={{ marginBottom: space(3) }}>
                <Text style={styles.question}>
                  {i + 1}. {q.text}
                </Text>
                <View style={styles.row}>
                  <Choice
                    label="No"
                    selected={answers[q.key] === false}
                    onPress={() => setAnswers((a) => ({ ...a, [q.key]: false }))}
                  />
                  <Choice
                    label="Yes"
                    selected={answers[q.key] === true}
                    onPress={() => setAnswers((a) => ({ ...a, [q.key]: true }))}
                  />
                </View>
              </Card>
            ))}
            <Button
              title="Continue"
              disabled={!allAnswered}
              onPress={() =>
                QUESTIONS.some((q) => answers[q.key]) ? refer(REFERRAL.HEALTH_SCREENING) : setStep('week')
              }
            />
          </>
        )}

        {step === 'week' && (
          <>
            <Text style={styles.title}>Your week</Text>
            <Text style={styles.label}>Main goal</Text>
            <View style={styles.column}>
              {GOALS.map((g) => (
                <Choice key={g.value} label={g.label} selected={goal === g.value} onPress={() => setGoal(g.value)} />
              ))}
            </View>
            <Text style={styles.label}>Days per week you can train</Text>
            <View style={styles.row}>
              {DAYS.map((d) => (
                <Choice key={d} label={String(d)} selected={days === d} onPress={() => setDays(d)} />
              ))}
            </View>
            <Text style={styles.label}>Minutes per session</Text>
            <View style={styles.row}>
              {MINUTES.map((m) => (
                <Choice key={m} label={String(m)} selected={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </View>
            <View style={{ height: space(6) }} />
            <Button title="Continue" disabled={!goal || !days || !minutes} onPress={() => setStep('consent')} />
          </>
        )}

        {step === 'consent' && (
          <>
            <Text style={styles.title}>Before you start</Text>
            <Card>
              <Text style={styles.body}>
                • Delta is a training log for healthy adults. It is not medical advice.{'\n'}• Stop and see a doctor
                if you feel pain, dizziness or chest discomfort.{'\n'}• We don't ask for your name. Your logs are
                stored under a random ID and seen only by the Delta pilot team.{'\n'}• You can leave the pilot and ask
                us to delete your data at any time.
              </Text>
            </Card>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent((c) => !c)}
              style={styles.checkRow}>
              <View style={[styles.checkbox, consent && styles.checkboxOn]}>
                {consent && <Text style={{ color: colors.lime, fontWeight: '900' }}>✓</Text>}
              </View>
              <Text style={[styles.body, { flex: 1 }]}>I've read this and agree to take part.</Text>
            </Pressable>
            <Button title="Start" disabled={!consent} loading={submitting} onPress={submit} />
            <ErrorText message={error} />
          </>
        )}

        {step === 'referred' && (
          <>
            <Text style={styles.title}>Delta isn't the right fit right now</Text>
            <Card>
              <Text style={styles.body}>{referral}</Text>
            </Card>
            <View style={{ height: space(6) }} />
            <Button title="Back to start" variant="secondary" onPress={restart} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), paddingBottom: space(10) },
  brand: { fontSize: 18, fontWeight: '800', color: colors.navy, marginBottom: space(6) },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: space(3) },
  lead: { fontSize: 16, color: colors.muted, marginBottom: space(6), lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: space(5), marginBottom: space(2) },
  question: { fontSize: 16, color: colors.text, marginBottom: space(3), lineHeight: 22 },
  body: { fontSize: 16, color: colors.text, lineHeight: 24 },
  row: { flexDirection: 'row', gap: space(2) },
  column: { gap: space(2) },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(5) },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.navy },
});
