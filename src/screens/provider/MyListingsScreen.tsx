import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListingCard } from '../../components/ListingCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toggle } from '../../components/Toggle';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderListingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { AMENITIES } from '../../data/mockData';
import { useAuth } from '../../navigation/AuthContext';
import { Listing, LISTING_HAS_ACTIVE_BOOKINGS } from '../../types';
import { mapListingToDraft } from './addListingDraft';
import { useTranslation } from '../../i18n';

type Props = NativeStackScreenProps<ProviderListingsStackParamList, 'MyListings'>;

export function MyListingsScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const [listings, setListings] = useState<Listing[]>([]);
  /** The listing awaiting a delete confirmation, if any. Holding the whole
   * listing rather than an id keeps its title available for the dialog. */
  const [pendingDelete, setPendingDelete] = useState<Listing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  /** Which failure to explain after a delete is refused, or null. */
  const [deleteError, setDeleteError] = useState<'blocked' | 'failed' | null>(null);

  const load = useCallback(async () => {
    const own = await dataSource.getListingsByOwner(userId);
    setListings(own);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeCount = listings.filter((l) => l.isActive).length;

  const handleToggleActive = async (listing: Listing, value: boolean) => {
    setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, isActive: value } : l)));
    try {
      await dataSource.setListingActive(listing.id, value);
    } catch {
      // Revert on failure.
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, isActive: !value } : l)));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const listing = pendingDelete;
    setIsDeleting(true);
    try {
      await dataSource.deleteListing(listing.id);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setPendingDelete(null);
    } catch (error) {
      // A listing with live bookings is refused on purpose — that is a
      // different message from something actually going wrong, because one
      // is fixable by the owner and the other is not.
      const hasLiveBookings =
        error instanceof Error && error.message === LISTING_HAS_ACTIVE_BOOKINGS;
      setPendingDelete(null);
      setDeleteError(hasLiveBookings ? 'blocked' : 'failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (listing: Listing) => {
    navigation.navigate('AddListingDetails', {
      draft: mapListingToDraft(listing),
      editingListingId: listing.id,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('listings.title')}</Text>
          <Text style={styles.subtitle}>
            {t(listings.length === 1 ? 'listings.countOne' : 'listings.countOther', {
              count: listings.length,
              active: activeCount,
            })}
          </Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate('AddListingDetails', {})}
        >
          <Text style={styles.addButtonText}>{t('listings.add')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <View style={styles.rowHeader}>
              <View style={styles.rowHeaderLeft}>
                <Toggle
                  value={item.isActive}
                  onValueChange={(value) => handleToggleActive(item, value)}
                  accessibilityLabel={t(item.isActive ? 'listings.active' : 'listings.inactive')}
                />
                <Text style={styles.rowHeaderLabel}>
                  {t(item.isActive ? 'listings.active' : 'listings.inactive')}
                </Text>
              </View>
            </View>

            {/* `dimmed` fades the photo/text only — the delete and edit
                buttons below stay at full opacity, since those are exactly
                what someone managing an inactive listing still needs to see
                clearly. */}
            <ListingCard
              title={item.title}
              photoUrl={item.photoUrl}
              distanceKm={item.distanceKm}
              address={item.address}
              pricePerHour={item.pricePerHour}
              currency={item.currency}
              rating={item.rating}
              ratingCount={item.ratingCount}
              status={item.status}
              amenities={item.amenities.map((key) => AMENITIES[key])}
              dimmed={!item.isActive}
              // Deleting is only offered once a listing is inactive, so
              // taking it off the market is always the first step and the
              // irreversible action can never be the quicker tap.
              topRightAction={
                item.isActive ? null : (
                  <Pressable
                    onPress={() => setPendingDelete(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('listings.deleteA11y', { title: item.title })}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                )
              }
              bottomRightAction={
                <Pressable
                  onPress={() => handleEdit(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('listings.editA11y', { title: item.title })}
                  style={styles.editButton}
                >
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </Pressable>
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('listings.empty')}</Text>
        }
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        tone="danger"
        icon="trash-outline"
        title={t('listings.deleteTitle')}
        body={t('listings.deleteBody', { title: pendingDelete?.title ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        visible={deleteError !== null}
        tone="danger"
        icon={deleteError === 'blocked' ? 'time-outline' : 'alert-circle-outline'}
        title={t(
          deleteError === 'blocked'
            ? 'listings.deleteBlockedTitle'
            : 'listings.deleteFailedTitle'
        )}
        body={t(
          deleteError === 'blocked'
            ? 'listings.deleteBlockedBody'
            : 'listings.deleteFailedBody'
        )}
        confirmLabel={t('common.ok')}
        onConfirm={() => setDeleteError(null)}
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addButtonText: {
    ...typography.buttonLabel,
    color: colors.textOnPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowHeaderLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    // Sits on the listing photo, so it needs a scrim of its own rather
    // than the translucent error tint used against a solid surface.
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});