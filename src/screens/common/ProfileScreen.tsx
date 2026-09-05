import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { PhotoSourceSheet } from '../../components/PhotoSourceSheet';
import { TextField } from '../../components/TextField';
import { LanguageSheet } from '../../components/LanguageSheet';
import { Toggle } from '../../components/Toggle';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../navigation/AuthContext';
import { useRole } from '../../navigation/RoleContext';
import { useUserProfile } from '../../navigation/UserProfileContext';
import { dataSource } from '../../data/dataSource';
import { pickSinglePhotoFromLibrary, takePhotoWithCamera } from '../../utils/imagePicker';
import { formatPhone } from '../../utils/phone';
import { PhoneRequiredDialog } from '../../components/PhoneRequiredDialog';
import { LANGUAGES, useTranslation } from '../../i18n';

interface Ratings {
  rating: number;
  ratingCount: number;
}

export function ProfileScreen() {
  const { activeRole, setActiveRole } = useRole();
  const { name, about, phone, avatarUrl, updateProfile } = useUserProfile();
  const { userId, email, signOut } = useAuth();
  const { t, language } = useTranslation();
  const isProvider = activeRole === 'provider';

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [aboutInput, setAboutInput] = useState(about);
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [ratings, setRatings] = useState<Ratings | undefined>(undefined);
  const [sourceSheetVisible, setSourceSheetVisible] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);

  // The signed-in user's own rating — the same aggregate everyone else sees
  // about them on Booking Requests/Detail (real reviews once Supabase is
  // connected, the mock directory's numbers otherwise).
  useEffect(() => {
    let mounted = true;
    dataSource.getPublicProfile(userId).then((profile) => {
      if (!mounted || !profile) return;
      setRatings({ rating: profile.rating, ratingCount: profile.ratingCount });
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

  const startEditing = () => {
    // Seed the form from what's saved right now, so cancelling an edit and
    // reopening never resurrects the abandoned draft.
    setNameInput(name);
    setAboutInput(about);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    // The number is deliberately not editable here. A number typed into a
    // plain field is unverified, which would make the SMS step pointless —
    // so changing it goes through `PhoneRequiredDialog` and its OTP, and
    // this form only owns name and bio.
    updateProfile({ name: nameInput.trim(), about: aboutInput.trim() });
    setIsEditing(false);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    // No navigation call needed — RootNavigator swaps back to the
    // Splash/Onboarding/Sign-up stack on its own once `isSignedIn` flips.
  };

  const hasRatings = Boolean(ratings && ratings.ratingCount > 0);
  const activeLanguageLabel =
    LANGUAGES.find((option) => option.value === language)?.label ?? language;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('profile.title')}</Text>

        <View style={[styles.card, styles.profileCard]}>
          {isEditing ? null : (
            <Pressable onPress={startEditing} hitSlop={12} style={styles.editIcon}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </Pressable>
          )}
          {isEditing ? (
            <>
              <View style={styles.editHeader}>
                <Text style={styles.editHeading}>{t('profile.editHeading')}</Text>
                <Pressable onPress={cancelEditing} hitSlop={12}>
                  <Text style={styles.cancelLink}>{t('common.cancel')}</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setSourceSheetVisible(true)} style={styles.avatarEditable}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={40} color={colors.textMuted} />
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera" size={12} color={colors.textOnPrimary} />
                </View>
              </Pressable>
              <Text style={styles.avatarHint}>{t('profile.tapToChangePhoto')}</Text>

              <TextField
                label={t('profile.fieldName')}
                placeholder={t('profile.namePlaceholder')}
                value={nameInput}
                onChangeText={setNameInput}
                autoCapitalize="words"
              />
              <View style={styles.fieldGap} />
              <TextField
                label={t('profile.fieldAbout')}
                placeholder={t('profile.aboutPlaceholder')}
                value={aboutInput}
                onChangeText={setAboutInput}
                multiline
              />
              <View style={styles.fieldGap} />
              <View style={styles.phoneRow}>
                <View style={styles.phoneText}>
                  <Text style={styles.phoneLabel}>{t('profile.fieldMobile')}</Text>
                  <Text style={phone ? styles.phoneValue : styles.phoneValueEmpty}>
                    {phone ? formatPhone(phone) : t('profile.addMobile')}
                  </Text>
                </View>
                <Pressable onPress={() => setPhoneSheetVisible(true)} hitSlop={8}>
                  <Text style={styles.phoneAction}>
                    {phone ? t('profile.changeMobile') : t('profile.addMobile')}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.emailNote}>
                {t('profile.emailNote', {
                  email: email || t('profile.emailNoteFallback'),
                })}
              </Text>
              <Button label={t('common.save')} onPress={handleSave} style={styles.saveButton} />
            </>
          ) : (
            <>
              <View style={styles.identityRow}>
                <View style={styles.avatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={30} color={colors.textMuted} />
                  )}
                </View>

                <View style={styles.identityText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name || t('profile.addYourName')}
                  </Text>
                  <View style={styles.ratingRow}>
                    <Ionicons
                      name={hasRatings ? 'star' : 'star-outline'}
                      size={15}
                      color={hasRatings ? colors.primary : colors.textMuted}
                    />
                    <Text style={styles.ratingText}>
                      {hasRatings && ratings
                        ? t(
                            ratings.ratingCount === 1
                              ? 'profile.ratingOne'
                              : 'profile.ratingOther',
                            {
                              rating: ratings.rating.toFixed(1),
                              count: ratings.ratingCount,
                            }
                          )
                        : t('profile.noRatings')}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={about ? styles.about : styles.aboutEmpty}>
                {about || t('profile.aboutEmpty')}
              </Text>

              <View style={styles.divider} />

              <ContactRow
                icon="mail-outline"
                value={email ?? ''}
                fallback={t('profile.noEmail')}
              />
              <ContactRow
                icon="call-outline"
                value={phone ? formatPhone(phone) : phone}
                fallback={t('profile.addMobile')}
                isLast
              />

            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.modeTitle}>{t('profile.providerMode')}</Text>
              <Text style={styles.modeSubtitle}>
                {t(isProvider ? 'profile.providerModeOn' : 'profile.providerModeOff')}
              </Text>
            </View>
            <Toggle
              value={isProvider}
              onValueChange={(next) => setActiveRole(next ? 'provider' : 'renter')}
              accessibilityLabel={t('profile.providerMode')}
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.modeTitle}>{t('profile.language')}</Text>
              <Text style={styles.modeSubtitle}>{activeLanguageLabel}</Text>
            </View>
            <Pressable
              onPress={() => setLanguageSheetVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('profile.changeLanguage')}
              style={styles.languageButton}
            >
              <Ionicons name="language-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.settingDivider} />

          <Button
            label={t('common.signOut')}
            variant="secondary"
            onPress={handleSignOut}
            loading={isSigningOut}
          />
        </View>
      </ScrollView>

      <PhoneRequiredDialog
        visible={phoneSheetVisible}
        reason="manage"
        onCancel={() => setPhoneSheetVisible(false)}
        onSaved={() => setPhoneSheetVisible(false)}
      />

      <LanguageSheet
        visible={languageSheetVisible}
        onClose={() => setLanguageSheetVisible(false)}
      />

      <PhotoSourceSheet
        visible={sourceSheetVisible}
        title={t('photoSource.changePhoto')}
        onClose={() => setSourceSheetVisible(false)}
        onCamera={handleTakePhoto}
        onLibrary={handleChooseFromLibrary}
      />
    </SafeAreaView>
  );
}

