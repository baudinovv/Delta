import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Field, PasswordField } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, space, type, webFrame } from '@/lib/theme';

export default function Login() {
  const { signIn } = useSession();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      await signIn(res.token);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, webFrame]} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space(2), marginBottom: space(4) }}>
          <Text style={type.h1}>{t('auth.loginTitle')}</Text>
          <Text style={[type.body, { color: colors.muted }]}>{t('auth.loginLead')}</Text>
        </View>

        <Field
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
          maxLength={254}
        />
        <PasswordField
          label={t('auth.password')}
          showLabel={t('auth.show')}
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          maxLength={72}
        />
        <ErrorText message={error} />
        <Button title={t('auth.signIn')} onPress={submit} loading={busy} disabled={!email.trim() || !password} />

        <Pressable accessibilityRole="button" onPress={() => router.replace('/onboarding')} style={styles.switch}>
          <Text style={type.small}>
            {t('auth.noAccount')} <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('auth.signUp')}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), gap: space(4) },
  switch: { alignItems: 'center', paddingVertical: space(3) },
});
