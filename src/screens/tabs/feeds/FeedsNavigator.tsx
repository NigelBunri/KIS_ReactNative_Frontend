import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import FeedsListScreen from './FeedsListScreen';
import BroadcastDetailScreen from './BroadcastDetailScreen';
import { BroadcastItem } from '@/types/broadcast';

export type FeedsStackParamList = {
  FeedsList: undefined;
  BroadcastDetail: {
    id: string;
    item?: BroadcastItem;
    items?: BroadcastItem[];
    index?: number;
  };
};

const Stack = createNativeStackNavigator<FeedsStackParamList>();

export default function FeedsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedsList" component={FeedsListScreen} />
      <Stack.Screen name="BroadcastDetail" component={BroadcastDetailScreen} />
    </Stack.Navigator>
  );
}
