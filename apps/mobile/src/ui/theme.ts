// ==============================================================================
// NST Events Mobile — Prism Mobile Standard v3.6.0 Design Tokens
// Authoritative TypeScript token scale matching apps/mobile/DESIGN.md Section 2
// ==============================================================================

export const colors = {
  dark: {
    // Canvas & Layered Surfaces (Obsidian stepping + navy slate cards)
    canvas: '#0B0F17',
    surfaceSubtle: '#0F1523',
    surface: '#141C2E',
    surfaceElevated: '#1E293F',
    surfaceGlass: 'rgba(20, 28, 46, 0.85)',
    surfaceGlassOpaque: '#141C2E',

    // Borders & Hairlines
    borderSubtle: 'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    borderInput: 'rgba(255, 255, 255, 0.38)', // 3.54:1 vs surface (passes 3:1)
    borderHighlight: 'rgba(255, 255, 255, 0.45)',

    // Interactive Input States
    placeholderText: '#94A3B8', // 6.63:1 vs surface (passes 4.5:1)
    errorText: '#F87171',       // 6.15:1 vs surface (passes 4.5:1)
    errorBorder: '#EF4444',     // 4.52:1 vs surface (passes 3:1)
    focusBorder: '#60A5FA',     // 6.69:1 vs surface (passes 3:1)

    // Typography Hierarchy
    textPrimary: '#F8FAFC',     // 18.33:1 vs canvas | 16.25:1 vs surface
    textSecondary: '#CBD5E1',   // 12.92:1 vs canvas | 11.45:1 vs surface
    textMuted: '#94A3B8',       // 7.48:1 vs canvas | 6.63:1 vs surface (passes 4.5:1)
    textInverse: '#0B0F17',

    // Brand — NST Electric Cobalt
    brandPrimary: '#2563EB',    // White text on 2563EB: 5.17:1 (passes AA)
    brandPressed: '#1D4ED8',    // Touch feedback state
    brandText: '#60A5FA',       // 7.54:1 vs canvas | 6.69:1 vs surface
    brandSubtle: 'rgba(37, 99, 235, 0.16)',
    brandGlow: 'rgba(59, 130, 246, 0.35)',

    // Solid Fills
    solidRed: '#DC2626',
    solidEmerald: '#047857',
    solidAmber: '#B45309',
    onSolidText: '#FFFFFF',

    // Tinted Badges (Text on Tint composited over surface)
    badgeTintRed: 'rgba(239, 68, 68, 0.16)',
    badgeTextRed: '#F87171',    // 5.27:1 vs surface
    badgeTintEmerald: 'rgba(16, 185, 129, 0.16)',
    badgeTextEmerald: '#34D399',// 6.81:1 vs surface
    badgeTintAmber: 'rgba(245, 158, 11, 0.16)',
    badgeTextAmber: '#FBBF24',  // 7.69:1 vs surface
    badgeTintCobalt: 'rgba(37, 99, 235, 0.16)',
    badgeTextCobalt: '#60A5FA', // 5.75:1 vs surface

    // Overlays & Scrims
    scrimTop: 'rgba(11, 15, 23, 0.85)',
    scrimBottom: 'rgba(11, 15, 23, 0.95)',

    // Compatibility aliases mapping legacy tokens to semantic equivalents
    primary: '#2563EB',
    primaryFixed: '#60A5FA',
    primaryContainer: 'rgba(37, 99, 235, 0.16)',
    onPrimaryContainer: '#60A5FA',
    primaryHover: '#1D4ED8',
    onPrimary: '#FFFFFF',
    secondary: '#60A5FA',
    secondaryFixed: '#60A5FA',
    secondaryFixedDim: '#60A5FA',
    secondaryContainer: 'rgba(37, 99, 235, 0.16)',
    onSecondary: '#FFFFFF',
    tertiary: '#94A3B8',
    onTertiary: '#0B0F17',
    tertiaryContainer: '#1E293F',
    onTertiaryContainer: '#F8FAFC',
    error: '#F87171',
    onError: '#FFFFFF',
    errorContainer: 'rgba(239, 68, 68, 0.16)',
    onErrorContainer: '#F87171',
    warning: '#FBBF24',
    onWarning: '#0B0F17',
    warningContainer: 'rgba(245, 158, 11, 0.16)',
    onWarningContainer: '#FBBF24',
    success: '#34D399',
    onSuccess: '#0B0F17',
    successContainer: 'rgba(16, 185, 129, 0.16)',
    onSuccessContainer: '#34D399',
    podiumGold: '#ffd700',
    podiumSilver: '#c0c0c0',
    podiumBronze: '#cd7f32',
    onSurface: '#F8FAFC',
    onSurfaceVariant: '#CBD5E1',
    outline: '#94A3B8',
    outlineVariant: 'rgba(255, 255, 255, 0.10)',
    borderHairline: 'rgba(255, 255, 255, 0.10)',
    borderDark: 'rgba(255, 255, 255, 0.18)',
    surfaceContainerLowest: '#0B0F17',
    surfaceContainerLow: '#0F1523',
    surfaceContainer: '#141C2E',
    surfaceContainerHigh: '#1E293F',
    surfaceContainerHighest: '#1E293F',
    surfaceSubdued: '#0F1523',
  },

  light: {
    // Canvas & Layered Surfaces (Porcelain canvas + crisp white cards)
    canvas: '#F8FAFC',
    surfaceSubtle: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceGlass: 'rgba(255, 255, 255, 0.88)',
    surfaceGlassOpaque: '#F8FAFC',

    // Borders & Hairlines
    borderSubtle: '#E2E8F0',
    borderStrong: '#CBD5E1',
    borderInput: '#64748B',     // 4.76:1 vs white surface (passes 3:1)
    borderHighlight: '#475569',

    // Interactive Input States
    placeholderText: '#5C6B80', // 5.43:1 vs white surface (passes 4.5:1)
    errorText: '#B91C1C',       // 6.47:1 vs white surface (passes 4.5:1)
    errorBorder: '#DC2626',     // 4.83:1 vs white surface (passes 3:1)
    focusBorder: '#1D4ED8',     // 6.70:1 vs white surface (passes 3:1)

    // Typography Hierarchy
    textPrimary: '#0F172A',     // 17.06:1 vs canvas | 17.85:1 vs surface
    textSecondary: '#334155',   // 9.90:1 vs canvas | 10.35:1 vs surface
    textMuted: '#475569',       // 7.24:1 vs canvas | 7.58:1 vs surface (passes 4.5:1)
    textInverse: '#FFFFFF',

    // Brand — NST Electric Cobalt
    brandPrimary: '#1D4ED8',    // White text on 1D4ED8: 6.70:1
    brandPressed: '#1E40AF',
    brandText: '#1D4ED8',       // 6.41:1 vs canvas | 6.70:1 vs surface
    brandSubtle: '#EFF6FF',
    brandGlow: 'rgba(29, 78, 216, 0.20)',

    // Solid Fills
    solidRed: '#DC2626',
    solidEmerald: '#047857',
    solidAmber: '#B45309',
    onSolidText: '#FFFFFF',

    // Tinted Badges (Text on Tint)
    badgeTintRed: '#FEF2F2',
    badgeTextRed: '#B91C1C',    // 5.91:1 vs #FEF2F2
    badgeTintEmerald: '#ECFDF5',
    badgeTextEmerald: '#047857',// 5.21:1 vs #ECFDF5
    badgeTintAmber: '#FFFBEB',
    badgeTextAmber: '#92400E',  // 6.84:1 vs #FFFBEB
    badgeTintCobalt: '#EFF6FF',
    badgeTextCobalt: '#1D4ED8', // 6.16:1 vs #EFF6FF

    // Overlays & Scrims
    scrimTop: 'rgba(15, 23, 42, 0.75)',
    scrimBottom: 'rgba(15, 23, 42, 0.90)',

    // Compatibility aliases
    primary: '#1D4ED8',
    primaryFixed: '#1D4ED8',
    primaryContainer: '#EFF6FF',
    onPrimaryContainer: '#1D4ED8',
    primaryHover: '#1E40AF',
    onPrimary: '#FFFFFF',
    secondary: '#1D4ED8',
    secondaryFixed: '#1D4ED8',
    secondaryFixedDim: '#1D4ED8',
    secondaryContainer: '#EFF6FF',
    onSecondary: '#FFFFFF',
    tertiary: '#475569',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#F1F5F9',
    onTertiaryContainer: '#0F172A',
    error: '#B91C1C',
    onError: '#FFFFFF',
    errorContainer: '#FEF2F2',
    onErrorContainer: '#B91C1C',
    warning: '#B45309',
    onWarning: '#FFFFFF',
    warningContainer: '#FFFBEB',
    onWarningContainer: '#92400E',
    success: '#047857',
    onSuccess: '#FFFFFF',
    successContainer: '#ECFDF5',
    onSuccessContainer: '#047857',
    podiumGold: '#b8860b',
    podiumSilver: '#708090',
    podiumBronze: '#a0522d',
    onSurface: '#0F172A',
    onSurfaceVariant: '#334155',
    outline: '#475569',
    outlineVariant: '#E2E8F0',
    borderHairline: '#E2E8F0',
    borderDark: '#CBD5E1',
    surfaceContainerLowest: '#F8FAFC',
    surfaceContainerLow: '#F1F5F9',
    surfaceContainer: '#FFFFFF',
    surfaceContainerHigh: '#FFFFFF',
    surfaceContainerHighest: '#FFFFFF',
    surfaceSubdued: '#F1F5F9',
  },
};

