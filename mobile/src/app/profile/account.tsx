import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Banner, Button, Card, ErrorText, Loading, PasswordField, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/me';
import { useSession, useToken } from '@/lib/session';
import { colors, space, type } from '@/lib/theme';

export default function AccountScreen() {
  const token = useToken();
  const { forget } = useSession();
  const { me } = useMe();
  const { t } = useI18n();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!me) return <Loading />;

  const changePassword = async () => {
    setChanging(true);
    setPwError(null);
    setChanged(false);
    try {
      await api.changePassword(token, current, next);
      setCurrent('');
      setNext('');
      setChanged(true);
    } catch (e) {
      setPwError(errorText(e, t));
    } finally {
      setChanging(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteAccount(token, deletePassword);
      await forget();
    } catch (e) {
      setDeleteError(errorText(e, t));
      setDeleting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen inStack>
        <Card style={{ gap: space(1) }}>
          <Text style={type.caption}>{t('account.email')}</Text>
          <Text style={type.h3}>{me.email ?? '—'}</Text>
        </Card>

        <Card style={{ gap: space(4) }}>
          <Text style={type.h3}>{t('account.changePassword')}</Text>
          <PasswordField
            label={t('account.current')}
            showLabel={t('auth.show')}
            value={current}
            onChangeText={setCurrent}
            autoComplete="current-password"
            textContentType="password"
            maxLength={72}
          />
          <PasswordField
            label={t('account.new')}
            hint={t('auth.passwordHint')}
            showLabel={t('auth.show')}
            value={next}
            onChangeText={setNext}
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={72}
          />
          <ErrorText message={pwError} />
          {changed && <Banner icon="checkmark-circle" text={t('account.changed')} />}
          <Button
            title={t('account.changePassword')}
            variant="secondary"
            onPress={changePassword}
            loading={changing}
            disabled={!current || next.length < 8}
          />
        </Card>

        <Text style={[type.caption, { marginTop: space(4) }]}>{t('account.danger')}</Text>
        <Card style={{ gap: space(3), borderColor: colors.dangerSoft }}>
          <Text style={[type.small, { color: colors.text }]}>{t('account.deleteText')}</Text>
          {confirming ? (
            <View style={{ gap: space(3) }}>
              <PasswordField
                label={t('account.deleteConfirm')}
                showLabel={t('auth.show')}
                value={deletePassword}
                onChangeText={setDeletePassword}
                maxLength={72}
              />
              <ErrorText message={deleteError} />
              <Button
                title={t('account.deleteBtn')}
                icon="trash"
                variant="danger"
                onPress={deleteAccount}
                loading={deleting}
                disabled={!deletePassword}
              />
              <Button title={t('common.cancel')} variant="ghost" size="md" onPress={() => setConfirming(false)} />
            </View>
          ) : (
            <Button title={t('account.delete')} icon="trash-outline" variant="danger" onPress={() => setConfirming(true)} />
          )}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
