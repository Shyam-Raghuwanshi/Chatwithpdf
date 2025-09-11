import { Platform, TextStyle } from 'react-native';

// Font family names
export const FONT_FAMILY = {
  regular: Platform.select({
    ios: 'Inter-Regular',
    android: 'Inter-Regular',
  }),
  medium: Platform.select({
    ios: 'Inter-Medium',
    android: 'Inter-Medium',
  }),
  semiBold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter-SemiBold',
  }),
  bold: Platform.select({
    ios: 'Inter-Bold',
    android: 'Inter-Bold',
  }),
} as const;

// Font weight mappings
export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
} as const;

// Text styles with Inter font
export const TEXT_STYLES: Record<string, TextStyle> = {
  // Headings
  heading1: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  heading2: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  heading3: {
    fontFamily: FONT_FAMILY.semiBold,
    fontSize: 24,
    lineHeight: 32,
  },
  heading4: {
    fontFamily: FONT_FAMILY.semiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  heading5: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 18,
    lineHeight: 24,
  },
  heading6: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  
  // Body text
  body1: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  body2: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Utility text
  caption: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 16,
    lineHeight: 20,
  },
  label: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 18,
  },
};

// Helper function to get font style
export const getFontFamily = (weight: keyof typeof FONT_FAMILY = 'regular') => {
  return FONT_FAMILY[weight];
};

export default {
  FONT_FAMILY,
  FONT_WEIGHT,
  TEXT_STYLES,
  getFontFamily,
};
