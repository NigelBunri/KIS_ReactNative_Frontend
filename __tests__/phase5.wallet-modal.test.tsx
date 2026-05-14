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
    expect(
      texts.some(value => value.includes('cannot be bought, transferred, withdrawn, sold, or converted to cash')),
    ).toBe(true);
    expect(texts.some(value => value.includes('Read-only credit center'))).toBe(true);
  });

  test('explains legacy wallet actions are unavailable', () => {
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
    expect(texts.some(value => value.includes('This wallet action is unavailable'))).toBe(true);
  });
});
