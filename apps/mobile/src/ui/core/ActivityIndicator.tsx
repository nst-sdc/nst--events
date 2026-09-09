import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  Platform,
  ActivityIndicator as RNActivityIndicator,
  ActivityIndicatorProps,
} from 'react-native';
import { useAppTheme } from '../../store/theme-store';

const SPOKE_COUNT = 8;
const STEP_ANGLE = 45; // 360 / 8

// Clockwise opacities matching modern iOS UIActivityIndicatorView:
// Spoke 0 is leading (brightest 1.0), followed by decaying trail opacities
const OPACITIES = [1.0, 0.15, 0.18, 0.22, 0.3, 0.42, 0.58, 0.78];

// Pre-computed discrete 8-step keyframes matching UIKit UIActivityIndicatorView's 8 ticks per cycle
const STEPPED_INPUT_RANGE: number[] = [];
const STEPPED_OUTPUT_RANGE: string[] = [];
for (let i = 0; i < SPOKE_COUNT; i++) {
  STEPPED_INPUT_RANGE.push(i / SPOKE_COUNT);
  STEPPED_OUTPUT_RANGE.push(`${i * STEP_ANGLE}deg`);
  STEPPED_INPUT_RANGE.push((i + 1) / SPOKE_COUNT - 0.0001);
  STEPPED_OUTPUT_RANGE.push(`${i * STEP_ANGLE}deg`);
}
STEPPED_INPUT_RANGE.push(1);
STEPPED_OUTPUT_RANGE.push('360deg');

export function ActivityIndicator({
  size = 'small',
  color,
  animating = true,
  hidesWhenStopped = true,
  style,
  ...rest
}: ActivityIndicatorProps) {
  const theme = useAppTheme();
  const activeColor = color || theme.colors.primary;

  // On iOS, the native UIActivityIndicatorView is already the native iOS spinner
  if (Platform.OS === 'ios') {
    return (
      <RNActivityIndicator
        size={size}
        color={activeColor}
        animating={animating}
        hidesWhenStopped={hidesWhenStopped}
        style={style}
        {...rest}
      />
    );
  }

  // On Android (and others), render the exact modern iOS 8-spoke activity indicator
  if (!animating && hidesWhenStopped) {
    return null;
  }

  const dimension =
    typeof size === 'number' ? size : size === 'large' ? 36 : 20;

  const spokeWidth = Math.max(2, Math.round(dimension * 0.15));
  const spokeLength = Math.round(dimension * 0.3);
  const spokeRadius = spokeWidth / 2;

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animating) {
      spinAnim.stopAnimation();
      return;
    }

    const animation = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800, // 100ms per 45-degree tick, matching iOS UIKit
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animating, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: STEPPED_INPUT_RANGE,
    outputRange: STEPPED_OUTPUT_RANGE,
  });

  return (
    <View
      style={[
        {
          width: dimension,
          height: dimension,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      {...rest}
    >
      <Animated.View
        style={{
          width: dimension,
          height: dimension,
          transform: animating ? [{ rotate: spin }] : undefined,
        }}
      >
        {Array.from({ length: SPOKE_COUNT }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: dimension,
              height: dimension,
              alignItems: 'center',
              transform: [{ rotate: `${i * STEP_ANGLE}deg` }],
            }}
          >
            <View
              style={{
                width: spokeWidth,
                height: spokeLength,
                borderRadius: spokeRadius,
                backgroundColor: activeColor,
                opacity: OPACITIES[i],
              }}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
