/**
 * ParkNext color tokens — dark-first, premium, glow-based elevation.
 * Do not hardcode hex values in components; import from here.
 */
export const colors = {
  // Backgrounds
  background: '#0B0D12',
  surface: '#161922',
  surfaceElevated: '#1E222D',
  surfaceBorder: '#2A2F3C',

  // Brand
  primary: '#F5A623',
  primaryMuted: 'rgba(245, 166, 35, 0.16)',
  secondary: '#2DD4BF',
  secondaryMuted: 'rgba(45, 212, 191, 0.16)',

  // Semantic
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.16)',
  warning: '#F97316',
  warningMuted: 'rgba(249, 115, 22, 0.16)',
  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.16)',
  success: '#2DD4BF',
  successMuted: 'rgba(45, 212, 191, 0.16)',

  // Text
  textPrimary: '#F5F6F8',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textOnPrimary: '#1A1000',
  textOnSecondary: '#00201C',

  // Status badge colors (background + foreground pairs)
  statusAvailable: '#2DD4BF',
  statusAvailableBg: 'rgba(45, 212, 191, 0.14)',
  statusBooked: '#F5A623',
  statusBookedBg: 'rgba(245, 166, 35, 0.14)',
  statusInProgress: '#3B82F6',
  statusInProgressBg: 'rgba(59, 130, 246, 0.14)',
  statusCompleted: '#9CA3AF',
  statusCompletedBg: 'rgba(156, 163, 175, 0.14)',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
