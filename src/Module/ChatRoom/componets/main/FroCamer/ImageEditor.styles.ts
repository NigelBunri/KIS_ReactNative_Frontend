// src/screens/chat/components/FroCamer/ImageEditor.styles.ts

import { StyleSheet } from 'react-native';
import { kisRadius } from '@/theme/constants';

export const editorStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  mediaWrapper: {
    flex: 1,
    borderRadius: kisRadius.lg,
    overflow: 'hidden',
  },
  mediaInner: {
    flex: 1,
    borderRadius: kisRadius.lg,
    overflow: 'hidden',
  },
  mediaContent: {
    flex: 1,
  },
  media: {
    width: '100%',
    height: '100%',
    borderRadius: kisRadius.lg,
  },
  brushSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  brushSizeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
    marginHorizontal: 4,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  toolButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: kisRadius.lg,
    borderWidth: 2,
    marginHorizontal: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: kisRadius.lg,
    borderWidth: 2,
    marginHorizontal: 4,
  },
  textControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: kisRadius.lg,
    borderWidth: 2,
    marginRight: 8,
  },
  textSizeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
    marginHorizontal: 2,
  },
  textStyleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
    marginHorizontal: 4,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginHorizontal: 4,
    borderWidth: 2,
  },
});
