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
  flatten: (style: any) => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean));
    }
    return style || {};
  },
  absoluteFill: {},
};

const nonDomProps = new Set([
  'activeOpacity',
  'contentContainerStyle',
  'showsVerticalScrollIndicator',
  'showsHorizontalScrollIndicator',
  'refreshControl',
  'accessibilityLabel',
  'accessibilityRole',
  'accessibilityState',
  'resizeMode',
  'numberOfLines',
  'transparent',
  'animationType',
  'onRequestClose',
  'ellipsizeMode',
]);

const cleanProps = (props: any) => {
  if (!props) return {};
  const { style, onPress, ...rest } = props;
  const cleaned: any = {};
  for (const [key, val] of Object.entries(rest)) {
    if (!nonDomProps.has(key)) {
      cleaned[key] = val;
    }
  }
  if (onPress) {
    cleaned.onClick = onPress;
  }
  return cleaned;
};

export const View = ({ children, ...props }: any) => React.createElement('div', cleanProps(props), children);
export const Text = ({ children, ...props }: any) => React.createElement('span', cleanProps(props), children);
export const SafeAreaView = ({ children, ...props }: any) => React.createElement('div', cleanProps(props), children);
export const StatusBar = () => null;
export const TouchableOpacity = ({ children, ...props }: any) => React.createElement('button', cleanProps(props), children);
export const Pressable = ({ children, ...props }: any) => React.createElement('button', cleanProps(props), children);
export const ActivityIndicator = () => null;
export const Modal = ({ children, visible, ...props }: any) => (visible ? React.createElement('div', cleanProps(props), children) : null);
export const RefreshControl = () => null;
export const ScrollView = ({ children, ...props }: any) => React.createElement('div', cleanProps(props), children);
export const FlatList = ({ data = [], renderItem, ListEmptyComponent, ListHeaderComponent, ...props }: any) => {
  return React.createElement('div', cleanProps(props), [
    ListHeaderComponent ? (typeof ListHeaderComponent === 'function' ? React.createElement(ListHeaderComponent, null) : ListHeaderComponent) : null,
    data.length === 0 && ListEmptyComponent ? (typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent, null) : ListEmptyComponent) : null,
    ...(data || []).map((item: any, index: number) => renderItem ? renderItem({ item, index }) : null),
  ]);
};
export const Image = (props: any) => React.createElement('img', cleanProps(props));
export const TextInput = (props: any) => React.createElement('input', cleanProps(props));
export const Linking = {
  openURL: async () => {},
  canOpenURL: async () => true,
};

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
  Pressable,
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  FlatList,
  Image,
  TextInput,
  Linking,
};
