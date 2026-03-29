import React from 'react';

const createComponent = (name: string) =>
  React.forwardRef<any, any>((props, ref) =>
    React.createElement(name, { ...props, ref }, props.children),
  );

class AnimatedValue {
  private current: number;
  constructor(value: number) {
    this.current = value;
  }
  setValue(next: number) {
    this.current = next;
  }
  __getValue() {
    return this.current;
  }
}

const noopAnimation = () => ({
  start: (callback?: () => void) => callback?.(),
});

const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T) => styles,
  flatten: <T>(style: T) => style,
  hairlineWidth: 1,
};

const Platform = {
  OS: 'ios',
  select: (options: Record<string, any>) => options?.ios ?? options?.default,
};

const Dimensions = {
  get: () => ({ width: 390, height: 844 }),
};

const Alert = {
  alert: jest.fn(),
};

const Linking = {
  openURL: jest.fn(() => Promise.resolve()),
};

const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

const PanResponder = {
  create: jest.fn(() => ({ panHandlers: {} })),
};

const Animated = {
  Value: AnimatedValue,
  timing: jest.fn(noopAnimation),
  spring: jest.fn(noopAnimation),
};

export const View = createComponent('View');
export const Text = createComponent('Text');
export const Pressable = createComponent('Pressable');
export const TextInput = createComponent('TextInput');
export const TouchableOpacity = createComponent('TouchableOpacity');
export const ActivityIndicator = createComponent('ActivityIndicator');
export const ScrollView = createComponent('ScrollView');
export const Image = createComponent('Image');
export const FlatList = createComponent('FlatList');
export const Modal = createComponent('Modal');
export const SafeAreaView = createComponent('SafeAreaView');
export const StatusBar = createComponent('StatusBar');
export const Switch = createComponent('Switch');

export const useColorScheme = () => 'light';
export const Easing = {
  linear: jest.fn(),
  ease: jest.fn(),
  inOut: jest.fn((fn: any) => fn),
};
export const PixelRatio = {
  get: () => 2,
  roundToNearestPixel: (value: number) => value,
};
export const I18nManager = { isRTL: false };
export const NativeModules = {};

export {
  Animated,
  Alert,
  Linking,
  Keyboard,
  PanResponder,
  Platform,
  Dimensions,
  StyleSheet,
};

const ReactNative = {
  View,
  Text,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  Switch,
  Animated,
  Alert,
  Linking,
  Keyboard,
  PanResponder,
  Platform,
  Dimensions,
  StyleSheet,
  useColorScheme,
  Easing,
  PixelRatio,
  I18nManager,
  NativeModules,
};

export default ReactNative;
