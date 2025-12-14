// Loading Skeleton Component
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export default function LoadingSkeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  style 
}: LoadingSkeletonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <LoadingSkeleton width={56} height={56} borderRadius={28} style={styles.avatar} />
      <View style={styles.listItemContent}>
        <LoadingSkeleton width="60%" height={18} style={styles.mb8} />
        <LoadingSkeleton width="40%" height={14} style={styles.mb8} />
        <LoadingSkeleton width="80%" height={14} />
      </View>
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <LoadingSkeleton width="100%" height={120} style={styles.mb12} />
      <LoadingSkeleton width="70%" height={18} style={styles.mb8} />
      <LoadingSkeleton width="50%" height={14} style={styles.mb8} />
      <LoadingSkeleton width="90%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  avatar: {
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  mb8: {
    marginBottom: 8,
  },
  mb12: {
    marginBottom: 12,
  },
});
