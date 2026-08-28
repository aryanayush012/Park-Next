import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'pricetag',
    title: 'Never circle the block again',
    description:
      'Find a verified private parking spot near your destination in seconds — no more endless loops.',
  },
  {
    icon: 'time',
    title: 'Book a private spot by the hour',
    description:
      'Reserve in advance, or grab one instantly while you’re already on the road.',
  },
  {
    icon: 'navigate',
    title: 'Get turn-by-turn directions',
    description:
      'Once you’re booked, follow in-app directions straight to your reserved spot.',
  },
];

export function OnboardingScreen({ navigation }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLastSlide = activeIndex === SLIDES.length - 1;

  const goToSignUp = () => navigation.replace('SignUpEmail');

  const handleNext = () => {
    if (isLastSlide) {
      goToSignUp();
      return;
    }
    const nextIndex = activeIndex + 1;
    scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
    setActiveIndex(nextIndex);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.illustration}>
              <View style={styles.illustrationCircle}>
                <View style={styles.bubble}>
                  <Ionicons name={slide.icon} size={22} color={colors.textOnPrimary} />
                </View>
              </View>
            </View>

            <View style={styles.dots}>
              {SLIDES.map((_, dotIndex) => (
                <View
                  key={dotIndex}
                  style={[
                    styles.dot,
                    dotIndex === activeIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={isLastSlide ? 'Get Started' : 'Next'} onPress={handleNext} />
        {!isLastSlide ? (
          <Text style={styles.skip} onPress={goToSignUp}>
            Skip
          </Text>
        ) : (
          <View style={styles.skipSpacer} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pager: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  illustrationCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.secondaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xxs,
  },
  dot: {
    height: 8,
    borderRadius: radius.full,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: colors.surfaceBorder,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  skip: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  skipSpacer: {
    height: 20,
    marginTop: spacing.md,
  },
});
