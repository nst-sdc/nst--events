import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/store/theme-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
    customTabBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
      paddingTop: 8,
      paddingHorizontal: 8,
    },
    customTabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      marginHorizontal: 4,
      borderRadius: 0, // Sharp edge enforcement
    },
    customTabItemActive: {
      backgroundColor: theme.colors.surfaceContainerHigh,
    },
    customTabLabel: {
      fontFamily: theme.typography.monoBold,
      fontSize: 9,
      letterSpacing: 0.5,
      marginTop: 4,
      color: theme.colors.onSurfaceVariant,
    },
    customTabLabelActive: {
      color: theme.colors.primaryFixed,
    },
  }), [theme]);

  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }: any) => {
        const allowedRoutes = ['index', 'explore', 'activity', 'profile'];
        const visibleRoutes = state.routes.filter((r: any) => allowedRoutes.includes(r.name));

        return (
          <View style={[styles.customTabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {visibleRoutes.map((route: any) => {
              const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name as any);
                }
              };

              let iconName: any = 'help';
              let label = route.name;
              if (route.name === 'index') {
                iconName = 'home';
                label = 'HOME';
              } else if (route.name === 'explore') {
                iconName = 'explore';
                label = 'EXPLORE';
              } else if (route.name === 'activity') {
                iconName = 'confirmation-number';
                label = 'ACTIVITY';
              } else if (route.name === 'profile') {
                iconName = 'person';
                label = 'PROFILE';
              }

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  activeOpacity={0.8}
                  style={[
                    styles.customTabItem,
                    isFocused && styles.customTabItemActive,
                  ]}
                >
                  <MaterialIcons
                    name={iconName}
                    size={20}
                    color={isFocused ? theme.colors.primaryFixed : theme.colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.customTabLabel,
                      isFocused && styles.customTabLabelActive,
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
