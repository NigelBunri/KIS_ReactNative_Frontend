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

  const originalCreateElement = React.createElement;
  const originalAlert = Alert.alert;

  React.createElement = ((type: any, props: any, ...children: any[]) => {
    const nextProps = localizeProps(props);
    const nextChildren = isTextLike(type) ? children.map(localizeNode) : children;
    return originalCreateElement(type, nextProps, ...nextChildren);
  }) as typeof React.createElement;

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
    // This keeps the module subscribed so patched closures always read the latest language state.
  });
};
