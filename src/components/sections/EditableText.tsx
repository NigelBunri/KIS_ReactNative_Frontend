import React from 'react';
import { Text, TextInput, TextStyle } from 'react-native';

type Props = {
  value: string;
  style?: TextStyle | TextStyle[];
  onChangeText?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
};

/** Renders plain <Text> when `onChangeText` is absent (every read-only
 * call site), or a style-matched <TextInput> when present (LiveSectionPreview's
 * inline-editing mode) — same component, same layout position, so switching
 * modes never shifts the text on screen. */
export default function EditableText({ value, style, onChangeText, placeholder, multiline }: Props) {
  if (!onChangeText) {
    return <Text style={style}>{value}</Text>;
  }
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={flatStyle?.color ? `${flatStyle.color}99` : undefined}
      multiline={multiline}
      style={[{ padding: 0, margin: 0, includeFontPadding: false }, style]}
    />
  );
}
