import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import CountryPicker from 'react-native-country-picker-modal';
import type { CountryCode, Country } from 'react-native-country-picker-modal';

type Props = {
  visible: boolean;
  countryCode: CountryCode;
  withFilter?: boolean;
  withCallingCode?: boolean;
  withFlag?: boolean;
  withEmoji?: boolean;
  withCountryNameButton?: boolean;
  onSelect: (country: Country) => void;
  onClose: () => void;
};

/**
 * Wraps react-native-country-picker-modal in our own Modal + SafeAreaProvider
 * so the picker respects the iOS notch/dynamic island on all devices.
 * The library's built-in Modal doesn't propagate the SafeAreaContext across
 * the native modal boundary, causing the header to be hidden behind the status bar.
 */
const SafeCountryPicker: React.FC<Props> = ({
  visible,
  countryCode,
  withFilter = true,
  withCallingCode = true,
  withFlag = true,
  withEmoji = true,
  withCountryNameButton = false,
  onSelect,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <CountryPicker
            visible
            withModal={false}
            countryCode={countryCode}
            withFilter={withFilter}
            withCallingCode={withCallingCode}
            withFlag={withFlag}
            withEmoji={withEmoji}
            withCountryNameButton={withCountryNameButton}
            onSelect={onSelect}
            onClose={onClose}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
});

export default SafeCountryPicker;
