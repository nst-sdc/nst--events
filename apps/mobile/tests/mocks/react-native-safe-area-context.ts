import React from 'react';

export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 390, height: 844 });
export const SafeAreaProvider = ({ children }: any) => children;
export const SafeAreaConsumer = ({ children }: any) => children({ top: 0, bottom: 0, left: 0, right: 0 });
export const SafeAreaView = ({ children, ...props }: any) => React.createElement('div', props, children);

export default {
  useSafeAreaInsets,
  useSafeAreaFrame,
  SafeAreaProvider,
  SafeAreaConsumer,
  SafeAreaView,
};
