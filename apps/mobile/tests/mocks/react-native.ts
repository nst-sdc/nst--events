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
  if (props.accessibilityRole) {
    cleaned.role = props.accessibilityRole;
  }
  if (props.accessibilityLabel) {
    cleaned['aria-label'] = props.accessibilityLabel;
  }
  if (props.accessibilityState) {
    if (props.accessibilityState.selected !== undefined) {
      cleaned['aria-selected'] = String(props.accessibilityState.selected);
    }
    if (props.accessibilityState.disabled !== undefined) {
      cleaned['aria-disabled'] = String(props.accessibilityState.disabled);
    }
  }
  if (props.hitSlop) {
    cleaned['data-hitslop'] = JSON.stringify(props.hitSlop);
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
export const Image = ({ source, ...props }: any) => {
  const src = typeof source === 'string' ? source : source?.uri;
  return React.createElement('img', { ...cleanProps(props), src, 'data-src': src });
};
export const TextInput = (props: any) => React.createElement('input', cleanProps(props));
export const Switch = ({ value, onValueChange, ...props }: any) =>
  React.createElement('input', {
    type: 'checkbox',
    checked: !!value,
    onChange: (e: any) => onValueChange && onValueChange(e.target.checked),
    ...cleanProps(props),
  });
export const KeyboardAvoidingView = ({ children, ...props }: any) => React.createElement('div', cleanProps(props), children);
export const Share = {
  share: async () => ({ action: 'sharedAction' }),
};
export const TouchableWithoutFeedback = ({ children, onPress, ...props }: any) =>
  React.createElement('div', { onClick: onPress, ...cleanProps(props) }, children);
export const Keyboard = {
  dismiss: () => {},
  addListener: () => ({ remove: () => {} }),
};
export const Linking = {
  openURL: async () => {},
  canOpenURL: async () => true,
};
export const Animated = {
  Value: class {
    _value: number;
    constructor(val: number) { this._value = val; }
    setValue(val: number) { this._value = val; }
  },
  timing: () => ({ start: (cb?: () => void) => cb && cb() }),
  spring: () => ({ start: (cb?: () => void) => cb && cb() }),
  View: ({ children, ...props }: any) => React.createElement('div', cleanProps(props), children),
};

export const PanResponder = {
  create: (config: any) => ({
    panHandlers: {},
    config,
  }),
};

export const NativeModules: Record<string, any> = {};

export default {
  Platform,
  NativeModules,
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
  Switch,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Share,
  Linking,
  Animated,
  PanResponder,
};
