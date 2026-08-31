import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../navigation/AuthContext';
import { useRole } from '../../navigation/RoleContext';
import { useUserProfile } from '../../navigation/UserProfileContext';
import { isSupabaseConfigured } from '../../data/supabaseClient';
import { dataSource } from '../../data/dataSource';
import { choosePhotoSource, pickSinglePhotoFromLibrary, takePhotoWithCamera } from '../../utils/imagePicker';

// Loose on purpose — accepts spaces/dashes/parens and an optional leading
// "+countrycode", just enough to catch obviously-incomplete input without
// being a strict international phone validator.
const PHONE_REGEX = /^\+?[0-9\s-()]{7,16}$/;

export function ProfileScreen() {
  const { activeRole, toggleRole } = useRole();
  const { name, phone, avatarUrl, updateProfile } = useUserProfile();
  const { userId, email, signOut } = useAuth();
  const isProvider = activeRole === 'provider';

  const [nameInput, setNameInput] = useState(name);
  const [phoneInput, setPhoneInput] = useState(phone);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [justSaved, setJustSaved] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [rating, setRating] = useState<number | undefined>(undefined);

  // The signed-in user's own rating — the same real aggregate (real reviews
  // once Supabase is connected, the mock directory's number otherwise) shown
  // to everyone else about them on Booking Requests/Detail, now surfaced on
  // their own Profile too.
  useEffect(() => {
    let mounted = true;
    dataSource.getPublicProfile(userId).then((profile) => {
      if (mounted) setRating(profile?.rating);
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleTakePhoto = async () => {
    const uri = await takePhotoWithCamera();
    if (uri) updateProfile({ avatarUrl: uri });
  };

  const handleChooseFromLibrary = async () => {
    const uri = await pickSinglePhotoFromLibrary();
    if (uri) updateProfile({ avatarUrl: uri });
  };

  const handleChangePhoto = () => {
    choosePhotoSource({
      title: 'Change profile photo',
      onTakePhoto: handleTakePhoto,
      onChooseLibrary: handleChooseFromLibrary,
    });
  };

  // Keep the form in sync if the underlying profile ever changes from
  // outside this screen (there's no such path today, but this is what a
  // real account-refresh would need).
  useEffect(() => setNameInput(name), [name]);
  useEffect(() => setPhoneInput(phone), [phone]);

  const hasChanges = nameInput.trim() !== name || phoneInput.trim() !== phone;

  const handleSave = () => {
    const trimmedName = nameInput.trim();
    const trimmedPhone = phoneInput.trim();

    if (!trimmedPhone || !PHONE_REGEX.test(trimmedPhone)) {
      setPhoneError('Enter a valid phone number, with country code if outside India.');
      return;
    }
    setPhoneError(undefined);

    updateProfile({ name: trimmedName || 'You', phone: trimmedPhone });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    // No navigation call needed — RootNavigator swaps back to the
    // Splash/Onboarding/Sign-up stack on its own once `isSignedIn` flips.
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.avatarBlock}>
          <Pressable onPress={handleChangePhoto} style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={36} color={colors.textMuted} />
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={12} color={colors.textOnPrimary} />
            </View>
          </Pressable>
          <Text style={styles.name}>{name}</Text>
          {rating !== undefined ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={colors.primary} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
          <Text style={styles.email}>
            {isSupabaseConfigured && email ? `Signed in as ${email}` : 'Signed in'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Your Details</Text>
        <View style={styles.card}>
          <Text style={styles.detailsHint}>
            Shared with a renter or host only once a booking is confirmed, so they can reach you
            directly — never shown while just browsing.
          </Text>
          <TextField
            label="Name"
            placeholder="Your name"
            value={nameInput}
            onChangeText={setNameInput}
            autoCapitalize="words"
          />
          <View style={{ height: spacing.sm }} />
          <TextField
            label="Mobile Number"
            placeholder="+91 98765 00009"
            value={phoneInput}
            onChangeText={(text) => {
              setPhoneInput(text);
              if (phoneError) setPhoneError(undefined);
            }}
            keyboardType="phone-pad"
            errorText={phoneError}
          />
          <Button
            label={justSaved ? 'Saved ✓' : 'Save'}
            onPress={handleSave}
            disabled={!hasChanges && !justSaved}
            style={styles.saveButton}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextBlock}>
              <Text style={styles.cardTitle}>Provider mode</Text>
              <Text style={styles.cardSubtitle}>
                {isProvider
                  ? 'You are browsing as a space owner.'
                  : 'Switch on to list and manage parking spots.'}
              </Text>
            </View>
            <Switch
              value={isProvider}
              onValueChange={toggleRole}
              trackColor={{ false: colors.surfaceBorder, true: colors.primaryMuted }}
              thumbColor={isProvider ? colors.primary : colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.footnote}>
          A real user can be both a renter and a provider — this switch just
          changes which tabs you see for now. Full role-based routing is
          refined in a later phase.
        </Text>

        <Button
          label="Sign Out"
          variant="secondary"
          onPress={handleSignOut}
          loading={isSigningOut}
          style={styles.signOutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  email: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailsHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  saveButton: {
    marginTop: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTextBlock: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footnote: {
    ...typography.caption,
    color: colors.textMuted,
  },
  signOutButton: {
    marginTop: spacing.lg,
  },
});