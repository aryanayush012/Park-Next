import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
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
}

export function TextField({
  label,
  helperText,
  errorText,
  prefix,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorText);

  const boxStyle = [styles.input, isFocused && styles.inputFocused, hasError && styles.inputError];

  const input = (
    <TextInput
      {...inputProps}
      onFocus={(e) => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      placeholderTextColor={colors.textMuted}
      // With a prefix the box itself is the bordered row, so the input
      // inside it is plain text that fills the remaining width.
      style={prefix ? styles.prefixedInput : boxStyle}
    />
  );

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {prefix ? (
        <View style={[boxStyle, styles.prefixBox]}>
          <Text style={styles.prefix}>{prefix}</Text>
          {input}
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
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  prefix: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  prefixedInput: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
    // The row already provides the padding; TextInput's own default would
    // push the text off-centre against the prefix beside it.
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
