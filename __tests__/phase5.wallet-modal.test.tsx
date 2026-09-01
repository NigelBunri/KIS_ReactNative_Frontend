import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { WalletModal } from '../src/screens/tabs/profile-screen/WalletModal';

jest.mock('@/constants/KISButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockKISButton(props: any) {
    return (
      <Pressable
        testID={`kis-button-${props.title}`}
        onPress={props.onPress}
        disabled={props.disabled}
      >
        <Text>{props.title}</Text>
      </Pressable>
    );
  };
});

jest.mock('@/constants/KISTextInput', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return function MockKISTextInput(props: any) {
    return (
      <TextInput
        testID={`kis-input-${props.label}`}
        value={props.value}
        onChangeText={props.onChangeText}
      />
    );
  };
});

const palette: any = {
  subtext: '#667085',
  primarySoft: '#EEF4FF',
  surface: '#FFFFFF',
  divider: '#D0D5DD',
  text: '#101828',
  primaryStrong: '#175CD3',
  success: '#12B76A',
  danger: '#F04438',
};

describe('WalletModal promotional-credit safety copy', () => {
  test('renders read-only promotional-credit wording', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <WalletModal
          palette={palette}
          walletForm={{
            mode: 'history',
            amount: '',
            recipient: '',
            reference: '',
          }}
          setWalletForm={jest.fn()}
          saving={false}
        />,
      );
    });

    const texts = tree!.root.findAllByType(Text).map(node => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join('') : String(value);
    });
    // WalletModal no longer renders a wallet-specific safety disclaimer
    // itself (that copy now lives in AccountCreditsCard.tsx) — every mode
    // other than 'loyalty'/'invoices' collapses into the same generic
    // read-only card below, so this asserts on that current copy.
    expect(texts.some(value => value.includes('Read-only credit center'))).toBe(true);
    expect(
      texts.some(value =>
        value.includes('Promotional credits can only subsidize eligible KIS account upgrades'),
      ),
    ).toBe(true);
  });

  test('shows the same read-only credit center for legacy wallet modes', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <WalletModal
          palette={palette}
          walletForm={{
            mode: 'transfer',
            amount: '1',
            recipient: '699123456',
            reference: '',
          }}
          setWalletForm={jest.fn()}
          saving={false}
        />,
      );
    });

    const texts = tree!.root.findAllByType(Text).map(node => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join('') : String(value);
    });
    // 'transfer' isn't specially handled anymore — any mode other than
    // 'loyalty'/'invoices' falls into the same generic read-only card, so
    // there's no mode-specific "this action is unavailable" copy to find.
    expect(texts.some(value => value.includes('Read-only credit center'))).toBe(true);
  });
});
