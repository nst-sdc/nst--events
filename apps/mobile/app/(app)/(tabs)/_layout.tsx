import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/store/theme-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../../../src/lib/haptics';

export default function TabsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
    tabBarWrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: Math.max(insets.bottom, 12),
      height: 64,
      borderRadius: theme.radii['2xl'],
      backgroundColor: theme.colors.surfaceGlass,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 8,
      ...(Platform.OS === 'ios'
        ? {
            borderCurve: 'continuous' as const,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.08,
            shadowRadius: 12,
          }
        : {
            elevation: 8,
          }),
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
    },
    iconWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
    },
    activeDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.brandText,
      marginTop: 2,
    },
    inactiveDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'transparent',
      marginTop: 2,
    },
    tabLabel: {
      fontFamily: theme.typography.interMedium,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
      color: theme.colors.textMuted,
    },
    tabLabelActive: {
      fontFamily: theme.typography.interSemiBold,
      color: theme.colors.brandText,
    },
  }), [theme, insets]);

  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }: any) => {
        const allowedRoutes = ['index', 'explore', 'activity', 'profile'];
        const visibleRoutes = state.routes.filter((r: any) => allowedRoutes.includes(r.name));

        return (
          <View style={styles.tabBarWrapper}>
            {visibleRoutes.map((route: any) => {
              const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  void haptics.selection();
                  navigation.navigate(route.name as any);
                }
              };

              let iconName: keyof typeof MaterialIcons.glyphMap = 'help';
              let label = route.name;
              if (route.name === 'index') {
                iconName = 'home';
                label = 'Home';
              } else if (route.name === 'explore') {
                iconName = 'explore';
                label = 'Explore';
              } else if (route.name === 'activity') {
                iconName = 'confirmation-number';
                label = 'Tickets';
              } else if (route.name === 'profile') {
                iconName = 'person';
                label = 'Profile';
              }

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  activeOpacity={0.8}
                  style={styles.tabItem}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={`${label} tab`}
                >
                  <View style={styles.iconWrapper}>
                    <MaterialIcons
                      name={iconName}
                      size={22}
                      color={isFocused ? theme.colors.brandText : theme.colors.textMuted}
                    />
                    <View style={isFocused ? styles.activeDot : styles.inactiveDot} />
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      isFocused && styles.tabLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}
