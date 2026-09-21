import React, { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { BrandFooter } from '../../components/BrandFooter';
import { TextField } from '../../components/TextField';
import { SelectableChip } from '../../components/SelectableChip';
import { MapView } from '../../components/MapView';
import { useTranslation } from '../../i18n';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderListingsStackParamList } from '../../navigation/types';
import { VEHICLE_TYPE_LABELS } from '../../data/mockData';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { AddressSuggestion, useAddressSuggestions } from '../../hooks/useaddresssuggestions';
import { DEFAULT_ADD_LISTING_DRAFT } from './addListingDraft';
import { VehicleType } from '../../types';

type Props = NativeStackScreenProps<ProviderListingsStackParamList, 'AddListingDetails'>;

const VEHICLE_TYPES: VehicleType[] = ['two_wheeler', 'car', 'suv'];

export function AddListingDetailsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { editingListingId } = route.params ?? {};
  const initialDraft = route.params?.draft ?? DEFAULT_ADD_LISTING_DRAFT;
  const { location: currentLocation } = useCurrentLocation();

  const [title, setTitle] = useState(initialDraft.title);
  const [description, setDescription] = useState(initialDraft.description);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>(initialDraft.vehicleTypes);
  const [address, setAddress] = useState(initialDraft.address);
  const [latitude, setLatitude] = useState<number | null>(initialDraft.latitude);
  const [longitude, setLongitude] = useState<number | null>(initialDraft.longitude);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const { suggestions: addressSuggestions } = useAddressSuggestions(address);

  // The map has to be pannable so someone can find their exact spot before
  // dropping a pin, but it sits inside this form's ScrollView, which would
  // otherwise win every vertical drag and scroll the page instead.
  //
  // This used to lock the ScrollView imperatively via `setNativeProps`,
  // chosen over state on the grounds that a re-render lands a frame later
  // than the gesture. That reasoning was sound on the old architecture, but
  // `setNativeProps` is unsupported under Fabric — which this app runs —
  // so it had quietly become a no-op. State is a frame behind in theory;
  // in practice a pan needs finger-down *plus* movement past a threshold,
  // which is longer than one frame. If it ever does feel late, the fix is a
  // native gesture handler, not a return to setNativeProps.
  const [mapPanning, setMapPanning] = useState(false);

  const handleSelectAddress = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setLatitude(suggestion.latitude);
    setLongitude(suggestion.longitude);
    setIsAddressFocused(false);
    Keyboard.dismiss();
  };

  const toggleVehicleType = (type: VehicleType) => {
    setVehicleTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const canContinue =
    title.trim().length > 0 &&
    address.trim().length > 0 &&
    vehicleTypes.length > 0 &&
    latitude !== null &&
    longitude !== null;

  const handleContinue = () => {
    if (!canContinue || latitude === null || longitude === null) return;
    navigation.navigate('AddListingAmenitiesPhotos', {
      draft: {
        ...initialDraft,
        title,
        description,
        vehicleTypes,
        address,
        latitude,
        longitude,
      },
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
          <Text style={styles.headerTitle}>{editingListingId ? t('common.editListing') : t('common.addListing')}</Text>
          <Text style={styles.stepLabel}>{t('addListing.step1')}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapPanning}
        // Without this, a ScrollView's default behaviour is to eat the
        // *first* tap on anything inside it just to dismiss the keyboard —
        // so tapping a suggestion row while the Address field is still
        // focused only closed the keyboard, never actually selected it,
        // and a second tap was needed. "handled" lets a touchable that
        // handles its own press (our suggestion Pressables) fire on the
        // very first tap, keyboard open or not; the manual onBlur delay
        // above stays too, since a suggestion tap still blurs the input a
        // beat before its own onPress resolves.
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label={t('addListing.titleLabel')}
          placeholder={t('addListing.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          helperText={t('addListing.titleHelper')}
        />

        <View style={{ height: spacing.md }} />

        <TextField
          label={t('addListing.descriptionLabel')}
          placeholder="Secure covered spot in a gated society, 2 mins walk from Sony World Signal. Easy in/out access."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.sectionTitle}>{t('addListing.vehicleTypes')}</Text>
        <View style={styles.chipRow}>
          {VEHICLE_TYPES.map((type) => (
            <SelectableChip
              key={type}
              label={t(`vehicle.${type}`)}
              selected={vehicleTypes.includes(type)}
              onPress={() => toggleVehicleType(type)}
            />
          ))}
        </View>

        <View style={{ height: spacing.md }} />

        <View style={styles.addressFieldWrap}>
          <TextField
            label={t('addListing.addressLabel')}
            placeholder="80 Feet Road, Koramangala 5th Block"
            value={address}
            onChangeText={setAddress}
            onFocus={() => setIsAddressFocused(true)}
            onBlur={() => {
              // Tapping a suggestion blurs the input a beat before its own
              // onPress fires — hiding the list immediately on blur would
              // unmount the row out from under that tap. A short delay lets
              // the press register first.
              setTimeout(() => setIsAddressFocused(false), 150);
            }}
            helperText={t('addListing.addressHelper')}
          />
          {isAddressFocused && addressSuggestions.length > 0 ? (
            <View style={styles.suggestionsBox}>
              {addressSuggestions.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectAddress(item)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    pressed && styles.suggestionRowPressed,
                  ]}
                >
                  <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{t('addListing.pinLocation')}</Text>
        <MapView
          latitude={latitude ?? currentLocation.latitude}
          longitude={longitude ?? currentLocation.longitude}
          zoom={15}
          pickable
          pickedLocation={latitude !== null && longitude !== null ? { latitude, longitude } : null}
          onLocationSelect={(point) => {
            setLatitude(point.latitude);
            setLongitude(point.longitude);
          }}
          onTouchActiveChange={setMapPanning}
          style={styles.map}
        />
        <Text style={styles.mapHint}>
          {latitude !== null ? t('addListing.tapToMovePin') : t('addListing.tapToDropPin')}
        </Text>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t('addListing.continueToAmenities')} onPress={handleContinue} disabled={!canContinue} />
      </View>
      <BrandFooter height={84} />
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
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  addressFieldWrap: {
    position: 'relative',
    zIndex: 20,
  },
  suggestionsBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    zIndex: 30,
    elevation: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  suggestionRowPressed: {
    backgroundColor: colors.surface,
  },
  suggestionText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  map: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  mapHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
});