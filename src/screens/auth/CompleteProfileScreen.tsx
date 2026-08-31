import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../navigation/AuthContext';
import { useUserProfile } from '../../navigation/UserProfileContext';
import { choosePhotoSource, pickSinglePhotoFromLibrary, takePhotoWithCamera } from '../../utils/imagePicker';

// Same loose validator used on the Profile screen's own edit form — spaces/
// dashes/parens and an optional leading "+countrycode" allowed.
const PHONE_REGEX = /^\+?[0-9\s-()]{7,16}$/;

export function CompleteProfileScreen() {
  const { signOut } = useAuth();
  const { completeProfile } = useUserProfile();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleTakePhoto = async () => {
    const uri = await takePhotoWithCamera();
    if (uri) setAvatarUri(uri);
  };

  const handleChooseFromLibrary = async () => {
    const uri = await pickSinglePhotoFromLibrary();
    if (uri) setAvatarUri(uri);
  };

  const handlePickAvatar = () => {
    choosePhotoSource({
      title: 'Add a profile photo',
      onTakePhoto: handleTakePhoto,
      onChooseLibrary: handleChooseFromLibrary,
    });
  };

  const handleContinue = () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    let hasError = false;

    if (!trimmedName) {
      setNameError('Enter your name.');
      hasError = true;
    } else {
      setNameError(undefined);
    }

    if (!trimmedPhone || !PHONE_REGEX.test(trimmedPhone)) {
      setPhoneError('Enter a valid phone number, with country code if outside India.');
      hasError = true;
    } else {
      setPhoneError(undefined);
    }

    if (hasError) return;

    setIsSaving(true);
    // No navigation call needed — completing the profile flips
    // `isProfileComplete`, and `RootNavigator` swaps straight to Main once
    // that (and `isSignedIn`) are both true, same pattern as every real
    // sign-in path (email+password, Google, or mock).
    completeProfile({ name: trimmedName, phone: trimmedPhone, avatarUrl: avatarUri });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>
            One last step — a real name and mobile number help renters and hosts trust who
            they're dealing with. A profile photo is optional.
          </Text>

          <View style={styles.avatarBlock}>
            <Pressable onPress={handlePickAvatar} style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={32} color={colors.textMuted} />
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color={colors.textOnPrimary} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>{avatarUri ? 'Change photo' : 'Add photo (optional)'}</Text>
          </View>

          <TextField
            label="Name"
            placeholder="Your full name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError(undefined);
            }}
            autoCapitalize="words"
            errorText={nameError}
          />
          <View style={{ height: spacing.sm }} />
          <TextField
            label="Mobile Number"
            placeholder="+91 98765 00009"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (phoneError) setPhoneError(undefined);
            }}
            keyboardType="phone-pad"
            errorText={phoneError}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Continue" onPress={handleContinue} loading={isSaving} />
          <Text style={styles.signOutLink} onPress={handleSignOut} suppressHighlighting={isSigningOut}>
            {isSigningOut ? 'Signing out…' : 'Wrong account? Sign out'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    flexGrow: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 84,
    height: 84,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  signOutLink: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});