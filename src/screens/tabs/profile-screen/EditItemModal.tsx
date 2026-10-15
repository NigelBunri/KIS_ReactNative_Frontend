import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
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

// AND-476: Experience, Education, and Project all require start_date
// server-side (apps/accounts/models.py's Experience/Education/Project
// models each declare `start_date = models.DateField()`, with no
// null=True/blank=True) - but this form never had a field to enter one at
// all, so adding any of these three item types always failed to save.
// Each type's "currently in progress" flag uses a different field name
// server-side (currently_working for Experience, currently_studying for
// Education, no such flag for Project), so the toggle's target key has to
// switch per type rather than reusing one.
const DATE_ITEM_TYPES: ReadonlySet<ItemType> = new Set(['experience', 'education', 'project']);
const CURRENT_FLAG_KEY: Partial<Record<ItemType, string>> = {
  experience: 'currently_working',
  education: 'currently_studying',
};

export function EditItemModal(props: EditItemModalProps) {
  const { palette, draftItem, setDraftItem, pickShowcaseFile, saving, saveItem } = props;
  const itemType = draftItem?.type as ItemType | undefined;
  const isPortfolioGalleryType = itemType === 'portfolio' || itemType === 'intro_video';
  const showDateFields = !!itemType && DATE_ITEM_TYPES.has(itemType);
  const currentFlagKey = itemType ? CURRENT_FLAG_KEY[itemType] : undefined;
  const isCurrent = currentFlagKey ? !!draftItem?.data?.[currentFlagKey] : false;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={{ gap: 12 }}>
      {!isPortfolioGalleryType ? (
        <KISTextInput
          label="Title / Name"
          value={draftItem?.data?.title || draftItem?.data?.name || ''}
          onChangeText={(t) =>
            setDraftItem((s: any) => {
              const next = s || { type: draftItem?.type, data: {} };
              const data = next?.data || {};
              // Was `data?.title != null ? t : data?.title` — on a brand-new
              // item (Add Experience/Education/etc., where data starts as
              // {}) `data.title` is undefined on every keystroke, so this
              // condition was always false and kept assigning `undefined`
              // back to title/name — every character typed was discarded
              // immediately, which is why the field looked like it
              // "cleared itself." Editing an *existing* item worked because
              // its title was already non-null before the user typed
              // anything. This field is a single shared "Title / Name"
              // input for several item types, so both keys are written
              // unconditionally — whichever one the item type actually
              // uses picks up the value.
              return {
                ...next,
                data: { ...data, title: t, name: t },
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

      {showDateFields && (
        <>
          <KISTextInput
            label="Start date (YYYY-MM-DD) *"
            value={draftItem?.data?.start_date || ''}
            placeholder="2024-01-15"
            onChangeText={(t) =>
              setDraftItem((s: any) => {
                const next = s || { type: draftItem?.type, data: {} };
                const data = next?.data || {};
                return { ...next, data: { ...data, start_date: t } };
              })
            }
          />
          {!isCurrent && (
            <KISTextInput
              label="End date (YYYY-MM-DD)"
              value={draftItem?.data?.end_date || ''}
              placeholder="Optional"
              onChangeText={(t) =>
                setDraftItem((s: any) => {
                  const next = s || { type: draftItem?.type, data: {} };
                  const data = next?.data || {};
                  return { ...next, data: { ...data, end_date: t } };
                })
              }
            />
          )}
          {currentFlagKey && (
            <Pressable
              onPress={() =>
                setDraftItem((s: any) => {
                  const next = s || { type: draftItem?.type, data: {} };
                  const data = next?.data || {};
                  const nextVal = !data[currentFlagKey];
                  return {
                    ...next,
                    // Clearing end_date when switching to "currently in
                    // progress" - an end date left over from before the
                    // toggle was checked would otherwise still be sent
                    // alongside it.
                    data: { ...data, [currentFlagKey]: nextVal, end_date: nextVal ? null : data.end_date },
                  };
                })
              }
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: palette.primary,
                  backgroundColor: isCurrent ? palette.primary : 'transparent',
                }}
              />
              <Text style={{ color: palette.text }}>
                {itemType === 'education' ? 'I currently study here' : 'I currently work here'}
              </Text>
            </Pressable>
          )}
        </>
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

      <KISButton title={saving ? 'Saving...' : 'Save'}
      loading={saving} onPress={saveItem} disabled={saving} />
    </View>
    </KeyboardAvoidingView>
  );
}
