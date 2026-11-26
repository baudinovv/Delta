import { Platform, type TextStyle } from 'react-native';

export const colors = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surface2: '#F0F0F3',
  surface3: '#E3E3E8',
  border: '#E8E8ED',
  text: '#0B0B0F',
  muted: '#6C6C78',
  faint: '#A3A3AE',

  // black-on-white: the accent is plain black, text on it is white
  accent: '#0B0B0F',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(11, 11, 15, 0.06)',

  protein: '#1E88E5',
  fat: '#F59E0B',
  carbs: '#7C5CE6',

  danger: '#E5484D',
  dangerSoft: 'rgba(229, 72, 77, 0.10)',
  warn: '#D98206',
  warnSoft: 'rgba(245, 158, 11, 0.14)',
  up: '#16A34A',
  down: '#E5484D',
};

export const radius = { sm: 12, md: 16, lg: 24, xl: 32, pill: 999 };

/** Soft card shadow for the light theme. */
export const shadow = {
  shadowColor: '#0B0B0F',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

export const space = (n: number) => n * 4;

const num: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -1, color: colors.text, ...num } as TextStyle,
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: colors.text } as TextStyle,
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: colors.text } as TextStyle,
  h3: { fontSize: 17, fontWeight: '700', color: colors.text } as TextStyle,
  body: { fontSize: 16, lineHeight: 22, color: colors.text } as TextStyle,
  small: { fontSize: 14, lineHeight: 19, color: colors.muted } as TextStyle,
  caption: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  } as TextStyle,
  num,
};

/** Centered column on wide web screens so the phone layout stays readable. */
export const webFrame = Platform.OS === 'web' ? ({ width: '100%', maxWidth: 520, alignSelf: 'center' } as const) : {};
