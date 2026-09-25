import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { resolveBackendAssetUrl } from '@/network';
import BroadcastAuthorProfileSheet from '@/components/broadcast/BroadcastAuthorProfileSheet';
import useAuthorProfilePreview from '@/components/broadcast/useAuthorProfilePreview';

type Broadcaster = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const CHIP_SIZE = 60;

// Replaces the old "Manage blocked users" row - a horizontal tray of
// everyone who's broadcasted (posted) content, most-recently-active
// first, so the Feeds tab surfaces who's around instead of a settings
// shortcut. Self-fetches (GET /api/v1/profiles/broadcasters/) and manages
// its own author-profile-preview sheet, so it's a single self-contained
// drop-in.
export default function BroadcastersRow() {
  const { palette } = useKISTheme();
  const [broadcasters, setBroadcasters] = useState<Broadcaster[]>([]);
  const {
    visible: authorProfileVisible,
    loading: authorProfileLoading,
    error: authorProfileError,
    profile: authorProfile,
    openAuthorProfile,
    closeAuthorProfile,
  } = useAuthorProfilePreview();

  useEffect(() => {
    let cancelled = false;
    getRequest(ROUTES.profiles.broadcasters, {
      errorMessage: 'Unable to load broadcasters.',
    })
      .then(res => {
        if (cancelled) return;
        const results = res?.data?.results;
        if (Array.isArray(results)) setBroadcasters(results);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (broadcasters.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16 }}
      >
        {broadcasters.map(broadcaster => {
          const avatarUri = resolveBackendAssetUrl(broadcaster.avatar_url ?? null);
          const name = (broadcaster.display_name ?? '').trim();
          return (
            <Pressable
              key={broadcaster.id}
              onPress={() => {
                void openAuthorProfile({
                  source_type: 'user',
                  author: {
                    id: broadcaster.id,
                    display_name: broadcaster.display_name ?? undefined,
                    avatar_url: broadcaster.avatar_url ?? undefined,
                  },
                });
              }}
              style={{ alignItems: 'center', width: CHIP_SIZE + 12 }}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{
                    width: CHIP_SIZE,
                    height: CHIP_SIZE,
                    borderRadius: CHIP_SIZE / 2,
                    backgroundColor: palette.bar,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: CHIP_SIZE,
                    height: CHIP_SIZE,
                    borderRadius: CHIP_SIZE / 2,
                    backgroundColor: palette.bar,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <KISIcon name="person" size={28} color={palette.subtext} />
                </View>
              )}
              {name ? (
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: '700',
                    color: palette.text,
                    maxWidth: CHIP_SIZE + 12,
                    textAlign: 'center',
                  }}
                >
                  {name}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <BroadcastAuthorProfileSheet
        visible={authorProfileVisible}
        loading={authorProfileLoading}
        error={authorProfileError}
        profile={authorProfile}
        onClose={closeAuthorProfile}
      />
    </View>
  );
}
