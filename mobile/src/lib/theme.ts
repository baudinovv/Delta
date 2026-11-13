import { Platform, type TextStyle } from 'react-native';

export const colors = {
  bg: '#0A0C0F',
  surface: '#14171C',
  surface2: '#1C2027',
  surface3: '#252A33',
  border: '#272C35',
  text: '#F3F5F8',
  muted: '#8B94A5',
  faint: '#5A6272',

  accent: '#C6F432',
  accentInk: '#0A0C0F',
  accentSoft: 'rgba(198, 244, 50, 0.12)',

  protein: '#5CC8FF',
  fat: '#FFB547',
  carbs: '#B591FF',

  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',
  warn: '#FFB547',
  warnSoft: 'rgba(255, 181, 71, 0.12)',
  up: '#3DDC84',
  down: '#FF8A8A',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

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
