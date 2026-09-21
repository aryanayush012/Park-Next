import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { LampBloom } from './LampBloom';
import { colors, radius, spacing, typography } from '../theme';

/**
 * What a list says when it has nothing in it.
 *
 * An empty screen is an invitation to act, not an apology — so this is built
 * around the next step rather than around the absence. Pass an `action`
 * whenever there genuinely is one; leave it off where emptiness is just a
 * fact of life (nobody has requested your spot yet) and a button would be
 * nagging rather than helping.
 */
export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * A bespoke illustration to show instead of the icon-in-a-ring. Worth it
   * on the few empty states people hit often; everywhere else the ring keeps
   * them consistent and free.
   */
  art?: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  /**
   * For empty states inside a constrained container — a bottom sheet, a
   * short card — where the full-height version would be cropped.
   */
  compact?: boolean;
  style?: ViewStyle;
}

export function EmptyState({ icon, art, title, body, action, compact, style }: EmptyStateProps) {
  const ringSize = compact ? 44 : 56;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <View style={styles.iconWrap}>
        {art ?? (
          <>
            {/* Skipped when compact: in a short container the bloom has no
                room to fall off, so it reads as a flat disc instead of
                light. */}
            {compact ? null : (
              <LampBloom size={200} intensity={0.18} style={styles.bloom} />
            )}
            <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
              <Ionicons name={icon} size={compact ? 24 : 34} color={colors.primary} />
            </View>
          </>
        )}
      </View>

      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}

      {action ? (
        <Button
          label={action.label}
          trailingIcon="arrow-forward"
          onPress={action.onPress}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  wrapCompact: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  bloom: {
    // -72 = (56 ring - 200 bloom) / 2, so the light centres on the ring.
    top: -72,
  },
  ring: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  titleCompact: {
    ...typography.h3,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  cta: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
