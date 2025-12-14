// Department Distribution Chart Component
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const screenWidth = Dimensions.get('window').width;

interface DepartmentChartProps {
  data?: {
    labels: string[];
    datasets: Array<{
      data: number[];
    }>;
  };
}

export default function DepartmentChart({ data }: DepartmentChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Default data if none provided
  const defaultData = {
    labels: ['IT', 'HR', 'Sales', 'Ops'],
    datasets: [{
      data: [25, 15, 30, 20]
    }]
  };

  const chartData = data || defaultData;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        Department Distribution
      </Text>
      <BarChart
        data={chartData}
        width={screenWidth - 32}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={{
          backgroundColor: colors.surface,
          backgroundGradientFrom: colors.surface,
          backgroundGradientTo: colors.surface,
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(11, 94, 89, ${opacity})`,
          labelColor: (opacity = 1) => colors.text,
          style: {
            borderRadius: 16,
          },
          barPercentage: 0.7,
        }}
        style={styles.chart}
        showValuesOnTopOfBars
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
