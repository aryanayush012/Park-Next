import React, { useRef } from 'react';
import { NativeSyntheticEvent, StyleSheet, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

const CELL_COUNT = 6;

export interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function OTPInput({ value, onChange, autoFocus }: OTPInputProps) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const digits = Array.from({ length: CELL_COUNT }, (_, i) => value[i] ?? '');

  const handleChangeText = (text: string, index: number) => {
    // Handle pasted multi-digit strings by spreading across cells.
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 1) {
      const newValue = (value.slice(0, index) + cleaned).slice(0, CELL_COUNT);
      onChange(newValue);
      const nextIndex = Math.min(newValue.length, CELL_COUNT - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const chars = value.split('');
    chars[index] = cleaned;
    const newValue = chars.join('').slice(0, CELL_COUNT);
    onChange(newValue);

    if (cleaned && index < CELL_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const chars = value.split('');
      chars[index - 1] = '';
      onChange(chars.join(''));
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => {
        const isFilled = Boolean(digit);
        const isActiveNext = !isFilled && index === value.length;
        return (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            value={digit}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={CELL_COUNT}
            autoFocus={autoFocus && index === 0}
            style={[
              styles.cell,
              isFilled && styles.cellFilled,
              isActiveNext && styles.cellActive,
            ]}
            selectionColor={colors.primary}
          />
        );
      })}
    </View>
  );
}

const CELL_SIZE = 48;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    textAlign: 'center',
    color: colors.textPrimary,
    ...typography.h2,
  },
  cellFilled: {
    borderColor: colors.primary,
  },
  cellActive: {
    borderColor: colors.primary,
  },
});
