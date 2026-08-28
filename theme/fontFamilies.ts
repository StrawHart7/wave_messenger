/**
 * Family names only — no font binaries. The theme layer resolves type roles through
 * this module so that rendering a Text does not pull the .ttf assets in behind it;
 * loading those is `theme/fonts.ts`, imported once by the root layout.
 *
 * React Native does not synthesize weights reliably, so each weight is its own family
 * (DESIGN.md limits usage to 400 / 500 / 600).
 */
export const fontFamilies = {
  '400': 'BeVietnamPro_400Regular',
  '500': 'BeVietnamPro_500Medium',
  '600': 'BeVietnamPro_600SemiBold',
} as const;

export type FontWeightToken = keyof typeof fontFamilies;

export function fontFamilyFor(weight: FontWeightToken): string {
  return fontFamilies[weight];
}
