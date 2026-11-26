import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle } from '@/components/ui';
import { api, type LoggedSet, type PrefillRow } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

type Draft = { weight: string; reps: string };

const toDraft = (r: PrefillRow): Draft => ({
  weight: r.weightKg != null ? String(r.weightKg) : '',
  reps: r.reps != null ? String(r.reps) : '',
});

const parseNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};

export default function WorkoutScreen() {
  const token = useToken();
  const { t, ex } = useI18n();
  const [rows, setRows] = useState<PrefillRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [todaySets, setTodaySets] = useState<LoggedSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingExercise, setSavingExercise] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.today(token);
      setRows(data.rows);
      setDrafts(Object.fromEntries(data.rows.map((r) => [r.exercise, toDraft(r)])));
      setTodaySets(data.todaySets);
      setError(null);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const setDraft = (exercise: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [exercise]: { ...d[exercise], ...patch } }));

  const step = (exercise: string, field: keyof Draft, delta: number) => {
    const current = parseNum(drafts[exercise]?.[field] ?? '') ?? 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    setDraft(exercise, { [field]: String(next) });
  };

  const save = async (exercise: string) => {
    const d = drafts[exercise];
    const weight = parseNum(d.weight);
    const reps = parseNum(d.reps);
    if (weight == null || reps == null) return;
    setSavingExercise(exercise);
    try {
      await api.logSet(token, exercise, weight, reps);
      await load();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSavingExercise(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteSet(token, id);
      await load();
    } catch (e) {
      setError(errorText(e, t));
    }
  };

  const addExercise = () => {
    const name = newExercise.trim().replace(/\s+/g, ' ');
    if (!name || rows.some((r) => r.exercise.toLowerCase() === name.toLowerCase())) return;
    const row: PrefillRow = { exercise: name, hint: 'new' };
    setRows((r) => [...r, row]);
    setDrafts((d) => ({ ...d, [name]: toDraft(row) }));
    setNewExercise('');
  };

  if (loading) return <Loading />;

  const volume = todaySets.reduce((s, x) => s + x.weightKg * x.reps, 0);
  const setsBy = (exercise: string) => todaySets.filter((s) => s.exercise === exercise);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        title={t('workout.title')}
        onRefresh={load}
        right={
          <View style={styles.todayStats}>
            <Text style={[type.h2, type.num]}>{todaySets.length}</Text>
            <Text style={[type.small, { fontSize: 12 }]}>{t('workout.sets')}</Text>
            <View style={styles.divider} />
            <Text style={[type.h2, type.num]}>{Math.round(volume)}</Text>
            <Text style={[type.small, { fontSize: 12 }]}>{t('common.kg')}</Text>
          </View>
        }>
        <ErrorText message={error} />

        {rows.map((r) => {
          const d = drafts[r.exercise] ?? { weight: '', reps: '' };
          const weight = parseNum(d.weight);
          const reps = parseNum(d.reps);
          const needsReps = weight != null && reps == null;
          const isNew = r.hint != null;
          const done = setsBy(r.exercise);
          return (
            <Card key={r.exercise} style={{ gap: space(3) }}>
              <View style={styles.rowHeader}>
                <Text style={[type.h2, { flex: 1 }]}>{ex(r.exercise)}</Text>
                {!isNew && (
                  <View style={styles.lastPill}>
                    <Ionicons name="time-outline" size={12} color={colors.muted} />
                    <Text style={[type.small, type.num, { fontSize: 12 }]}>
                      {r.weightKg} × {r.reps}
                    </Text>
                  </View>
                )}
              </View>
              {isNew && <Text style={type.small}>{t('workout.new')}</Text>}

              {done.length > 0 && (
                <View style={styles.doneRow}>
                  {done.map((s, i) => (
                    <View key={s.id} style={styles.donePill}>
                      <Text style={styles.doneText}>
                        {i + 1}. {s.weightKg}×{s.reps}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.inputs}>
                <Stepper
                  label={t('common.kg')}
                  value={d.weight}
                  onChange={(v) => setDraft(r.exercise, { weight: v })}
                  onMinus={() => step(r.exercise, 'weight', -2.5)}
                  onPlus={() => step(r.exercise, 'weight', 2.5)}
                  decimal
                />
                <Stepper
                  label={t('workout.reps')}
                  value={d.reps}
                  onChange={(v) => setDraft(r.exercise, { reps: v })}
                  onMinus={() => step(r.exercise, 'reps', -1)}
                  onPlus={() => step(r.exercise, 'reps', 1)}
                />
              </View>

              {needsReps && <Text style={styles.flag}>{t('workout.enterReps')}</Text>}

              <Button
                title={t('workout.saveSet')}
                icon="checkmark"
                onPress={() => save(r.exercise)}
                disabled={weight == null || reps == null || reps < 1}
                loading={savingExercise === r.exercise}
              />
            </Card>
          );
        })}

        <Card style={{ gap: space(3) }}>
          <Text style={type.h3}>{t('workout.add')}</Text>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Field
              placeholder={t('workout.addPlaceholder')}
              value={newExercise}
              onChangeText={setNewExercise}
              onSubmitEditing={addExercise}
              maxLength={60}
            />
            <Button title={t('workout.addBtn')} icon="add" variant="secondary" onPress={addExercise} disabled={!newExercise.trim()} />
          </View>
        </Card>

        <SectionTitle>{t('workout.today')}</SectionTitle>
        {todaySets.length === 0 ? (
          <Text style={type.small}>{t('workout.noSets')}</Text>
        ) : (
          <Card style={{ paddingVertical: space(1) }}>
            {todaySets.map((s, i) => (
              <View key={s.id} style={[styles.loggedRow, i > 0 && styles.loggedBorder]}>
                <Text style={[type.body, { flex: 1 }]}>{ex(s.exercise)}</Text>
                <Text style={[type.body, type.num, { fontWeight: '700' }]}>
                  {s.weightKg} {t('common.kg')} × {s.reps}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => remove(s.id)} hitSlop={12}>
                  <Text style={styles.undo}>{t('workout.undo')}</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Stepper(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  decimal?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: space(1.5) }}>
      <View style={styles.stepper}>
        <Pressable accessibilityLabel={`- ${props.label}`} onPress={props.onMinus} style={styles.stepBtn} hitSlop={4}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={props.value}
          onChangeText={props.onChange}
          keyboardType={props.decimal ? 'decimal-pad' : 'number-pad'}
          placeholder="–"
          placeholderTextColor={colors.faint}
          selectTextOnFocus
        />
        <Pressable accessibilityLabel={`+ ${props.label}`} onPress={props.onPlus} style={styles.stepBtn} hitSlop={4}>
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.unit}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  todayStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space(1),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
  },
  divider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: space(1.5) },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  lastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
  },
  doneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  donePill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
  },
  doneText: { color: colors.accent, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  inputs: { flexDirection: 'row', gap: space(3) },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 4,
  },
  stepBtn: {
    width: 40,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { textAlign: 'center', fontSize: 12, color: colors.muted, fontWeight: '600' },
  flag: {
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    padding: space(2.5),
    borderRadius: radius.sm,
    fontWeight: '600',
    overflow: 'hidden',
  },
  loggedRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  loggedBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  undo: { fontSize: 14, color: colors.accent, fontWeight: '700' },
});
