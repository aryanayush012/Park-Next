import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  /**
   * Fixed text rendered inside the box, ahead of the input — a dial code,
   * a currency symbol. Not editable and never part of `value`, so the
   * caller stores and validates only what was actually typed.
   */
  prefix?: string;
  /**
   * Leading glyph inside the box — a mail envelope, a padlock. It names the
   * field at a glance on a screen where several stack up; skip it where the
   * label alone already makes the field obvious.
   */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Adds an eye button that reveals what's typed. Only meaningful alongside
   * `secureTextEntry` — on a phone keyboard, a mistyped password you can't
   * see is the single most common reason a sign-in fails twice.
   */
  secureToggle?: boolean;
}

export function TextField({
  label,
  helperText,
  errorText,
  prefix,
  icon,
  secureToggle,
  secureTextEntry,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hasError = Boolean(errorText);

  const boxStyle = [styles.input, isFocused && styles.inputFocused, hasError && styles.inputError];
  // A prefix, a leading icon and a reveal button all turn the box into a row
  // that wraps the input, so they share one layout rather than each having
  // their own.
  const showToggle = Boolean(secureToggle && secureTextEntry);
  const isRow = Boolean(prefix || icon || showToggle);

  const input = (
    <TextInput
      {...inputProps}
      secureTextEntry={secureTextEntry && !revealed}
      onFocus={(e) => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      placeholderTextColor={colors.textMuted}
      style={isRow ? styles.rowInput : boxStyle}
    />
  );

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {isRow ? (
        <View style={[boxStyle, styles.rowBox]}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={
                hasError ? colors.error : isFocused ? colors.primary : colors.textMuted
              }
            />
          ) : null}
          {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
          {input}
          {showToggle ? (
            <Pressable
              onPress={() => setRevealed((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              // The glyph alone is well under a comfortable touch target.
              hitSlop={spacing.xs}
            >
              <Ionicons
                name={revealed ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      ) : (
        input
      )}
      {hasError ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    // Sits a step lighter than the page, matching the reference — a field
    // that's darker than its background disappears on an OLED screen at
    // night, which is exactly when this app gets used.
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  rowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  prefix: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  rowInput: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
    // The row already provides the padding; TextInput's own default would
    // push the text off-centre against the icon or prefix beside it.
    padding: 0,
  },
  inputError: {
    borderColor: colors.error,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xxs,
  },
});
