import React from 'react';
import { Alert, Text } from 'react-native';

import { localizeNode, localizeProps, subscribeToLanguageChange, translateString } from './index';

let installed = false;

const isTextLike = (type: any) => {
  if (type === Text) return true;
  const name = String(type?.displayName || type?.name || '');
  return name === 'Text' || name === 'KISText';
};

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
        const next = localizeProps(props);
        if (isTextLike(type) && next) {
          return orig(type, { ...next, children: localizeNode(next.children) }, key);
        }
        return orig(type, next, key);
      };
    }

    if (typeof jsxRuntime?.jsxs === 'function') {
      const orig = jsxRuntime.jsxs;
      jsxRuntime.jsxs = (type: any, props: any, key?: any) => {
        const next = localizeProps(props);
        if (isTextLike(type) && next) {
          return orig(type, { ...next, children: localizeNode(next.children) }, key);
        }
        return orig(type, next, key);
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
        const next = localizeProps(props);
        if (isTextLike(type) && next) {
          return orig(
            type,
            { ...next, children: localizeNode(next.children) },
            key,
            isStatic,
            source,
            self,
          );
        }
        return orig(type, next, key, isStatic, source, self);
      };
    }
  } catch {}

  // ─── React.createElement (kept for any explicit calls / class components) ────
  const originalCreateElement = React.createElement;
  React.createElement = ((type: any, props: any, ...children: any[]) => {
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

  subscribeToLanguageChange(() => {
    // Keeps this module subscribed so the patched closures always read the
    // latest activeLanguage on the next render pass.
  });
};
