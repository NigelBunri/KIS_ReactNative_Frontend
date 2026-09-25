import React, { useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import { resolveBackendAssetUrl } from '@/network';

type Broadcaster = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const CHIP_SIZE = 60;

type Props = {
  // Currently filtered-to poster, or null for no filter - lifted to
  // FeedsDiscoverPage since selecting a chip here filters the feed list
  // that lives there. name is passed alongside purely so the parent can
  // show a "Filtering by <name>" indicator without needing its own copy
  // of the broadcaster list.
  selectedId: string | null;
  onSelect: (id: string | null, name?: string | null) => void;
};

// Replaces the old "Manage blocked users" row - a horizontal tray of
// everyone who's broadcasted (posted) content, most-recently-active
// first, so the Feeds tab surfaces who's around instead of a settings
// shortcut. Self-fetches (GET /api/v1/profiles/broadcasters/) and its own
// block list (GET /api/v1/user-blocks/), so it's a single self-contained
// drop-in. Tapping a chip either toggles it as the active poster filter,
// or - if that poster is blocked - opens an unblock confirmation instead;
// a chip can't mean both at once, so blocked always wins.
export default function BroadcastersRow({ selectedId, onSelect }: Props) {
  const { palette } = useKISTheme();
  const [broadcasters, setBroadcasters] = useState<Broadcaster[]>([]);
  // Maps blocked user id -> the UserBlock row id (needed to DELETE it -
  // the block endpoint is keyed by the block row, not the blocked user).
  const [blockedMap, setBlockedMap] = useState<Record<string, string>>({});
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

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

  const loadBlocked = React.useCallback(() => {
    let cancelled = false;
    getRequest(ROUTES.moderation.userBlocks, {
      errorMessage: 'Unable to load blocked users.',
    })
      .then(res => {
        if (cancelled) return;
        const results = res?.data?.results ?? res?.data;
        if (Array.isArray(results)) {
          const map: Record<string, string> = {};
          results.forEach((row: any) => {
            const blockedId = String(row?.blocked ?? '').trim();
            const rowId = String(row?.id ?? '').trim();
            if (blockedId && rowId) map[blockedId] = rowId;
          });
          setBlockedMap(map);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadBlocked(), [loadBlocked]);

  const handleUnblock = (broadcaster: Broadcaster, blockRowId: string) => {
    const name = (broadcaster.display_name ?? '').trim() || 'this poster';
    Alert.alert(
      'Unblock poster',
      `Unblock ${name}? You'll be able to see their posts again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(broadcaster.id);
            try {
              const res = await deleteRequest(`${ROUTES.moderation.userBlocks}${blockRowId}/`, {
                errorMessage: 'Unable to unblock this poster.',
              });
              if (res?.success === false) {
                Alert.alert('Unblock', 'Unable to unblock this poster right now.');
                return;
              }
              setBlockedMap(prev => {
                const next = { ...prev };
                delete next[broadcaster.id];
                return next;
              });
              // useFeedsData listens for this and refetches, so the
              // now-unblocked poster's content reappears without the
              // user needing to pull-to-refresh themselves.
              DeviceEventEmitter.emit('broadcast.refresh');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ],
    );
  };

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
          const blockRowId = blockedMap[broadcaster.id];
          const isBlocked = Boolean(blockRowId);
          const isSelected = selectedId === broadcaster.id;

          return (
            <Pressable
              key={broadcaster.id}
              disabled={unblockingId === broadcaster.id}
              onPress={() => {
                if (isBlocked && blockRowId) {
                  handleUnblock(broadcaster, blockRowId);
                  return;
                }
                onSelect(isSelected ? null : broadcaster.id, isSelected ? null : name || null);
              }}
              style={{ alignItems: 'center', width: CHIP_SIZE + 12 }}
            >
              <View
                style={{
                  width: CHIP_SIZE,
                  height: CHIP_SIZE,
                  borderRadius: CHIP_SIZE / 2,
                  borderWidth: isSelected ? 3 : 1.5,
                  borderColor: palette.goldBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: palette.bar,
                      // No blur filter available without a native
                      // dependency (no blur library in this project) -
                      // simulated instead with a heavy opacity drop plus
                      // the dark scrim + icon overlay below.
                      opacity: isBlocked ? 0.25 : 1,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: palette.bar,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isBlocked ? 0.25 : 1,
                    }}
                  >
                    <KISIcon name="person" size={28} color={palette.subtext} />
                  </View>
                )}

                {isBlocked ? (
                  <View
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'rgba(0,0,0,0.35)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    pointerEvents="none"
                  >
                    <KISIcon name="eye-closed" size={22} color="#fff" />
                  </View>
                ) : null}
              </View>
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
    </View>
  );
}
