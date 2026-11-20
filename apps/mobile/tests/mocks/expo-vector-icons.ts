import React from 'react';

const createIconMock = (name: string) => {
  const Component = (props: any) => React.createElement('Text', { ...props, 'data-icon': name }, props.name || '');
  Component.displayName = name;
  return Component;
};

export const MaterialIcons = createIconMock('MaterialIcons');
export const Ionicons = createIconMock('Ionicons');
export const FontAwesome = createIconMock('FontAwesome');
export const Feather = createIconMock('Feather');
export const AntDesign = createIconMock('AntDesign');
export const MaterialCommunityIcons = createIconMock('MaterialCommunityIcons');

export default {
  MaterialIcons,
  Ionicons,
  FontAwesome,
  Feather,
  AntDesign,
  MaterialCommunityIcons,
};
