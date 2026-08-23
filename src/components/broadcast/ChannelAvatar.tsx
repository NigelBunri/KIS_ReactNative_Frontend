import React from 'react';
import { Image, Text, View } from 'react-native';
import { resolveBackendAssetUrl } from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';

// Shared display for any broadcast channel's avatar, driven entirely by
// the server-computed avatar_kind/avatar_display_url/avatar_initials
// fields (apps/broadcasts/serializers.py's _resolve_channel_avatar) —
// never the raw, freely-editable avatar_url. Consolidates what used to be
// three uncoordinated fallback implementations (ChannelHomePage,
// ChannelsDiscoverPage, and the KIS-logo-for-everyone fallback in
// BroadcastFeedCard/BroadcastAuthorProfileSheet).
export type ChannelAvatarInfo = {
  id?: string;
  handle?: string;
  avatar_kind?: 'logo' | 'photo' | 'initials';
  avatar_display_url?: string;
  avatar_initials?: string;
};

export default function ChannelAvatar({ channel, size }: { channel?: ChannelAvatarInfo | null; size: number }) {
  const { palette } = useKISTheme();
  const kind = channel?.avatar_kind || 'initials';
  const containerStyle = { width: size, height: size, borderRadius: size / 2 };

  if (kind === 'logo') {
    // Local bundled asset for GO's official mark — instant, never fails to
    // load, and doesn't depend on a network round trip for something that
    // never changes.
    return (
      <Image
        source={require('@/assets/logo-light.png')}
        style={[containerStyle, { backgroundColor: palette.surface }]}
        resizeMode="contain"
      />
    );
  }

  if (kind === 'photo' && channel?.avatar_display_url) {
    const url = resolveBackendAssetUrl(channel.avatar_display_url);
    return (
      <PermanentRemoteImage
        uri={url}
        domain="Broadcast"
        stableKey={`channel_avatar_${channel.id ?? channel.handle ?? url}_${url}`}
        containerStyle={containerStyle}
      />
    );
  }

  return (
    <View style={[containerStyle, { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft, borderWidth: 1, borderColor: palette.surface }]}>
      <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: Math.max(16, size * 0.28) }}>
        {channel?.avatar_initials || 'KC'}
      </Text>
    </View>
  );
}
