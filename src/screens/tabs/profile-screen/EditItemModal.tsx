import React from 'react';
import { Pressable, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import type { ItemType } from '../profile/profile.types';

type EditItemModalProps = {
  palette: KISPalette;
  draftItem: any;
  setDraftItem: React.Dispatch<React.SetStateAction<any>>;
  pickShowcaseFile?: (itemType: ItemType) => Promise<any>;
  saving: boolean;
  saveItem: () => void;
};

export function EditItemModal(props: EditItemModalProps) {
  const { palette, draftItem, setDraftItem, pickShowcaseFile, saving, saveItem } = props;
  const itemType = draftItem?.type as ItemType | undefined;
  const isPortfolioGalleryType = itemType === 'portfolio' || itemType === 'intro_video';

  return (
    <View style={{ gap: 12 }}>
      {!isPortfolioGalleryType ? (
        <KISTextInput
          label="Title / Name"
          value={draftItem?.data?.title || draftItem?.data?.name || ''}
          onChangeText={(t) =>
            setDraftItem((s: any) => {
              const next = s || { type: draftItem?.type, data: {} };
              const data = next?.data || {};
              return {
                ...next,
                data: {
                  ...data,
                  title: data?.title != null ? t : data?.title,
                  name: data?.name != null ? t : data?.name,
                },
              };
            })
          }
        />
      ) : null}

      {!isPortfolioGalleryType ? (
        <KISTextInput
          label="Description / Summary"
          value={draftItem?.data?.description || draftItem?.data?.summary || ''}
          onChangeText={(t) =>
            setDraftItem((s: any) => {
              const next = s || { type: draftItem?.type, data: {} };
              const data = next?.data || {};
              return {
                ...next,
                data: { ...data, description: t, summary: t },
              };
            })
          }
          multiline
          style={{ minHeight: 100 }}
        />
      ) : (
        <Text style={[styles.subtext, { color: palette.subtext }]}>
          Upload media directly. Title and description are optional for portfolio gallery.
        </Text>
      )}

      {typeof pickShowcaseFile === 'function' && (
        <Pressable
          onPress={async () => {
            const file = await pickShowcaseFile(draftItem?.type);
            if (file) {
              setDraftItem((s: any) => {
                const next = s || { type: draftItem?.type, data: {} };
                const data = next?.data || {};
                return { ...next, data: { ...data, file } };
              });
            }
          }}
          style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
        >
          <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
            {isPortfolioGalleryType ? 'Upload media' : 'Attach media (optional)'}
          </Text>
          {draftItem?.data?.file?.name ? (
            <Text style={[styles.subtext, { color: palette.subtext }]} numberOfLines={1}>
              {draftItem.data.file.name}
            </Text>
          ) : null}
        </Pressable>
      )}

      <KISButton title={saving ? 'Saving...' : 'Save'} onPress={saveItem} disabled={saving} />
    </View>
  );
}
