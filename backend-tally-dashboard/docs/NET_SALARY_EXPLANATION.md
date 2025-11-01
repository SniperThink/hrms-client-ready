# Net Salary Calculation for Uploaded Excel Data

## Overview

When Excel files are uploaded for payroll data, the **NETT PAYABLE** field contains the final net salary that should be paid to the employee. This value is calculated in the Excel file and may include custom deductions, adjustments, and calculations specific to the organization.

## Key Points

### 1. **NETT PAYABLE is the Final Amount**
- The `NETT PAYABLE` field from Excel is the **final net salary** to be paid
- This includes all custom calculations, deductions, and adjustments made in Excel
- The system displays this value as-is without recalculating

### 2. **Excel Calculation Flow**
```
SALARY (Basic) → SL W/O OT → SAL+OT → [Custom Calculations] → NETT PAYABLE
```

### 3. **Why Net Salary Might Not Match Standard Formula**
The Excel data may include:
- **Custom overtime calculations** (different from standard OT rates)
- **Additional deductions** not shown in standard fields
- **Incentives or bonuses** included in final calculation
- **Company-specific adjustments** or rounding rules
- **Previous period adjustments** or carry-forwards

### 4. **Data Fields in Excel Template**
```
[NAME, SALARY, ABSENT, DAYS, SL W/O OT, OT, HOUR RS, CHARGES, LATE, CHARGE, AMT, SAL+OT, 25TH ADV, OLD ADV, NETT PAYABLE, Department, Total old ADV, Balnce Adv, INCENTIVE, TDS, SAL-TDS, ADVANCE]
```

### 5. **Display in Payroll Overview**
- **Gross Salary**: Shows `SAL+OT` field from Excel
- **Net Payable**: Shows `NETT PAYABLE` field from Excel (final amount)
- **Status**: Shows "UPLOADED" with purple color
- **Editable**: No (uploaded data is read-only)

## Examples from Analysis

### Employee ANIL:
- **Basic Salary**: ₹25,000
- **Gross Salary (SAL+OT)**: ₹25,000
- **Net Payable**: ₹18,500
- **Difference**: ₹6,500 (likely includes custom deductions not shown in standard fields)

### Employee AJIT KR PANDEY:
- **Basic Salary**: ₹18,000
- **Gross Salary (SAL+OT)**: ₹19,606.25 (includes custom OT calculation)
- **Net Payable**: ₹18,606.25
- **Difference**: ₹1,000 (custom deduction)

## System Behavior

### ✅ **Correct Behavior:**
- System displays `NETT PAYABLE` as the final net salary
- Uploaded data is marked as read-only
- Cache is cleared when new Excel is uploaded
- Data appears in payroll overview with "UPLOADED" status

### 🔧 **If Changes Are Needed:**
1. **Modify Excel file** with correct calculations
2. **Re-upload** the Excel file
3. **System will update** the payroll data automatically

## Conclusion

The net salary displayed in the payroll overview is **correct** - it represents the final calculated amount from the Excel file. If the amount seems incorrect, the issue is in the Excel calculations, not in the system display.

To fix incorrect net salaries:
1. Check the Excel file calculations
2. Update the Excel file with correct formulas
3. Re-upload the corrected Excel file
