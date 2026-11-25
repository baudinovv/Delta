import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, type Me, type ProfileUpdate } from './api';
import { useSession } from './session';

type MeContext = {
  me: Me | null;
  reload: () => Promise<void>;
  /** Saves a partial change; the rest of the profile is sent as it is now. */
  save: (patch: Partial<ProfileUpdate> & { calorieTarget?: number | null }) => Promise<Me>;
};

const Ctx = createContext<MeContext | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const [me, setMe] = useState<Me | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setMe(await api.me(token));
  }, [token]);

  useEffect(() => {
    setMe(null);
    reload().catch(() => undefined);
  }, [reload]);

  const save = useCallback(
    async (patch: Partial<ProfileUpdate> & { calorieTarget?: number | null }) => {
      if (!token || !me) throw new Error('No profile');
      const body: ProfileUpdate = {
        name: me.name ?? undefined,
        goal: me.goal,
        daysPerWeek: me.daysPerWeek,
        minutesPerSession: me.minutesPerSession,
        sex: me.sex ?? undefined,
        birthYear: me.birthYear ?? undefined,
        heightCm: me.heightCm ?? undefined,
        weightKg: me.weightKg ?? undefined,
        calorieTarget: me.calorieTarget ?? null,
        ...patch,
      };
      const updated = await api.updateProfile(token, body);
      setMe(updated);
      return updated;
    },
    [token, me],
  );

  const value = useMemo(() => ({ me, reload, save }), [me, reload, save]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMe() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMe must be used inside MeProvider');
  return v;
}
