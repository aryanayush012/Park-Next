import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { ListingCard } from '../../components/ListingCard';
import { colors, spacing, typography } from '../../theme';
import { ProviderListingsStackParamList } from '../../navigation/types';
import { dataSource, CURRENT_USER_ID } from '../../data/dataSource';
import { AMENITIES } from '../../data/mockData';
import { mapDraftToCreateInput } from './addListingDraft';

type Props = NativeStackScreenProps<ProviderListingsStackParamList, 'ListingReviewPublish'>;

export function ListingReviewPublishScreen({ navigation, route }: Props) {
  const { draft, editingListingId } = route.params;
  const [confirmed, setConfirmed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (!confirmed) return;
    setIsPublishing(true);
    try {
      const input = mapDraftToCreateInput(draft, CURRENT_USER_ID);
      if (editingListingId) {
        await dataSource.updateListing(editingListingId, input);
      } else {
        await dataSource.createListing(input);
      }
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not publish this listing. Please try again.');
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
        <Text style={styles.headerTitle}>Review & Publish</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>This is how renters will see your listing</Text>

        <ListingCard
          title={draft.title || 'Untitled Spot'}
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
            label="I confirm I have the right to rent this parking space out. ParkNext does not verify ownership documents at this time."
          />
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={editingListingId ? 'Save Changes' : 'Publish Listing'}
          onPress={handlePublish}
          disabled={!confirmed}
          loading={isPublishing}
        />
        {!confirmed ? (
          <Text style={styles.helperText}>Check the confirmation box above to enable publishing.</Text>
        ) : null}
      </View>
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
