// Employee Status Pie Chart Component
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const screenWidth = Dimensions.get('window').width;

interface EmployeeStatusChartProps {
  activeCount?: number;
  inactiveCount?: number;
}

export default function EmployeeStatusChart({ activeCount = 85, inactiveCount = 15 }: EmployeeStatusChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const data = [
    {
      name: 'Active',
      population: activeCount,
      color: colors.success,
      legendFontColor: colors.text,
      legendFontSize: 14,
    },
    {
      name: 'Inactive',
      population: inactiveCount,
      color: colors.error,
      legendFontColor: colors.text,
      legendFontSize: 14,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        Employee Status
      </Text>
      <PieChart
        data={data}
        width={screenWidth - 32}
        height={220}
        chartConfig={{
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
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
