import React from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import InsightScreen from './InsightScreen';
import type { RootStackParamList } from '@/navigation/types';

type AdminDashboardRouteProp = RouteProp<RootStackParamList, 'AdminDashboard'>;

export default function AdminDashboardScreen() {
  const route = useRoute<AdminDashboardRouteProp>();
  const { target = 'analytics', title = 'Dashboard' } = route.params ?? {};

  return (
    <InsightScreen
      target={target}
      title={title}
      description="System-level dashboard for backend analytics."
    />
  );
}