export const darkColors = colors.dark;
export const lightColors = colors.light;

export const radii = {
  none: 0,
  xs: 6,      // Micro tags, secondary chips
  sm: 10,     // Badges, date month chips
  md: 12,     // Buttons, text fields, inner ticket modules
  lg: 16,     // Event cards, modal sheets, ticket shells
  xl: 20,     // Live radar card, scanner reticle
  '2xl': 28,  // Floating navigation bar, action pills
  full: 9999, // Pill buttons, avatar rings, live dots
};

export const spacing = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,   // Standard screen & card padding
  lg: 20,
  xl: 24,     // Section gap
  '2xl': 32,
  '3xl': 40,
  touchMin: 48,
};

export const typography = {
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  // Backward compatibility aliases
  syneBold: 'Inter_700Bold',
  syneExtraBold: 'Inter_700Bold',
};

export const typeScale = {
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6, fontFamily: 'Inter_700Bold' },
  title: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4, fontFamily: 'Inter_700Bold' },
  headline: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2, fontFamily: 'Inter_600SemiBold' },
  buttonPrimary: { fontSize: 16, lineHeight: 22, letterSpacing: -0.2, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontFamily: 'Inter_400Regular' },
  bodyMedium: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontFamily: 'Inter_500Medium' },
  callout: { fontSize: 13, lineHeight: 18, letterSpacing: 0.1, fontFamily: 'Inter_500Medium' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2, fontFamily: 'Inter_400Regular' },
  overline: { fontSize: 12, lineHeight: 16, letterSpacing: 0.8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' as const },
  countdown: { fontSize: 16, lineHeight: 20, letterSpacing: 0, fontFamily: 'JetBrainsMono_700Bold', fontVariant: ['tabular-nums'] as const },
  mono: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontFamily: 'JetBrainsMono_500Medium' },
  monoSm: { fontSize: 12, lineHeight: 16, letterSpacing: 0, fontFamily: 'JetBrainsMono_400Regular' },
};

