import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Button, Card, Chip, ErrorText, Field, IconButton } from '@/components/ui';
import { api, type Analysis, type FoodItem, type Meal } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import type { Photo } from '@/lib/photo';
import { useToken } from '@/lib/session';
import { colors, radius, space, type, webFrame } from '@/lib/theme';

export const MEALS: Meal[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export const mealForNow = (): Meal => {
  const h = new Date().getHours();
  if (h < 11) return 'BREAKFAST';
  if (h < 16) return 'LUNCH';
  if (h < 22) return 'DINNER';
  return 'SNACK';
};

const parse = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheetHead, webFrame]}>
            <Text style={[type.h2, { flex: 1 }]}>{title}</Text>
            <IconButton icon="close" label="close" onPress={onClose} size={36} />
          </View>
          <ScrollView contentContainerStyle={[styles.sheetBody, webFrame]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function MealPicker({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space(2) }}>
      <Text style={type.caption}>{t('food.addTo')}</Text>
      <View style={{ flexDirection: 'row', gap: space(1.5) }}>
        {MEALS.map((m) => (
          <Chip key={m} label={t(`food.meal.${m}`)} selected={value === m} onPress={() => onChange(m)} />
        ))}
      </View>
    </View>
  );
}

/* ---------- photo → calories ---------- */

type Row = { base: FoodItem; grams: string; removed: boolean };

const scaled = (r: Row): FoodItem => {
  const g = parse(r.grams);
  const k = r.base.grams && g != null ? g / r.base.grams : 1;
  const round1 = (n?: number) => Math.round((n ?? 0) * k * 10) / 10;
  return {
    name: r.base.name,
    grams: g ?? r.base.grams ?? null,
    kcal: Math.round(r.base.kcal * k),
    proteinG: round1(r.base.proteinG),
    fatG: round1(r.base.fatG),
    carbsG: round1(r.base.carbsG),
  };
};

