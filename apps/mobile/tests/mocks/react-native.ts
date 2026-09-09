import React from 'react';

export const Platform = {
  OS: 'ios',
  select: (obj: Record<string, any>) => obj.ios ?? obj.default,
};

export const Appearance = {
  setColorScheme: () => {},
  getColorScheme: () => 'light',
  addChangeListener: () => ({ remove: () => {} }),
};

export const useColorScheme = () => 'dark';

export const StyleSheet = {
  create: (styles: any) => styles,
  absoluteFill: {},
};

export const View = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Text = ({ children, ...props }: any) => React.createElement('span', props, children);
export const SafeAreaView = ({ children, ...props }: any) => React.createElement('div', props, children);
export const StatusBar = () => null;
export const TouchableOpacity = ({ children, onPress, ...props }: any) => React.createElement('button', { onClick: onPress, ...props }, children);
export const ActivityIndicator = () => null;

export default {
  Platform,
  Appearance,
  useColorScheme,
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
};
