import React from 'react';
import { View } from 'react-native';
import Skeleton from '@/components/common/Skeleton';

export default function InsightSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width="100%" height={120} radius={16} />
      <Skeleton width="100%" height={20} radius={12} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {Array.from({ length: 2 }).map((_, idx) => (
          <Skeleton key={idx} width="48%" height={80} radius={12} />
        ))}
      </View>
    </View>
  );
}
