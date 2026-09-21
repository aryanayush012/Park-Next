import React, { useEffect, useRef, useState } from 'react';
import { Clipboard, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

/**
 * The four digits the host types to start the booking.
 *
 * This is the one thing on the screen someone reads out loud, often
 * one-handed, at a barrier, in the dark — so it gets the loudest treatment
 * in the app: amber rule, warm tint, wide-tracked numerals at display size.
 * Everything around it is deliberately quieter so this wins.
 */

/** How long the copy button stays ticked before returning to its icon. */
const COPIED_FEEDBACK_MS = 1600;

export interface ArrivalCodeProps {
  code: string;
  label: string;
  /** Short instruction sitting to the right, e.g. "Show at entry". */
  hint?: string;
  /** Accessible name for the copy control — the caller owns translation. */
  copyLabel?: string;
  style?: ViewStyle;
}

export function ArrivalCode({ code, label, hint, copyLabel, style }: ArrivalCodeProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A tap right before unmount would otherwise set state on a gone
  // component, and leave the timer running.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = () => {
    // `Clipboard` from core is deprecated in favour of
    // @react-native-clipboard/clipboard, but it still forwards to the same
    // native module and is used here on purpose: pulling in the community
    // package would add a native dependency, and that costs a full rebuild
    // for one button. Swap it when something else forces a rebuild anyway.
    Clipboard.setString(code);
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <View
      style={[styles.block, style]}
      accessibilityRole="text"
      // Read as one unit, and digit-by-digit — "5809" as a spoken number is
      // useless to someone reading it out to a host.
      accessibilityLabel={`${label}: ${code.split('').join(' ')}`}
    >
      <Ionicons name="qr-code-outline" size={26} color={colors.primary} />
      <View style={styles.codeBlock}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.code}>{code}</Text>
      </View>

      {hint ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </>
      ) : null}

      <Pressable
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityLabel={copyLabel ?? 'Copy code'}
        accessibilityState={{ selected: copied }}
        // The glyph alone is well under a comfortable touch target.
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
      >
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={18}
          color={copied ? colors.secondary : colors.primary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  codeBlock: {
    flex: 1,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  code: {
    ...typography.dataValue,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 4,
    color: colors.primary,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    opacity: 0.35,
    marginVertical: spacing.xxs,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    maxWidth: 74,
    textAlign: 'right',
  },
  copyButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonPressed: {
    backgroundColor: 'rgba(245, 166, 35, 0.22)',
  },
});
