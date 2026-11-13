import { StyleSheet, Text, View } from 'react-native';

import { Chip, Choice, Field, Segmented } from '@/components/ui';
import type { Goal, Sex } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { space, type } from '@/lib/theme';

export const GOALS: { value: Goal; icon: 'barbell' | 'body' | 'heart' }[] = [
  { value: 'GET_STRONGER', icon: 'barbell' },
  { value: 'BUILD_MUSCLE', icon: 'body' },
  { value: 'GENERAL_FITNESS', icon: 'heart' },
];
export const DAYS = [2, 3, 4, 5];
export const MINUTES = [30, 45, 60, 90];

export type Plan = { goal: Goal | null; days: number | null; minutes: number | null };
export type BodyDraft = { sex: Sex | null; birthYear: string; heightCm: string; weightKg: string };

export const emptyBody: BodyDraft = { sex: null, birthYear: '', heightCm: '', weightKg: '' };

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
};

/** Converts the form strings to API values; empty fields become undefined. */
export const bodyToApi = (b: BodyDraft) => ({
  sex: b.sex ?? undefined,
  birthYear: num(b.birthYear),
  heightCm: num(b.heightCm),
  weightKg: num(b.weightKg),
});

export function bodyIsValid(b: BodyDraft) {
  const v = bodyToApi(b);
  const year = new Date().getFullYear();
  return (
    (v.birthYear === undefined || (v.birthYear >= 1900 && v.birthYear <= year - 18)) &&
    (v.heightCm === undefined || (v.heightCm >= 100 && v.heightCm <= 250)) &&
    (v.weightKg === undefined || (v.weightKg >= 30 && v.weightKg <= 300))
  );
}

export function PlanFields({ plan, onChange }: { plan: Plan; onChange: (p: Plan) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space(3) }}>
      <Text style={type.caption}>{t('plan.goal')}</Text>
      <View style={{ gap: space(2) }}>
        {GOALS.map((g) => (
          <Choice
            key={g.value}
            icon={g.icon}
            label={t(`goal.${g.value}`)}
            selected={plan.goal === g.value}
            onPress={() => onChange({ ...plan, goal: g.value })}
          />
        ))}
      </View>
      <Text style={[type.caption, styles.gapTop]}>{t('plan.days')}</Text>
      <View style={styles.row}>
        {DAYS.map((d) => (
          <Chip key={d} label={String(d)} selected={plan.days === d} onPress={() => onChange({ ...plan, days: d })} />
        ))}
      </View>
      <Text style={[type.caption, styles.gapTop]}>{t('plan.minutes')}</Text>
      <View style={styles.row}>
        {MINUTES.map((m) => (
          <Chip key={m} label={String(m)} selected={plan.minutes === m} onPress={() => onChange({ ...plan, minutes: m })} />
        ))}
      </View>
    </View>
  );
}

export function BodyFields({ body, onChange }: { body: BodyDraft; onChange: (b: BodyDraft) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space(3) }}>
      <Text style={type.caption}>{t('settings.sex')}</Text>
      <Segmented<Sex | 'none'>
        options={[
          { value: 'MALE', label: t('settings.male') },
          { value: 'FEMALE', label: t('settings.female') },
        ]}
        value={body.sex ?? 'none'}
        onChange={(v) => onChange({ ...body, sex: v === 'none' ? null : v })}
      />
      <View style={styles.row}>
        <Field
          label={t('settings.birthYear')}
          value={body.birthYear}
          onChangeText={(v) => onChange({ ...body, birthYear: v })}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="2000"
        />
        <Field
          label={t('settings.height')}
          value={body.heightCm}
          onChangeText={(v) => onChange({ ...body, heightCm: v })}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="175"
        />
        <Field
          label={t('settings.weight')}
          value={body.weightKg}
          onChangeText={(v) => onChange({ ...body, weightKg: v })}
          keyboardType="decimal-pad"
          maxLength={5}
          placeholder="70"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(2) },
  gapTop: { marginTop: space(2) },
});