export const countdownStyle = {
  fontFamily: 'JetBrainsMono_700Bold',
  fontSize: 16,
  lineHeight: 20,
  fontVariant: ['tabular-nums'] as const,
};

export const elevation = {
  light: {
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    floating: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  dark: {
    card: {
      backgroundColor: colors.dark.surface,
      borderWidth: 1,
      borderColor: colors.dark.borderSubtle,
    },
    floating: {
      backgroundColor: colors.dark.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.dark.borderStrong,
    },
  },
};

export const springs = {
  buttonPress: { damping: 15, stiffness: 300, mass: 0.8, useNativeDriver: true },
  sheetEnter: { damping: 24, stiffness: 220, mass: 1, useNativeDriver: true },
};

export const DEFAULT_TAB_BAR_HEIGHT = 64;
export const TAB_BAR_BOTTOM_OFFSET = 12;

export const getContentBottomInset = (bottomInset: number, measuredTabBarHeight = DEFAULT_TAB_BAR_HEIGHT) =>
  Math.max(bottomInset, TAB_BAR_BOTTOM_OFFSET) + measuredTabBarHeight + 16;

export const theme = {
  colors: darkColors,
  radii,
  borderRadius: radii, // Alias for backward compatibility
  spacing,
  typography,
  typeScale,
  elevation,
  springs,
};

export default theme;
