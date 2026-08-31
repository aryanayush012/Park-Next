import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListingCard } from '../../components/ListingCard';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderListingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { AMENITIES } from '../../data/mockData';
import { useAuth } from '../../navigation/AuthContext';
import { Listing } from '../../types';
import { mapListingToDraft } from './addListingDraft';

type Props = NativeStackScreenProps<ProviderListingsStackParamList, 'MyListings'>;

export function MyListingsScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);

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
          <Text style={styles.title}>My Listings</Text>
          <Text style={styles.subtitle}>
            {listings.length} listing{listings.length === 1 ? '' : 's'} · {activeCount} active
          </Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate('AddListingDetails', {})}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
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
                <Switch
                  value={item.isActive}
                  onValueChange={(value) => handleToggleActive(item, value)}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primaryMuted }}
                  thumbColor={item.isActive ? colors.primary : colors.textMuted}
                />
                <Text style={styles.rowHeaderLabel}>{item.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
              <Pressable onPress={() => handleEdit(item)} hitSlop={8}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
            </View>

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
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            You haven't listed a spot yet. Tap "+ Add" to create your first listing.
          </Text>
        }
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
  editLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});