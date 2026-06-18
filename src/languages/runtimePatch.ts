import React, { useSyncExternalStore } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { localizeNode, localizeProps, subscribeToLanguageChange, translateString } from './index';

let installed = false;
const nativeCreateElement = React.createElement.bind(React);

// ── Font scale (updated by AgeModeProvider when ageMode changes) ──────────────
let activeFontScale = 1;
let fontScaleVersion = 0;
const fontScaleListeners = new Set<() => void>();

export const setActiveFontScale = (scale: number) => {
  const normalized =
    Number.isFinite(scale) && scale > 0 ? Number(scale) : 1;
  if (normalized === activeFontScale) return;
  activeFontScale = normalized;
  fontScaleVersion += 1;
  fontScaleListeners.forEach(listener => listener());
};
export const getActiveFontScale = () => activeFontScale;

const applyFontScale = (props: any): any => {
  if (!props || activeFontScale === 1) return props;
  const flattened = StyleSheet.flatten(props.style);
  if (!flattened || typeof flattened.fontSize !== 'number') return props;
  return {
    ...props,
    style: {
      ...flattened,
      fontSize: Math.round(flattened.fontSize * activeFontScale),
      ...(typeof flattened.lineHeight === 'number'
        ? { lineHeight: Math.round(flattened.lineHeight * activeFontScale) }
        : {}),
    },
  };
};

const subscribeToFontScale = (listener: () => void) => {
  fontScaleListeners.add(listener);
  return () => fontScaleListeners.delete(listener);
};

const getFontScaleVersion = () => fontScaleVersion;

const RuntimeScaledText = (props: any) => {
  useSyncExternalStore(
    subscribeToFontScale,
    getFontScaleVersion,
    getFontScaleVersion,
  );
  return nativeCreateElement(Text, applyFontScale(props));
};

// ── isTextLike cache ─────────────────────────────────────────────────────────
// `isTextLike` is called for every JSX element (jsx/jsxs). A plain Map keyed
// by type reference avoids repeated String() coercion and string comparisons on
// each call. WeakMap would be ideal but component functions can be primitives
// (string tags like 'View') so we use a regular Map with a cap to prevent leaks.
const textLikeCache = new Map<any, boolean>();
const TEXT_LIKE_CACHE_MAX = 2000;

const isTextLike = (type: any): boolean => {
  const cached = textLikeCache.get(type);
  if (cached !== undefined) return cached;
  let result = false;
  if (type === Text) {
    result = true;
  } else {
    const name = String(type?.displayName || type?.name || '');
    result = name === 'Text' || name === 'KISText' || name === 'Animated.Text';
  }
  if (textLikeCache.size < TEXT_LIKE_CACHE_MAX) textLikeCache.set(type, result);
  return result;
};

// Clear both caches when language changes so stale translations aren't served.
subscribeToLanguageChange(() => {
  textLikeCache.clear();
});

export const installLocalizationRuntime = () => {
  if (installed) return;
  installed = true;

  // ─── react/jsx-runtime (PRIMARY patch for React 17+ / React 19) ─────────────
  // React 19 compiles ALL JSX to jsx()/jsxs() calls — React.createElement is
  // never invoked for JSX. We must patch these entry-points or the runtime
  // translation layer has zero effect.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsxRuntime = require('react/jsx-runtime') as any;

    if (typeof jsxRuntime?.jsx === 'function') {
      const orig = jsxRuntime.jsx;
      jsxRuntime.jsx = (type: any, props: any, key?: any) => {
        if (type === Text) {
          const next = localizeProps(props);
          return orig(
            RuntimeScaledText,
            next
              ? { ...next, children: localizeNode(next.children) }
              : props,
            key,
          );
        }
        if (!isTextLike(type)) {
          const next = localizeProps(props);
          return orig(type, next, key);
        }
        const next = localizeProps(props);
        if (next) {
          return orig(type, { ...next, children: localizeNode(next.children) }, key);
        }
        return orig(type, props, key);
      };
    }

    if (typeof jsxRuntime?.jsxs === 'function') {
      const orig = jsxRuntime.jsxs;
      jsxRuntime.jsxs = (type: any, props: any, key?: any) => {
        if (type === Text) {
          const next = localizeProps(props);
          return orig(
            RuntimeScaledText,
            next
              ? { ...next, children: localizeNode(next.children) }
              : props,
            key,
          );
        }
        if (!isTextLike(type)) {
          const next = localizeProps(props);
          return orig(type, next, key);
        }
        const next = localizeProps(props);
        if (next) {
          return orig(type, { ...next, children: localizeNode(next.children) }, key);
        }
        return orig(type, props, key);
      };
    }
  } catch {}

  // ─── react/jsx-dev-runtime (development builds) ─────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsxDev = require('react/jsx-dev-runtime') as any;
    if (typeof jsxDev?.jsxDEV === 'function') {
      const orig = jsxDev.jsxDEV;
      jsxDev.jsxDEV = (
        type: any,
        props: any,
        key?: any,
        isStatic?: any,
        source?: any,
        self?: any,
      ) => {
        if (type === Text) {
          const next = localizeProps(props);
          return orig(
            RuntimeScaledText,
            next
              ? { ...next, children: localizeNode(next.children) }
              : props,
            key,
            isStatic,
            source,
            self,
          );
        }
        if (!isTextLike(type)) {
          const next = localizeProps(props);
          return orig(type, next, key, isStatic, source, self);
        }
        const next = localizeProps(props);
        if (next) {
          return orig(
            type,
            { ...next, children: localizeNode(next.children) },
            key,
            isStatic,
            source,
            self,
          );
        }
        return orig(type, props, key, isStatic, source, self);
      };
    }
  } catch {}

  // ─── React.createElement (kept for any explicit calls / class components) ────
  const originalCreateElement = React.createElement;
  React.createElement = ((type: any, props: any, ...children: any[]) => {
    if (type === Text) {
      const nextProps = localizeProps(props);
      const nextChildren = children.map(localizeNode);
      return originalCreateElement(
        RuntimeScaledText,
        nextProps,
        ...nextChildren,
      );
    }
    const nextProps = localizeProps(props);
    const nextChildren = isTextLike(type) ? children.map(localizeNode) : children;
    return originalCreateElement(type, nextProps, ...nextChildren);
  }) as typeof React.createElement;

  // ─── Alert ──────────────────────────────────────────────────────────────────
  const originalAlert = Alert.alert;
  Alert.alert = ((title, message, buttons, options) =>
    originalAlert(
      typeof title === 'string' ? translateString(title) : title,
      typeof message === 'string' ? translateString(message) : message,
      buttons?.map((button) => ({
        ...button,
        text: typeof button.text === 'string' ? translateString(button.text) : button.text,
      })),
      options,
    )) as typeof Alert.alert;
};
