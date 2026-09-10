import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { useAppTheme } from '../../store/theme-store';
import { NstLogoMark } from '../NstLogo';
import {
  DEV_CLUB_NAME,
  DEV_CLUB_MISSION,
  DEV_CLUB_GITHUB_URL,
  DEV_CLUB_CONTRIBUTORS_URL,
  DEV_CLUB_PROJECT_LEAD_URL,
  MOBILE_APP_VERSION,
} from '../../infrastructure/brand-config';

interface DevClubCreditsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DevClubCreditsModal({ visible, onClose }: DevClubCreditsModalProps) {
  const theme = useAppTheme();

  const handleOpenUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch {
      // Safe fallback if external browser cannot open
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderHairline,
            },
          ]}
        >
          {/* Header Bar */}
          <View
            style={[
              styles.headerBar,
              {
                borderBottomColor: theme.colors.borderHairline,
                backgroundColor: theme.colors.surfaceContainerLow,
              },
            ]}
          >
            <View style={styles.headerDotRow}>
              <View
                style={[
                  styles.pingDot,
                  { backgroundColor: theme.colors.secondary },
                ]}
              />
              <Text
                style={[
                  styles.headerTitle,
                  {
                    color: theme.colors.primary,
                    fontFamily: theme.typography.monoBold,
                  },
                ]}
              >
                SYS.ABOUT // DEV_CLUB
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.closeText,
                  {
                    color: theme.colors.onSurfaceVariant,
                    fontFamily: theme.typography.monoBold,
                  },
                ]}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Logo and Name */}
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.logoBox,
                  {
                    borderColor: theme.colors.borderHairline,
                    backgroundColor: theme.colors.surfaceContainerLow,
                  },
                ]}
              >
                <NstLogoMark size={32} />
              </View>
              <View style={styles.brandTextColumn}>
                <Text
                  style={[
                    styles.clubName,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.syneBold,
                    },
                  ]}
                >
                  {DEV_CLUB_NAME}
                </Text>
                <Text
                  style={[
                    styles.institution,
                    {
                      color: theme.colors.secondary,
                      fontFamily: theme.typography.monoMedium,
                    },
                  ]}
                >
                  Newton School of Technology
                </Text>
              </View>
            </View>

            {/* Mission Box */}
            <View
              style={[
                styles.sectionBox,
                {
                  backgroundColor: theme.colors.surfaceContainerLow,
                  borderColor: theme.colors.borderHairline,
                },
              ]}
            >
              <Text
                style={[
                  styles.sectionLabel,
                  {
                    color: theme.colors.onSurfaceVariant,
                    fontFamily: theme.typography.monoBold,
                  },
                ]}
              >
                [ MISSION ]
              </Text>
              <Text
                style={[
                  styles.bodyText,
                  {
                    color: theme.colors.onSurface,
                    fontFamily: theme.typography.interRegular,
                  },
                ]}
              >
                {DEV_CLUB_MISSION}
              </Text>
            </View>

            {/* Version Metadata Box */}
            <View
              style={[
                styles.sectionBox,
                {
                  backgroundColor: theme.colors.surfaceContainerLow,
                  borderColor: theme.colors.borderHairline,
                },
              ]}
            >
              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.metaKey,
                    {
                      color: theme.colors.onSurfaceVariant,
                      fontFamily: theme.typography.monoMedium,
                    },
                  ]}
                >
                  APPLICATION:
                </Text>
                <Text
                  style={[
                    styles.metaVal,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.monoBold,
                    },
                  ]}
                >
                  NST Events Mobile
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.metaKey,
                    {
                      color: theme.colors.onSurfaceVariant,
                      fontFamily: theme.typography.monoMedium,
                    },
                  ]}
                >
                  VERSION:
                </Text>
                <Text
                  style={[
                    styles.metaVal,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.monoBold,
                    },
                  ]}
                >
                  v{MOBILE_APP_VERSION}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.metaKey,
                    {
                      color: theme.colors.onSurfaceVariant,
                      fontFamily: theme.typography.monoMedium,
                    },
                  ]}
                >
                  ORGANIZATION:
                </Text>
                <Text
                  style={[
                    styles.metaVal,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.monoBold,
                    },
                  ]}
                >
                  NST-SDC
                </Text>
              </View>
            </View>

            {/* Official Links */}
            <View style={styles.linksContainer}>
              <Text
                style={[
                  styles.sectionLabel,
                  {
                    color: theme.colors.onSurfaceVariant,
                    fontFamily: theme.typography.monoBold,
                    marginBottom: 8,
                  },
                ]}
              >
                [ OFFICIAL LINKS ]
              </Text>

              <TouchableOpacity
                style={[
                  styles.linkButton,
                  {
                    borderColor: theme.colors.borderHairline,
                    backgroundColor: theme.colors.surfaceContainerLow,
                  },
                ]}
                onPress={() => handleOpenUrl(DEV_CLUB_GITHUB_URL)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.linkText,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.monoBold,
                    },
                  ]}
                >
                  NST-SDC ORG →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.linkButton,
                  {
                    borderColor: theme.colors.borderHairline,
                    backgroundColor: theme.colors.surfaceContainerLow,
                  },
                ]}
                onPress={() => handleOpenUrl(DEV_CLUB_CONTRIBUTORS_URL)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.linkText,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.monoBold,
                    },
                  ]}
                >
                  PROJECT CONTRIBUTORS →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.linkButton,
                  {
                    borderColor: theme.colors.borderHairline,
                    backgroundColor: theme.colors.surfaceContainerLow,
                  },
                ]}
                onPress={() => handleOpenUrl(DEV_CLUB_PROJECT_LEAD_URL)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.linkText,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.monoBold,
                    },
                  ]}
                >
                  PROJECT LEAD →
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View
            style={[
              styles.footerBar,
              {
                borderTopColor: theme.colors.borderHairline,
                backgroundColor: theme.colors.surfaceContainerLow,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.closeBtnText,
                  {
                    color: theme.colors.primary,
                    fontFamily: theme.typography.monoBold,
                  },
                ]}
              >
                [ CLOSE TERMINAL ]
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    borderWidth: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerTitle: {
    fontSize: 10,
    letterSpacing: 1,
  },
  closeText: {
    fontSize: 14,
    padding: 2,
  },
  content: {
    padding: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextColumn: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  institution: {
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sectionBox: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  metaKey: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  linksContainer: {
    marginBottom: 16,
  },
  linkButton: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  footerBar: {
    borderTopWidth: 1,
    padding: 12,
  },
  closeButton: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 11,
    letterSpacing: 1,
  },
});
