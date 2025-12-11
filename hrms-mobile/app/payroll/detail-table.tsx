import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { payrollService } from '@/services/payrollService';
import { CalculatedSalary } from '@/types';

export default function PayrollDetailTable() {
  const { periodId, label } = useLocalSearchParams<{ periodId?: string; label?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [loading, setLoading] = useState(true);
  const [salaries, setSalaries] = useState<CalculatedSalary[]>([]);

  useEffect(() => {
    // Lock to landscape on entry
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      // Restore to portrait on exit
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!periodId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const all: CalculatedSalary[] = [];
        let page = 1;
        // fetch all pages until no next or empty
        // guard to avoid runaway
        while (page <= 50) {
          const response = await payrollService.getCalculatedSalaries(Number(periodId), page);
          const list = response.results || [];
          all.push(...list);
          const hasNext = (response as any)?.next;
          if (!hasNext || list.length === 0) break;
          page += 1;
        }
        setSalaries(all);
      } catch (error) {
        console.error('Failed to load salaries for table view', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [periodId]);

  const headerCells = useMemo(
    () => [
      { label: 'Employee', key: 'employee_name', align: 'left', flex: 1.4, minWidth: 180 },
      { label: 'Emp ID', key: 'employee_id', align: 'left', flex: 1, minWidth: 120 },
      { label: 'Dept', key: 'department', align: 'left', flex: 1, minWidth: 120 },
      { label: 'Basic', key: 'basic_salary', align: 'right', flex: 1, minWidth: 120 },
      { label: 'Present', key: 'present_days', align: 'right', flex: 0.8, minWidth: 90 },
      { label: 'Absent', key: 'absent_days', align: 'right', flex: 0.8, minWidth: 90 },
      { label: 'OT Hrs', key: 'ot_hours', align: 'right', flex: 0.8, minWidth: 90 },
      { label: 'Late Min', key: 'late_minutes', align: 'right', flex: 0.9, minWidth: 100 },
      { label: 'Present Salary', key: 'salary_for_present_days', align: 'right', flex: 1.2, minWidth: 140 },
      { label: 'OT Charges', key: 'ot_charges', align: 'right', flex: 1, minWidth: 130 },
      { label: 'Late Deduction', key: 'late_deduction', align: 'right', flex: 1, minWidth: 130 },
      { label: 'Gross', key: 'gross_salary', align: 'right', flex: 1, minWidth: 130 },
      { label: 'Net', key: 'net_payable', align: 'right', flex: 1, minWidth: 130 },
      { label: 'TDS', key: 'tds_amount', align: 'right', flex: 1, minWidth: 120 },
      { label: 'Advance', key: 'advance_deduction_amount', align: 'right', flex: 1, minWidth: 120 },
      { label: 'Paid', key: 'is_paid', align: 'center', flex: 0.8, minWidth: 90 },
    ],
    []
  );

  const lockedColumns = useMemo(() => headerCells.slice(0, 2), [headerCells]);
  const scrollableColumns = useMemo(() => headerCells.slice(2), [headerCells]);

  const leftScrollRef = useRef<ScrollView | null>(null);
  const rightScrollRef = useRef<ScrollView | null>(null);
  const isSyncing = useRef(false);

  const syncScroll =
    (targetRef: React.RefObject<ScrollView>) =>
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      const y = event.nativeEvent.contentOffset.y;
      targetRef.current?.scrollTo({ y, animated: false });
      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { borderColor: colors.border }]}>
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            {label ? `${label} • Month View` : 'Payroll Month View'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            All employees for selected month
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.tablesContainer}>
          {/* Locked columns */}
          <View style={[styles.lockedPane, { borderColor: colors.border }]}>
            <ScrollView
              ref={leftScrollRef}
              showsVerticalScrollIndicator
              scrollEventThrottle={16}
              onScroll={syncScroll(rightScrollRef)}
              stickyHeaderIndices={[0]}
            >
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {lockedColumns.map((cell) => (
                  <Text
                    key={cell.key}
                    style={[
                      styles.headerCell,
                      {
                        color: colors.textSecondary,
                        textAlign: cell.align as any,
                        width: cell.minWidth,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {cell.label}
                  </Text>
                ))}
              </View>
              {salaries.map((row) => (
                <View key={row.id} style={[styles.tableRow, { borderColor: colors.border }]}>
                  {lockedColumns.map((cell) => (
                    <Text
                      key={cell.key}
                      style={[
                        styles.cell,
                        {
                          color: colors.text,
                          textAlign: cell.align as any,
                          width: cell.minWidth,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {(row as any)[cell.key] || '—'}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Scrollable columns */}
          <ScrollView horizontal style={styles.scrollablePaneWrapper} showsHorizontalScrollIndicator>
            <ScrollView
              ref={rightScrollRef}
              showsVerticalScrollIndicator
              scrollEventThrottle={16}
              onScroll={syncScroll(leftScrollRef)}
              stickyHeaderIndices={[0]}
            >
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {scrollableColumns.map((cell) => (
                  <Text
                    key={cell.key}
                    style={[
                      styles.headerCell,
                      {
                        color: colors.textSecondary,
                        textAlign: cell.align as any,
                        width: cell.minWidth,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {cell.label}
                  </Text>
                ))}
              </View>
              {salaries.map((row) => (
                <View key={row.id} style={[styles.tableRow, { borderColor: colors.border }]}>
                  {scrollableColumns.map((cell) => {
                    const value = (row as any)[cell.key];
                    let display: string = '';
                    if (cell.key === 'is_paid') {
                      display = value ? 'Paid' : 'Pending';
                    } else if (
                      ['gross_salary','net_payable','tds_amount','advance_deduction_amount','basic_salary','salary_for_present_days','ot_charges','late_deduction'].includes(cell.key)
                    ) {
                      const num = parseFloat(value?.toString() || '0');
                      display = `₹${num.toLocaleString('en-IN')}`;
                    } else if (['present_days','absent_days','ot_hours','late_minutes'].includes(cell.key)) {
                      const num = Number(value) || 0;
                      display = num.toString();
                    } else {
                      display = value || '—';
                    }

                    const color =
                      cell.key === 'net_payable'
                        ? colors.primary
                        : cell.key === 'tds_amount'
                          ? colors.error
                          : cell.key === 'advance_deduction_amount'
                            ? colors.warning
                            : cell.key === 'is_paid'
                              ? value ? colors.success : colors.warning
                              : colors.text;

                    return (
                      <Text
                        key={cell.key}
                        style={[
                          styles.cell,
                          {
                            color,
                            textAlign: cell.align as any,
                          width: cell.minWidth,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {display}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tablesContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  lockedPane: {
    width: 320,
    borderRightWidth: 1,
  },
  scrollablePaneWrapper: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  tableHeader: {
    paddingVertical: 10,
    borderBottomWidth: 1.25,
  },
  tableCellBase: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  cellWide: {
    flex: 1.4,
  },
});

