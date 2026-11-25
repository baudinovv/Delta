import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';

import { PlanFields, type Plan } from '@/components/profile-fields';
import { Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { errorText, useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/me';
import { colors, space, type } from '@/lib/theme';

export default function GoalsScreen() {
  const { me, save } = useMe();
  const { t } = useI18n();
  const [plan, setPlan] = useState<Plan>({ goal: null, days: null, minutes: null });
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setPlan({ goal: me.goal, days: me.daysPerWeek, minutes: me.minutesPerSession });
    setCustom(me.calorieTarget == null ? '' : String(me.calorieTarget));
  }, [me]);

  if (!me) return <Loading />;

  const customKcal = custom.trim() ? Number(custom) : null;
  const customOk = customKcal == null || (customKcal >= 800 && customKcal <= 6000);

  const submit = async () => {
    if (!plan.goal || !plan.days || !plan.minutes) return;
    setSaving(true);
    setError(null);
    try {
      await save({ goal: plan.goal, daysPerWeek: plan.days, minutesPerSession: plan.minutes, calorieTarget: customKcal });
      router.back();
    } catch (e) {
      setError(errorText(e, t));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen inStack>
        <Card>
          <PlanFields plan={plan} onChange={setPlan} />
        </Card>

        <Card style={{ gap: space(3) }}>
          <Text style={type.h3}>{t('settings.calories')}</Text>
          {me.targets && !me.targets.custom && (
            <Text style={[type.body, { color: colors.accent }]}>{t('settings.auto', { n: me.targets.kcal })}</Text>
          )}
          <Field
            label={t('settings.custom')}
            hint={t('settings.customHint')}
            value={custom}
            onChangeText={setCustom}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="—"
          />
        </Card>

        <ErrorText message={error} />
        <Button title={t('common.save')} onPress={submit} loading={saving} disabled={!customOk || !plan.goal} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
