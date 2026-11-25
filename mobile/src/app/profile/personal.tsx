import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { BodyFields, bodyIsValid, bodyToApi, type BodyDraft } from '@/components/profile-fields';
import { Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { errorText, useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/me';
import { space } from '@/lib/theme';

const str = (n?: number | null) => (n == null ? '' : String(n));

export default function PersonalScreen() {
  const { me, save } = useMe();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [body, setBody] = useState<BodyDraft>({ sex: null, birthYear: '', heightCm: '', weightKg: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setName(me.name ?? '');
    setBody({ sex: me.sex ?? null, birthYear: str(me.birthYear), heightCm: str(me.heightCm), weightKg: str(me.weightKg) });
  }, [me]);

  if (!me) return <Loading />;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await save({ name: name.trim(), ...bodyToApi(body) });
      router.back();
    } catch (e) {
      setError(errorText(e, t));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen inStack>
        <Card style={{ gap: space(4) }}>
          <View style={{ flexDirection: 'row' }}>
            <Field label={t('auth.name')} value={name} onChangeText={setName} maxLength={40} autoComplete="name" />
          </View>
          <BodyFields body={body} onChange={setBody} />
        </Card>
        <ErrorText message={error} />
        <Button
          title={t('common.save')}
          onPress={submit}
          loading={saving}
          disabled={!name.trim() || !bodyIsValid(body)}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
