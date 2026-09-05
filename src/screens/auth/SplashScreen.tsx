import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from '../../i18n';
import { colors, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const AUTO_ADVANCE_MS = 1600;

export function SplashScreen({ navigation }: Props) {
  const { t } = useTranslation();
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <Pressable
      style={styles.container}
      onPress={() => navigation.replace('Onboarding')}
    >
      <View style={styles.glow} />
      <View style={styles.logoMark}>
        <Text style={styles.logoLetter}>P</Text>
      </View>
      <Text style={styles.wordmark}>ParkNext</Text>
      <Text style={styles.tagline}>{t('splash.tagline')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  logoMark: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  logoLetter: {
    ...typography.display,
    fontSize: 40,
    lineHeight: 52,
    color: colors.textOnPrimary,
  },
  wordmark: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
