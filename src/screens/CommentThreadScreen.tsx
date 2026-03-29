import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, SafeAreaView, Text } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import CommentThreadPanel from '@/components/feeds/CommentThreadPanel';
import { postRequest } from '@/network/post';

type CommentThreadRouteParams = {
  CommentThreadScreen: {
    postId: string;
    headerLabel?: string;
    contextLabel?: string;
    placeholder?: string;
    initialConversationId?: string | null;
    commentRoomUrl?: string;
  };
};

export default function CommentThreadScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<CommentThreadRouteParams, 'CommentThreadScreen'>>();
  const {
    postId,
    headerLabel,
    contextLabel,
    placeholder,
    initialConversationId,
    commentRoomUrl,
  } = route.params;

  const [conversationId, setConversationId] = useState<string | null | undefined>(initialConversationId);

  const fetchConversationId = useCallback(async () => {
    if (!commentRoomUrl) return null;
    try {
      const res = await postRequest(commentRoomUrl, {}, { errorMessage: 'Unable to load conversation.' });
      const resolved =
        res?.data?.conversation_id ?? res?.data?.conversationId ?? res?.data?.id ?? null;
      setConversationId(resolved);
      return resolved;
    } catch (err) {
      console.warn('[CommentThreadScreen] fetch failed', err);
      setConversationId(null);
      return null;
    }
  }, [commentRoomUrl]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: palette.card }]}>
        <Pressable onPress={handleGoBack} hitSlop={10} style={styles.headerBack}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {headerLabel ?? 'Comments'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        <CommentThreadPanel
          postId={postId}
          initialConversationId={conversationId ?? null}
          fetchConversationId={commentRoomUrl ? fetchConversationId : undefined}
          onConversationResolved={(id) => setConversationId(id)}
          headerLabel={headerLabel ?? 'Comments'}
          contextLabel={contextLabel}
          placeholder={placeholder}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
});
