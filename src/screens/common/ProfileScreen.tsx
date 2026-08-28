import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, radius, spacing, typography } from '../../theme';
import { useRole } from '../../navigation/RoleContext';
import { useUserProfile } from '../../navigation/UserProfileContext';

// Loose on purpose — accepts spaces/dashes/parens and an optional leading
// "+countrycode", just enough to catch obviously-incomplete input without
// being a strict international phone validator.
const PHONE_REGEX = /^\+?[0-9\s-()]{7,16}$/;

export function ProfileScreen() {
  const { activeRole, toggleRole } = useRole();
  const { name, phone, updateProfile } = useUserProfile();
  const isProvider = activeRole === 'provider';

  const [nameInput, setNameInput] = useState(name);
  const [phoneInput, setPhoneInput] = useState(phone);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [justSaved, setJustSaved] = useState(false);

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={colors.textMuted} />
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>Signed in via email OTP</Text>
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
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  email: {
    ...typography.caption,
    color: colors.textMuted,
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
});