/** Icon + value line for the card's contact details. The icon carries the
 * meaning, so there's no separate label to turn this back into a list. */
function ContactRow({
  icon,
  value,
  fallback,
  isLast,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  fallback: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.contactRow, isLast && styles.contactRowLast]}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={value ? styles.contactValue : styles.contactValueEmpty} numberOfLines={1}>
        {value || fallback}
      </Text>
    </View>
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
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  profileCard: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  // --- read mode -------------------------------------------------------
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    // Never squashed by a long name beside it.
    flexShrink: 0,
    width: 70,
    height: 70,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
  },
  identityText: {
    flex: 1,
    // Clears the absolutely-positioned edit button in the corner.
    paddingRight: 44,
  },
  name: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  editIcon: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    // Above the identity row, so the tap target is never covered by it.
    zIndex: 1,
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  about: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  aboutEmpty: {
    ...typography.bodyLarge,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: spacing.lg,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  contactRowLast: {
    marginBottom: 0,
  },
  contactValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
  },
  contactValueEmpty: {
    ...typography.bodyLarge,
    color: colors.textMuted,
    flex: 1,
  },

  // --- edit mode -------------------------------------------------------
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  editHeading: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  cancelLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  avatarEditable: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  phoneText: {
    flex: 1,
  },
  phoneLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  phoneValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  phoneValueEmpty: {
    ...typography.bodyLarge,
    color: colors.textMuted,
  },
  phoneAction: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  fieldGap: {
    height: spacing.sm,
  },
  emailNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.md,
  },

  // --- provider mode ---------------------------------------------------
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingText: {
    flex: 1,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: spacing.md,
  },
  languageButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  modeSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
