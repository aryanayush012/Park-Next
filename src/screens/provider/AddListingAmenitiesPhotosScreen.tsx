import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { SelectableChip } from '../../components/SelectableChip';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderListingsStackParamList } from '../../navigation/types';
import { AMENITIES, AMENITY_SELECTOR_KEYS } from '../../data/mockData';
import { AmenityKey } from '../../types';
import { choosePhotoSource, pickPhotosFromLibrary, takePhotoWithCamera } from '../../utils/imagePicker';

type Props = NativeStackScreenProps<ProviderListingsStackParamList, 'AddListingAmenitiesPhotos'>;

const MAX_PHOTOS = 6;

export function AddListingAmenitiesPhotosScreen({ navigation, route }: Props) {
  const { draft, editingListingId } = route.params;
  const [amenities, setAmenities] = useState<AmenityKey[]>(draft.amenities);
  const [photos, setPhotos] = useState<string[]>(draft.photos);

  const toggleAmenity = (key: AmenityKey) => {
    setAmenities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const handleTakePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const uri = await takePhotoWithCamera();
    if (uri) setPhotos((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
  };

  const handleChooseFromLibrary = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const uris = await pickPhotosFromLibrary(remaining);
    if (uris) setPhotos((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
  };

  const handleAddPhoto = () => {
    choosePhotoSource({
      title: 'Add a listing photo',
      onTakePhoto: handleTakePhoto,
      onChooseLibrary: handleChooseFromLibrary,
    });
  };

  const handleContinue = () => {
    navigation.navigate('AddListingPricingAvailability', {
      draft: { ...draft, amenities, photos },
      editingListingId,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>{editingListingId ? 'Edit Listing' : 'Add Listing'}</Text>
          <Text style={styles.stepLabel}>Step 2 of 3 · Amenities &amp; Photos</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Amenities</Text>
        <Text style={styles.sectionSubtitle}>Select all that apply</Text>
        <View style={styles.chipRow}>
          {AMENITY_SELECTOR_KEYS.map((key) => (
            <SelectableChip
              key={key}
              label={AMENITIES[key].label}
              icon={AMENITIES[key].icon as any}
              selected={amenities.includes(key)}
              onPress={() => toggleAmenity(key)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Photos</Text>
        <Text style={styles.noticeText}>Photos only — video uploads are not supported.</Text>

        <View style={styles.photoGrid}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoTile}>
              <Image source={{ uri }} style={styles.photoImage} />
              <Pressable onPress={() => removePhoto(uri)} style={styles.removeButton} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.textPrimary} />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable onPress={handleAddPhoto} style={[styles.photoTile, styles.addTile]}>
              <Ionicons name="add" size={28} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Continue to Pricing"
          onPress={handleContinue}
          disabled={photos.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const TILE_SIZE = 104;

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
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xxs,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  noticeText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(11,13,18,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
});