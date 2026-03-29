import React from 'react';
import { View, Text, Image } from 'react-native';
import KISButton from '@/constants/KISButton';
import { getAttachmentPreviewInfo } from '@/components/broadcast/attachmentPreview';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';

type ManagementAttachmentsProps = {
  palette: KISPalette;
  attachments: any[];
  uploading: boolean;
  onAddAttachment: () => void;
};

export function ManagementAttachments(props: ManagementAttachmentsProps) {
  const { palette, attachments, uploading, onAddAttachment } = props;

  return (
    <View
      style={[
        styles.managementAttachments,
        { borderColor: palette.divider, backgroundColor: palette.card },
      ]}
    >
      <View style={styles.managementAssetRow}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>Attachments</Text>
        <KISButton
          title={uploading ? 'Uploading…' : 'Add attachment'}
          size="sm"
          variant="secondary"
          onPress={onAddAttachment}
          disabled={uploading}
        />
      </View>
      {attachments.length === 0 ? (
        <Text style={{ color: palette.subtext }}>No attachments yet.</Text>
      ) : (
        attachments.map((att, index) => {
          const preview = getAttachmentPreviewInfo(att);
          const key = `${preview.label}-${index}`;
          return (
            <View
              key={key}
              style={[
                styles.managementAssetItem,
                { borderColor: palette.divider, backgroundColor: palette.surface },
              ]}
            >
              {preview.previewUri ? (
                <Image
                  source={{ uri: preview.previewUri }}
                  style={styles.managementAssetImage}
                />
              ) : (
                <View
                  style={[
                    styles.managementAssetPlaceholder,
                    { borderColor: palette.divider, backgroundColor: palette.surface },
                  ]}
                >
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{preview.typeLabel}</Text>
                </View>
              )}
              <Text style={{ color: palette.text, fontWeight: '700' }}>{preview.label}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>{preview.typeLabel}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}
