import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

/**
 * The at-a-glance facts of a booking — when, how long, how much — as icon /
 * label / value columns split by hairline rules.
 *
 * Why columns rather than the label-left value-right rows used elsewhere:
 * these three are read together, as one answer to "what did I just book",
 * and stacking them makes the eye travel three times for one thought. The
 * rows remain right for lists of unrelated details.
 */
export interface DataColumn {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** The one that carries the money, or whatever the screen is really about. */
  accent?: boolean;
}

export interface DataColumnsProps {
  columns: DataColumn[];
  style?: ViewStyle;
}

export function DataColumns({ columns, style }: DataColumnsProps) {
  return (
    <View style={[styles.row, style]}>
      {columns.map((column, index) => (
        <React.Fragment key={column.label}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {/* Icon beside the text rather than above it: the glyph and its
              label belong to each other, and stacking all three centred
              made each column read as its own little card. */}
          <View style={styles.column}>
            <Ionicons
              name={column.icon}
              size={20}
              color={column.accent ? colors.primary : colors.textSecondary}
            />
            <View style={styles.columnText}>
              <Text style={styles.label} numberOfLines={1}>
                {column.label}
              </Text>
              <Text
                style={[styles.value, column.accent && styles.valueAccent]}
                numberOfLines={1}
                // The three columns are equal-width, so a long value (a time
                // range, a four-figure price) has to shrink rather than
                // shove its neighbours out of the card.
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {column.value}
              </Text>
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  column: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  columnText: {
    flexShrink: 1,
  },
  divider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.xxs,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  valueAccent: {
    ...typography.dataValue,
    color: colors.primary,
  },
});
