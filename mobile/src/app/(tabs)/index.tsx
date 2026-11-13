import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, ErrorText } from '@/components/ui';
import { api, ApiError, type LoggedSet, type PrefillRow } from '@/lib/api';
import { useToken } from '@/lib/session';
import { colors, radius, space } from '@/lib/theme';

type Draft = { weight: string; reps: string };

const toDraft = (r: PrefillRow): Draft => ({
  weight: r.weightKg != null ? String(r.weightKg) : '',
  reps: r.reps != null ? String(r.reps) : '',
});

const parseNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};

export default function LogScreen() {
  const token = useToken();
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
      setError(e instanceof ApiError ? e.message : 'Could not load your log.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      setError(e instanceof ApiError ? e.message : 'Could not save the set.');
    } finally {
      setSavingExercise(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteSet(token, id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the set.');
    }
  };

  const addExercise = () => {
    const name = newExercise.trim().replace(/\s+/g, ' ');
    if (!name || rows.some((r) => r.exercise.toLowerCase() === name.toLowerCase())) return;
    const row: PrefillRow = { exercise: name, hint: 'start light, 10–12 reps' };
    setRows((r) => [...r, row]);
    setDrafts((d) => ({ ...d, [name]: toDraft(row) }));
    setNewExercise('');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <ErrorText message={error} />

        {rows.map((r) => {
          const d = drafts[r.exercise] ?? { weight: '', reps: '' };
          const weight = parseNum(d.weight);
          const reps = parseNum(d.reps);
          const needsReps = weight != null && reps == null;
          const isNew = r.hint != null;
          return (
            <Card key={r.exercise} style={{ marginBottom: space(3) }}>
              <View style={styles.rowHeader}>
                <Text style={styles.exercise}>{r.exercise}</Text>
                {!isNew && <Text style={styles.lastTime}>last time {r.weightKg} × {r.reps}</Text>}
              </View>
              {isNew && <Text style={styles.hint}>New exercise: {r.hint}</Text>}

              <View style={styles.inputs}>
                <NumberField
                  label="kg"
                  value={d.weight}
                  onChange={(v) => setDraft(r.exercise, { weight: v })}
                  onMinus={() => step(r.exercise, 'weight', -2.5)}
                  onPlus={() => step(r.exercise, 'weight', 2.5)}
                  decimal
                />
                <Text style={styles.times}>×</Text>
                <NumberField
                  label="reps"
                  value={d.reps}
                  onChange={(v) => setDraft(r.exercise, { reps: v })}
                  onMinus={() => step(r.exercise, 'reps', -1)}
                  onPlus={() => step(r.exercise, 'reps', 1)}
                />
              </View>

              {needsReps && <Text style={styles.flag}>Enter reps to save</Text>}

              <Button
                title="Save set"
                onPress={() => save(r.exercise)}
                disabled={weight == null || reps == null || reps < 1}
                loading={savingExercise === r.exercise}
              />
            </Card>
          );
        })}

        <Card style={{ marginBottom: space(6) }}>
          <Text style={styles.sectionLabel}>Add an exercise</Text>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'left' }]}
              placeholder="e.g. Lunge"
              placeholderTextColor={colors.muted}
              value={newExercise}
              onChangeText={setNewExercise}
              onSubmitEditing={addExercise}
              maxLength={60}
            />
            <Button title="Add" variant="secondary" onPress={addExercise} disabled={!newExercise.trim()} />
          </View>
        </Card>

        <Text style={styles.sectionLabel}>Today</Text>
        {todaySets.length === 0 ? (
          <Text style={styles.muted}>No sets yet today.</Text>
        ) : (
          todaySets.map((s) => (
            <View key={s.id} style={styles.loggedRow}>
              <Text style={styles.loggedText}>
                {s.exercise} · {s.weightKg} kg × {s.reps}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => remove(s.id)} hitSlop={12}>
                <Text style={styles.undo}>Undo</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NumberField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  decimal?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.stepper}>
        <Pressable accessibilityLabel={`less ${props.label}`} onPress={props.onMinus} style={styles.stepBtn}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={props.value}
          onChangeText={props.onChange}
          keyboardType={props.decimal ? 'decimal-pad' : 'number-pad'}
          placeholder="–"
          placeholderTextColor={colors.muted}
          selectTextOnFocus
        />
        <Pressable accessibilityLabel={`more ${props.label}`} onPress={props.onPlus} style={styles.stepBtn}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.unit}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), paddingBottom: space(12) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  exercise: { fontSize: 18, fontWeight: '700', color: colors.text },
  lastTime: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 14, color: colors.muted, marginTop: space(1) },
  inputs: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginVertical: space(3) },
  times: { fontSize: 20, color: colors.muted, marginTop: space(3) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  stepBtn: {
    width: 40,
    height: 48,
    borderRadius: radius,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 22, fontWeight: '700', color: colors.navy },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    paddingHorizontal: space(2),
  },
  unit: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: space(1) },
  flag: {
    color: colors.warn,
    backgroundColor: colors.warnBg,
    padding: space(2),
    borderRadius: 8,
    marginBottom: space(3),
    fontWeight: '600',
  },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: space(2) },
  muted: { color: colors.muted, fontSize: 15 },
  loggedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  loggedText: { fontSize: 16, color: colors.text },
  undo: { fontSize: 15, color: colors.navy, fontWeight: '600' },
});
