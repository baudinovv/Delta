import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Button, Card, Choice, ErrorText, Field, IconButton, Segmented } from '@/components/ui';
import { api, type Me } from '@/lib/api';
import { bmiCategory, calcBmi, parseNum } from '@/lib/bmi';
import { errorText, useI18n } from '@/lib/i18n';
import { ACTIVITY_FACTOR, calcKbju, type Activity, type KbjuGoal, type Sex } from '@/lib/kbju';
import { useToken } from '@/lib/session';
import { colors, radius, space, type, webFrame } from '@/lib/theme';

const ACTIVITIES = Object.keys(ACTIVITY_FACTOR) as Activity[];
const GOALS: KbjuGoal[] = ['LOSE', 'MAINTAIN', 'GAIN'];

const str = (n?: number | null) => (n == null ? '' : String(n));

export default function CalculatorScreen() {
  const token = useToken();
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [sex, setSex] = useState<Sex>('MALE');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<Activity>('MODERATE');
  const [goal, setGoal] = useState<KbjuGoal>('MAINTAIN');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the profile so the user doesn't type everything twice.
  useEffect(() => {
    api
      .me(token)
      .then((m) => {
        setMe(m);
        if (m.sex) setSex(m.sex);
        if (m.birthYear) setAge(String(new Date().getFullYear() - m.birthYear));
        setHeight(str(m.heightCm));
        setWeight(str(m.weightKg));
        setGoal(m.goal === 'BUILD_MUSCLE' ? 'GAIN' : 'MAINTAIN');
        setActivity(m.daysPerWeek <= 2 ? 'LIGHT' : m.daysPerWeek <= 4 ? 'MODERATE' : 'HIGH');
      })
      .catch(() => undefined);
  }, [token]);

  const a = parseNum(age);
  const h = parseNum(height);
  const w = parseNum(weight);
  const ready = a !== undefined && a >= 14 && a <= 100 && h !== undefined && h >= 100 && h <= 250 && w !== undefined && w >= 30 && w <= 300;

  const result = useMemo(
    () => (ready ? calcKbju({ sex, age: a!, heightCm: h!, weightKg: w!, activity, goal }) : null),
    [ready, sex, a, h, w, activity, goal],
  );
  const bmi = ready ? calcBmi(h!, w!) : null;

  const apply = async () => {
    if (!result || !me) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile(token, {
        goal: me.goal,
        daysPerWeek: me.daysPerWeek,
        minutesPerSession: me.minutesPerSession,
        sex,
        birthYear: me.birthYear ?? new Date().getFullYear() - a!,
        heightCm: h!,
        weightKg: w!,
        bmi: me.bmi ?? bmi,
        calorieTarget: result.kcal,
      });
      setSaved(true);
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
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>{t('calc.sub')}</Text>
          <Text style={type.h1}>{t('calc.title')}</Text>
        </View>
        <IconButton icon="close" label="close" onPress={close} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webFrame]} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: space(3) }}>
          <Segmented<Sex>
            options={[
              { value: 'MALE', label: t('settings.male') },
              { value: 'FEMALE', label: t('settings.female') },
            ]}
            value={sex}
            onChange={(v) => {
              setSex(v);
              setSaved(false);
            }}
          />
          <View style={styles.row}>
            <Field label={t('calc.age')} value={age} onChangeText={(v) => { setAge(v); setSaved(false); }} keyboardType="number-pad" maxLength={3} placeholder="25" />
            <Field label={t('settings.height')} value={height} onChangeText={(v) => { setHeight(v); setSaved(false); }} keyboardType="number-pad" maxLength={3} placeholder="175" />
            <Field label={t('settings.weight')} value={weight} onChangeText={(v) => { setWeight(v); setSaved(false); }} keyboardType="decimal-pad" maxLength={5} placeholder="70" />
          </View>
        </Card>

        <Text style={[type.caption, styles.gap]}>{t('calc.goal')}</Text>
        <Segmented<KbjuGoal>
          options={GOALS.map((g) => ({ value: g, label: t(`calc.goal.${g}`) }))}
          value={goal}
          onChange={(v) => {
            setGoal(v);
            setSaved(false);
          }}
        />

        <Text style={[type.caption, styles.gap]}>{t('calc.activity')}</Text>
        <View style={{ gap: space(2) }}>
          {ACTIVITIES.map((x) => (
            <Choice
              key={x}
              label={t(`calc.act.${x}`)}
              selected={activity === x}
              onPress={() => {
                setActivity(x);
                setSaved(false);
              }}
            />
          ))}
        </View>

        {!result && <Banner text={t('calc.fill')} />}

        {result && bmi != null && (
          <Card style={{ gap: space(4), marginTop: space(2) }}>
            <Text style={type.caption}>{t('calc.result')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space(2) }}>
              <Text style={type.display}>{result.kcal}</Text>
              <Text style={[type.h3, { color: colors.muted }]}>{t('common.kcal')}</Text>
            </View>

            <View style={styles.row}>
              <Macro label={t('macro.protein')} value={result.proteinG} color={colors.protein} unit={t('common.g')} />
              <Macro label={t('macro.fat')} value={result.fatG} color={colors.fat} unit={t('common.g')} />
              <Macro label={t('macro.carbs')} value={result.carbsG} color={colors.carbs} unit={t('common.g')} />
            </View>

            <View style={styles.divider} />
            <Line label={t('calc.bmr')} value={`${result.bmr} ${t('common.kcal')}`} />
            <Line label={t('calc.tdee')} value={`${result.tdee} ${t('common.kcal')}`} />
            <Line label={t('bmi.field')} value={`${bmi} · ${t(`bmi.${bmiCategory(bmi)}`)}`} />
          </Card>
        )}

        {result && (
          <Button
            title={saved ? t('calc.applied') : t('calc.apply')}
            icon={saved ? 'checkmark-circle' : undefined}
            onPress={apply}
            loading={saving}
            disabled={!me || saved}
          />
        )}
        <ErrorText message={error} />
        <Text style={[type.small, { fontSize: 12, textAlign: 'center', color: colors.faint }]}>{t('calc.formula')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Macro({ label, value, color, unit }: { label: string; value: number; color: string; unit: string }) {
  return (
    <View style={[styles.macro, { backgroundColor: `${color}1A` }]}>
      <Text style={[type.caption, { color }]}>{label}</Text>
      <Text style={[type.h2, { marginTop: 2 }]}>
        {value} <Text style={[type.small, { fontSize: 13 }]}>{unit}</Text>
      </Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={type.small}>{label}</Text>
      <Text style={[type.body, { fontWeight: '700', fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: space(4), paddingBottom: space(2) },
  content: { padding: space(4), paddingBottom: space(16), gap: space(3) },
  row: { flexDirection: 'row', gap: space(2) },
  gap: { marginTop: space(2) },
  macro: { flex: 1, borderRadius: radius.md, padding: space(3) },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