export function ScanSheet({
  photo,
  date,
  onClose,
  onSaved,
}: {
  photo: Photo | null;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const token = useToken();
  const { t, lang } = useI18n();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (p: Photo, extra?: string) => {
    setBusy(true);
    setError(null);
    try {
      const a = await api.analyzeFood(token, p.base64, lang, extra);
      setAnalysis(a);
      setRows(a.items.map((i) => ({ base: i, grams: i.grams ? String(i.grams) : '', removed: false })));
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!photo) return;
    setAnalysis(null);
    setRows([]);
    setHint('');
    setMeal(mealForNow());
    analyze(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo]);

  const items = rows.filter((r) => !r.removed).map(scaled);
  const total = items.reduce(
    (s, i) => ({
      kcal: s.kcal + i.kcal,
      p: s.p + (i.proteinG ?? 0),
      f: s.f + (i.fatG ?? 0),
      c: s.c + (i.carbsG ?? 0),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 },
  );

  const save = async () => {
    setSaving(true);
    try {
      await api.addFood(token, { date, meal, source: 'PHOTO', items });
      onSaved();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={!!photo} onClose={onClose} title={analysis?.dish || t('food.snap')}>
      {photo && (
        <View style={styles.photoWrap}>
          <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
          {busy && (
            <View style={styles.photoOverlay}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={[type.h3, { marginTop: space(3) }]}>{t('food.analyzing')}</Text>
              <Text style={type.small}>{t('food.analyzingSub')}</Text>
            </View>
          )}
          {analysis && !busy && analysis.food && (
            <View style={styles.photoBadge}>
              <Text style={styles.photoKcal}>{total.kcal}</Text>
              <Text style={[type.small, { color: colors.text }]}>{t('common.kcal')}</Text>
            </View>
          )}
        </View>
      )}

      <ErrorText message={error} />
      {error && photo && !busy && <Button title={t('common.retry')} variant="secondary" onPress={() => analyze(photo, hint)} />}

      {analysis?.demo && <Banner tone="warn" icon="flask" text={t('common.demo')} />}

      {analysis && !busy && !analysis.food && <Banner tone="warn" icon="help-circle" text={t('food.notFood')} />}

      {analysis && !busy && analysis.food && (
        <>
          <View style={styles.macroRow}>
            <MacroPill label={t('macro.protein')} value={total.p} color={colors.protein} />
            <MacroPill label={t('macro.fat')} value={total.f} color={colors.fat} />
            <MacroPill label={t('macro.carbs')} value={total.c} color={colors.carbs} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Ionicons
              name="speedometer-outline"
              size={16}
              color={analysis.confidence === 'high' ? colors.up : analysis.confidence === 'low' ? colors.warn : colors.muted}
            />
            <Text style={type.small}>
              {t(`food.confidence.${analysis.confidence}`)}
              {analysis.note ? ` · ${analysis.note}` : ''}
            </Text>
          </View>

          <Card style={{ gap: space(1), paddingVertical: space(2) }}>
            <Text style={[type.small, { paddingVertical: space(1) }]}>{t('food.adjust')}</Text>
            {rows.map((r, idx) =>
              r.removed ? null : (
                <View key={idx} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { fontWeight: '600' }]}>{r.base.name}</Text>
                    <Text style={[type.small, type.num, { fontSize: 13 }]}>{scaled(r).kcal} {t('common.kcal')}</Text>
                  </View>
                  <View style={styles.gramsBox}>
                    <TextInput
                      value={r.grams}
                      onChangeText={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, grams: v } : x)))}
                      keyboardType="number-pad"
                      style={styles.gramsInput}
                      selectTextOnFocus
                    />
                    <Text style={type.small}>{t('common.g')}</Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    accessibilityLabel={t('common.delete')}
                    onPress={() => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, removed: true } : x)))}>
                    <Ionicons name="trash-outline" size={18} color={colors.faint} />
                  </Pressable>
                </View>
              ),
            )}
          </Card>

          <MealPicker value={meal} onChange={setMeal} />
        </>
      )}

      {analysis && !busy && (
        <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'flex-end' }}>
          <Field placeholder={t('food.hint')} value={hint} onChangeText={setHint} maxLength={200} style={{ fontSize: 15 }} />
          <IconButton icon="refresh" label="re-analyze" size={50} onPress={() => photo && analyze(photo, hint)} />
        </View>
      )}

      {analysis?.food && !busy && (
        <Button
          title={`${t('food.addToDiary')} · ${total.kcal} ${t('common.kcal')}`}
          icon="checkmark"
          onPress={save}
          loading={saving}
          disabled={items.length === 0}
        />
      )}
    </Sheet>
  );
}

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.macroPill}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={[type.h3, type.num]}>{Math.round(value)}</Text>
      <Text style={[type.small, { fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

/* ---------- manual entry ---------- */

export function ManualSheet({
  visible,
  date,
  onClose,
  onSaved,
}: {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const token = useToken();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [grams, setGrams] = useState('');
  const [p, setP] = useState('');
  const [f, setF] = useState('');
  const [c, setC] = useState('');
  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setKcal('');
      setGrams('');
      setP('');
      setF('');
      setC('');
      setMeal(mealForNow());
      setError(null);
    }
  }, [visible]);

  const k = parse(kcal);
  const save = async () => {
    setSaving(true);
    try {
      await api.addFood(token, {
        date,
        meal,
        items: [
          {
            name: name.trim(),
            kcal: Math.round(k ?? 0),
            grams: parse(grams),
            proteinG: parse(p) ?? 0,
            fatG: parse(f) ?? 0,
            carbsG: parse(c) ?? 0,
          },
        ],
      });
      onSaved();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('food.manual')}>
      <Field label={t('food.name')} value={name} onChangeText={setName} maxLength={120} autoFocus />
      <View style={styles.fieldRow}>
        <Field label={t('food.kcal')} value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
        <Field label={t('food.grams')} value={grams} onChangeText={setGrams} keyboardType="number-pad" placeholder={t('common.optional')} />
      </View>
      <View style={styles.fieldRow}>
        <Field label={`${t('macro.protein')}, ${t('common.g')}`} value={p} onChangeText={setP} keyboardType="decimal-pad" />
        <Field label={`${t('macro.fat')}, ${t('common.g')}`} value={f} onChangeText={setF} keyboardType="decimal-pad" />
        <Field label={`${t('macro.carbs')}, ${t('common.g')}`} value={c} onChangeText={setC} keyboardType="decimal-pad" />
      </View>
      <MealPicker value={meal} onChange={setMeal} />
      <ErrorText message={error} />
      <Button title={t('common.save')} onPress={save} loading={saving} disabled={!name.trim() || k == null} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingTop: space(4),
    paddingBottom: space(2),
    gap: space(3),
  },
  sheetBody: { padding: space(4), paddingBottom: space(16), gap: space(4) },
  photoWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, aspectRatio: 4 / 3 },
  photo: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute',
    left: space(3),
    bottom: space(3),
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space(1.5),
  },
  photoKcal: { fontSize: 30, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
  macroRow: { flexDirection: 'row', gap: space(2) },
  macroPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space(3),
    gap: 2,
  },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: space(1) },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  gramsBox: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  gramsInput: {
    width: 64,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  fieldRow: { flexDirection: 'row', gap: space(2) },
});
