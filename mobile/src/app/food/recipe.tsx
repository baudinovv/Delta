import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutLeft } from 'react-native-reanimated';

import { SearchBar, SearchResults } from '@/components/food-search';
import { CountUp, haptic, listLayout } from '@/components/motion';
import { Button, Card, ErrorText, Field, IconButton, Screen } from '@/components/ui';
import { api, type Food } from '@/lib/api';
import { defaultPortion, nutritionFor } from '@/lib/food';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

type Row = { key: string; food: Food; grams: string };

/** Recipe builder: ingredients with grams; nutrition per portion is computed live and on the server. */
export default function RecipeScreen() {
  const token = useToken();
  const { t, lang } = useI18n();
  const [name, setName] = useState('');
  const [portions, setPortions] = useState('2');
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (food: Food) => {
    let f = food;
    if (!f.id && f.barcode) {
      try {
        f = await api.foodByBarcode(token, f.barcode, lang);
      } catch (e) {
        setError(errorText(e, t));
        return;
      }
    }
    haptic('select');
    setRows((r) => [...r, { key: `${f.id}-${Date.now()}`, food: f, grams: String(Math.round(defaultPortion(f, lang).grams)) }]);
    setQuery('');
    setPicking(false);
  };

  const gramsOf = (r: Row) => Number(r.grams.replace(',', '.')) || 0;
  const totalGrams = rows.reduce((s, r) => s + gramsOf(r), 0);
  const totalKcal = rows.reduce((s, r) => s + nutritionFor(r.food.per100, gramsOf(r)).kcal, 0);
  const n = Math.max(1, Number(portions) || 1);
  const valid = name.trim().length > 0 && rows.length > 0 && rows.every((r) => gramsOf(r) > 0) && Number(portions) >= 1;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const recipe = await api.createRecipe(
        token,
        { name: name.trim(), portions: n, ingredients: rows.map((r) => ({ foodId: r.food.id!, grams: gramsOf(r) })) },
        lang,
      );
      haptic('success');
      router.replace({ pathname: '/food/item', params: { id: recipe.id! } });
    } catch (e) {
      setError(errorText(e, t));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen inStack>
        <Card style={{ gap: space(3) }}>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Field label={t('rc.name')} value={name} onChangeText={setName} maxLength={160} />
            <View style={{ width: 96 }}>
              <Field label={t('rc.portions')} value={portions} onChangeText={setPortions} keyboardType="number-pad" maxLength={2} />
            </View>
          </View>
        </Card>

        <Card style={{ gap: space(2) }}>
          <Text style={type.caption}>{t('rc.ingredients')}</Text>
          {rows.map((r) => (
            <Animated.View
              key={r.key}
              entering={FadeInDown.duration(250)}
              exiting={FadeOutLeft.duration(200)}
              layout={listLayout}
              style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>
                  {r.food.name}
                </Text>
                <Text style={[type.small, { fontSize: 12 }]}>
                  {nutritionFor(r.food.per100, gramsOf(r)).kcal} {t('common.kcal')}
                </Text>
              </View>
              <TextInput
                value={r.grams}
                onChangeText={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, grams: v } : x)))}
                keyboardType="decimal-pad"
                style={styles.grams}
                selectTextOnFocus
              />
              <Text style={type.small}>{t('common.g')}</Text>
              <Pressable hitSlop={8} onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                <Ionicons name="trash-outline" size={18} color={colors.faint} />
              </Pressable>
            </Animated.View>
          ))}

          {picking ? (
            <View style={{ gap: space(2), marginTop: space(1) }}>
              <SearchBar
                value={query}
                onChange={setQuery}
                autoFocus
                right={<IconButton icon="close" label="close" onPress={() => setPicking(false)} />}
              />
              {query.trim().length >= 2 && <SearchResults query={query} onOpen={add} />}
            </View>
          ) : (
            <Button title={t('rc.add')} icon="add" variant="secondary" size="md" onPress={() => setPicking(true)} />
          )}
        </Card>

        {rows.length > 0 && (
          <Card style={{ gap: space(1.5) }}>
            <Text style={[type.h3, type.num]}>
              {t('rc.perPortion', { g: Math.round(totalGrams / n), kcal: Math.round(totalKcal / n) })}
            </Text>
            <Text style={[type.small, type.num]}>
              {t('rc.total', { g: Math.round(totalGrams), kcal: totalKcal })}
            </Text>
            <Text style={[type.display, { fontSize: 30, color: colors.accent }]}>
              <CountUp value={Math.round(totalKcal / n)} /> <Text style={type.small}>{t('common.kcal')}</Text>
            </Text>
          </Card>
        )}

        <ErrorText message={error} />
        <Button title={t('rc.save')} icon="checkmark" onPress={save} loading={saving} disabled={!valid} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  grams: {
    width: 64,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
});
