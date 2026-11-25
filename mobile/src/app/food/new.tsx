import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { haptic } from '@/components/motion';
import { Button, Card, ErrorText, Field, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { space, type } from '@/lib/theme';

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
};

/** User's own food: nutrition per 100 g like on the package, optional portion and barcode. */
export default function NewFoodScreen() {
  const token = useToken();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ barcode?: string; name?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [f, setF] = useState('');
  const [c, setC] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const k = num(kcal);
  const sg = num(servingGrams);
  const code = barcode.replace(/\D/g, '');
  const valid =
    name.trim().length > 0 &&
    k != null &&
    k <= 900 &&
    (code === '' || (code.length >= 8 && code.length <= 14)) &&
    (servingLabel.trim() === '' || (sg != null && sg > 0));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const food = await api.createFood(
        token,
        {
          name: name.trim(),
          brand: brand.trim() || undefined,
          barcode: code || undefined,
          kcal: k!,
          proteinG: num(p),
          fatG: num(f),
          carbsG: num(c),
          fiberG: num(fiber),
          sugarG: num(sugar),
          serving: servingLabel.trim() && sg ? { label: servingLabel.trim(), grams: sg } : undefined,
        },
        lang,
      );
      haptic('success');
      router.replace({ pathname: '/food/item', params: { id: food.id! } });
    } catch (e) {
      setError(errorText(e, t));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen inStack>
        <Card style={{ gap: space(3) }}>
          <View style={{ flexDirection: 'row' }}>
            <Field label={t('food.name')} value={name} onChangeText={setName} maxLength={160} autoFocus={!name} />
          </View>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Field label={t('nf.brand')} value={brand} onChangeText={setBrand} maxLength={120} />
            <Field label={t('nf.barcode')} value={barcode} onChangeText={setBarcode} keyboardType="number-pad" maxLength={14} />
          </View>
        </Card>

        <Card style={{ gap: space(3) }}>
          <Text style={type.caption}>{t('nf.per100')}</Text>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Field label={t('food.kcal')} value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
            <Field label={`${t('macro.protein')}, ${t('common.g')}`} value={p} onChangeText={setP} keyboardType="decimal-pad" />
          </View>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Field label={`${t('macro.fat')}, ${t('common.g')}`} value={f} onChangeText={setF} keyboardType="decimal-pad" />
            <Field label={`${t('macro.carbs')}, ${t('common.g')}`} value={c} onChangeText={setC} keyboardType="decimal-pad" />
          </View>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Field label={`${t('food.fiber')}, ${t('common.g')}`} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" placeholder={t('common.optional')} />
            <Field label={`${t('food.sugar')}, ${t('common.g')}`} value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" placeholder={t('common.optional')} />
          </View>
        </Card>

        <Card style={{ gap: space(3) }}>
          <Text style={type.caption}>{t('nf.serving')}</Text>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Field placeholder={t('nf.servingLabel')} value={servingLabel} onChangeText={setServingLabel} maxLength={40} />
            <View style={{ width: 110 }}>
              <Field placeholder={t('common.g')} value={servingGrams} onChangeText={setServingGrams} keyboardType="decimal-pad" />
            </View>
          </View>
        </Card>

        <ErrorText message={error} />
        <Button title={t('nf.save')} icon="checkmark" onPress={save} loading={saving} disabled={!valid} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
