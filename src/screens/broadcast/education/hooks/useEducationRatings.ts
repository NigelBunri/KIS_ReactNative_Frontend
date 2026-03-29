import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'education_course_ratings';

export default function useEducationRatings() {
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRatings(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setRating = useCallback(async (courseId: string, value: number) => {
    setRatings((prev) => {
      const next = { ...prev, [courseId]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const averageRating = useMemo(() => {
    const values = Object.values(ratings);
    if (!values.length) return 4;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return Math.round((sum / values.length) * 10) / 10;
  }, [ratings]);

  const getRating = useCallback(
    (courseId: string) => {
      return ratings[courseId] ?? 4;
    },
    [ratings],
  );

  return {
    ratings,
    averageRating,
    getRating,
    setRating,
  };
}
