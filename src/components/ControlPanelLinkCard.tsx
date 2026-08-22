import React from 'react';
import { Alert, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';

// Shown to Business Pro/Partner/Partner Pro tier holders (and separately,
// with isGo=true, to GO) as the "line in the app" they can copy to open
// the new web control panel on a computer instead of the phone — see
// ~/dev/website/app/control for the panel itself, and
// apps/accounts/tier_presets.py's "Web control panel access" feature_list
// entries for the matching tier-description copy.
export default function ControlPanelLinkCard({ isGo = false }: { isGo?: boolean }) {
  const { palette } = useKISTheme();
  const url = isGo ? 'kingdomimpactventures.org/control/admin' : 'kingdomimpactventures.org/control';

  const handleCopy = () => {
    Clipboard.setString(`https://${url}`);
    Alert.alert('Copied', 'Paste this link into a browser on your computer to open it there.');
  };

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        padding: 14,
        gap: 8,
      }}
    >
      <Text style={{ color: palette.text, fontWeight: '800' }}>
        {isGo ? 'Admin control panel' : 'Manage from a computer'}
      </Text>
      <Text style={{ color: palette.subtext, fontSize: 13 }}>
        {isGo
          ? 'Run platform admin — users, partners, and moderation — from a browser instead of your phone.'
          : 'Manage your shops, institutions, and partner organization from any browser instead of the app.'}
      </Text>
      <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 13 }}>{url}</Text>
      <KISButton title="Copy link" size="xs" variant="outline" onPress={handleCopy} />
    </View>
  );
}
