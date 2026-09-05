import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { PhoneRequiredDialog } from '../../components/PhoneRequiredDialog';
import { ListingCard } from '../../components/ListingCard';
import { useTranslation } from '../../i18n';
import { colors, spacing, typography } from '../../theme';
import { ProviderListingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { AMENITIES } from '../../data/mockData';
import { useAuth } from '../../navigation/AuthContext';
import { useUserProfile } from '../../navigation/UserProfileContext';
import { mapDraftToCreateInput } from './addListingDraft';

type Props = NativeStackScreenProps<ProviderListingsStackParamList, 'ListingReviewPublish'>;

export function ListingReviewPublishScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { phone } = useUserProfile();
  const { draft, editingListingId } = route.params;
  const [confirmed, setConfirmed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [phoneGateVisible, setPhoneGateVisible] = useState(false);

  /** Gate publishing on having a mobile number, then hand off to `publishListing`. */
  const handlePublish = () => {
    if (!confirmed) return;
    if (!phone.trim()) {
      setPhoneGateVisible(true);
      return;
    }
    publishListing();
  };

  const publishListing = async () => {
    setIsPublishing(true);
    try {
      const input = mapDraftToCreateInput(draft, userId);
      if (editingListingId) {
        await dataSource.updateListing(editingListingId, input);
      } else {
        await dataSource.createListing(input);
      }
      // Not `popToTop()`: that lands on whatever happens to sit at index 0,
      // and the Add Listing flow can be started from the Dashboard, which
      // builds this stack without `MyListings` underneath at all (see the
      // comment on that button). Resetting states the destination outright,
      // so a published listing always ends on the list it was added to and
      // the half-finished flow is gone from the back stack.
      navigation.reset({ index: 0, routes: [{ name: 'MyListings' }] });
    } catch (error) {
      Alert.alert(t('review.failedTitle'), t('review.failedBody'));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('review.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('review.subtitle')}</Text>

        <ListingCard
          title={draft.title || t('review.untitled')}
          photoUrl={draft.photos[0] ?? ''}
          distanceKm={0}
          address={draft.address}
          pricePerHour={draft.pricePerHour}
          currency="₹"
          rating={0}
          ratingCount={0}
          status="available"
          amenities={draft.amenities.map((key) => AMENITIES[key])}
        />

        <View style={styles.checkboxCard}>
          <Checkbox
            checked={confirmed}
            onToggle={() => setConfirmed((prev) => !prev)}
            label={t('review.confirm')}
          />
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={editingListingId ? t('review.saveChanges') : t('review.publish')}
          onPress={handlePublish}
          disabled={!confirmed}
          loading={isPublishing}
        />
        {!confirmed ? (
          <Text style={styles.helperText}>{t('review.checkBox')}</Text>
        ) : null}
      </View>

      <PhoneRequiredDialog
        visible={phoneGateVisible}
        reason="publish"
        onCancel={() => setPhoneGateVisible(false)}
        onSaved={() => {
          setPhoneGateVisible(false);
          publishListing();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  checkboxCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});