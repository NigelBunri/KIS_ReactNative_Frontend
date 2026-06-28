import React, { useCallback } from 'react';
import { DeviceEventEmitter, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SearchScreen from './SearchScreen';
import type { RootStackParamList } from '@/navigation/types';
import type { HealthInstitutionType } from '@/screens/tabs/profile-screen/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GlobalSearchScreen() {
  const navigation = useNavigation<Nav>();

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleSelectResult = useCallback(
    (result: { kind: string; title?: string; target_id: string; target_type: string; route?: string; metadata?: Record<string, any> }) => {
      const kind = (result.kind ?? result.target_type ?? '').toLowerCase();
      const id = String(result.target_id ?? '');
      const meta = result.metadata ?? {};

      // Dismiss the search modal first
      if (navigation.canGoBack()) navigation.goBack();

      switch (kind) {
        case 'channel':
          navigation.navigate('ChannelHome', { channelId: id });
          break;

        case 'channel_content':
          navigation.navigate('ChannelContentDetail', { contentId: id });
          break;

        case 'content':
        case 'broadcast':
          navigation.navigate('BroadcastDetail', { id });
          break;

        case 'health_institution': {
          const instType = (meta.institution_type ?? meta.institutionType ?? 'clinic') as HealthInstitutionType;
          navigation.navigate('HealthInstitutionDetail', {
            institutionId: id,
            institutionType: instType,
            institutionName: String(meta.name ?? result.title ?? ''),
          });
          break;
        }

        case 'market_product':
        case 'product':
          navigation.navigate('ProductDetail', { productId: id });
          break;

        case 'market_shop':
        case 'shop':
          (navigation as any).navigate('MainTabs', { screen: 'Broadcast', params: { focusTab: 'market' } });
          break;

        case 'education_course':
        case 'education_institution':
          (navigation as any).navigate('MainTabs', { screen: 'Broadcast', params: { focusTab: 'education' } });
          break;

        case 'partner':
          (navigation as any).navigate('MainTabs', { screen: 'Partners' });
          break;

        case 'notification':
          navigation.navigate('ProfileNotifications');
          break;

        case 'profile':
          navigation.navigate('ViewProfile', {
            userId: id,
            displayName: String(meta.display_name ?? meta.name ?? result.title ?? ''),
          });
          break;

        case 'contact':
        case 'user':
          // Open a DM — use conversation ID from metadata if available, else open by user ID
          DeviceEventEmitter.emit('chat.open', {
            conversationId: meta.conversationId ?? meta.conversation_id ?? id,
            name: String(meta.display_name ?? meta.name ?? result.title ?? ''),
            kind: 'dm',
            userId: id,
          });
          break;

        case 'conversation':
          DeviceEventEmitter.emit('chat.open', {
            conversationId: id,
            name: String(meta.name ?? result.title ?? ''),
            kind: meta.kind ?? 'dm',
          });
          break;

        case 'group':
          DeviceEventEmitter.emit('chat.open', {
            conversationId: id,
            name: String(meta.name ?? result.title ?? ''),
            kind: 'channel',
          });
          break;

        case 'community':
          DeviceEventEmitter.emit('chat.open', {
            conversationId: id,
            name: String(meta.name ?? result.title ?? ''),
            kind: 'community',
            communityId: String(meta.communityId ?? meta.community_id ?? id),
          });
          break;

        case 'bible_verse':
          // Switch to Bible tab and emit verse navigation
          (navigation as any).navigate('MainTabs', { screen: 'Bible' });
          DeviceEventEmitter.emit('bible.verse.open', {
            verseId: id,
            reference: String(meta.reference ?? meta.verse_ref ?? result.title ?? id),
            book: meta.book,
            chapter: meta.chapter,
            verse: meta.verse,
          });
          break;

        case 'verification':
          // Navigate to the target's profile which shows their verification badge
          navigation.navigate('ViewProfile', {
            userId: id,
            displayName: String(meta.display_name ?? meta.name ?? result.title ?? ''),
          });
          break;

        default:
          // Graceful fallback: if the result has a conversation, open it as chat
          if (meta.conversationId || meta.conversation_id) {
            DeviceEventEmitter.emit('chat.open', {
              conversationId: meta.conversationId ?? meta.conversation_id,
              name: String(result.title ?? ''),
            });
          }
          break;
      }
    },
    [navigation],
  );

  return (
    <View style={{ flex: 1 }}>
      <SearchScreen onClose={handleClose} onSelectResult={handleSelectResult} />
    </View>
  );
}
