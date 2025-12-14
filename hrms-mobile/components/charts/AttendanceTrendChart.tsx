// Attendance Trend Chart Component
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const screenWidth = Dimensions.get('window').width;

interface AttendanceTrendChartProps {
  data?: {
    labels: string[];
    datasets: Array<{
      data: number[];
    }>;
  };
}

export default function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Default data if none provided
  const defaultData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      data: [85, 90, 88, 92, 87, 85, 0]
    }]
  };

  const chartData = data || defaultData;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        Attendance Trend (Last 7 Days)
      </Text>
      <LineChart
        data={chartData}
        width={screenWidth - 32}
        height={220}
        chartConfig={{
          backgroundColor: colors.primary,
          backgroundGradientFrom: colors.primary,
          backgroundGradientTo: colors.primary,
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '6',
            strokeWidth: '2',
            stroke: colors.accent,
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});
