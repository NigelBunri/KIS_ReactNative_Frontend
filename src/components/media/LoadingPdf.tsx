// src/components/media/LoadingPdf.tsx
//
// Drop-in wrapper around react-native-pdf's <Pdf> that shows a spinner
// while the document is still downloading/rendering (a signed S3 URL PDF
// can take a moment), instead of a blank panel with no feedback.

import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Pdf, { PdfProps } from 'react-native-pdf';
import { useKISTheme } from '@/theme/useTheme';

type Props = PdfProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

export default function LoadingPdf({
  containerStyle,
  onLoadComplete,
  onError,
  ...rest
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(true);

  return (
    <View style={[styles.container, containerStyle]}>
      <Pdf
        {...rest}
        style={[StyleSheet.absoluteFillObject, rest.style]}
        onLoadComplete={(numberOfPages, path, size, tableContents) => {
          setLoading(false);
          onLoadComplete?.(numberOfPages, path, size, tableContents);
        }}
        onError={(error) => {
          setLoading(false);
          onError?.(error);
        }}
      />
      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={palette.primaryStrong ?? palette.primary} />
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
