// src/components/media/LoadingImage.tsx
//
// Drop-in <Image> replacement that shows a spinner over the placeholder
// background while the remote bytes are still loading (signed S3 URLs can
// take a moment), instead of a static blank/color placeholder with no
// feedback that anything is happening.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

type Props = ImageProps & {
  containerStyle?: StyleProp<ViewStyle>;
  spinnerColor?: string;
};

export default function LoadingImage({
  style,
  containerStyle,
  spinnerColor,
  source,
  onLoadStart,
  onLoad,
  onError,
  ...rest
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(true);

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        {...rest}
        source={source}
        style={[StyleSheet.absoluteFillObject, style]}
        onLoadStart={() => {
          setLoading(true);
          onLoadStart?.();
        }}
        onLoad={(e) => {
          setLoading(false);
          onLoad?.(e);
        }}
        onError={(e) => {
          setLoading(false);
          onError?.(e);
        }}
      />
      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={spinnerColor ?? palette.primaryStrong ?? palette.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
