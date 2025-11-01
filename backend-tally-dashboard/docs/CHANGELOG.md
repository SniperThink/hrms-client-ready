# Changelog

## [2025-10-07] - Codebase Organization

### 🏗️ Major Restructuring
- **Root Directory Cleanup**: Moved misplaced files from project root to organized directories
- **Data Organization**: Created dedicated `data/` directory structure
- **Script Organization**: Reorganized Python scripts into logical categories

### 📁 Directory Changes

#### New Structure
- `data/attendance/` - Attendance Excel templates and files
- `data/salary/` - Salary-related Excel files  
- `scripts/management/` - Employee and data management scripts
- `scripts/utilities/` - Data processing and upload utilities

#### File Moves
**Excel Files** (moved to `data/`):
- `APRL_2024_Attendance_Template.xlsx` → `data/attendance/`
- `APRL_2024_Attendance_Template_Actual.xlsx` → `data/attendance/`
- `APRL_2024_Attendance_Template_Detailed.xlsx` → `data/attendance/`
- `July_2022_Attendance.xlsx` → `data/attendance/`
- `attendance_template.xlsx` → `data/attendance/`
- `APRL_SAL_2024_salary.xlsx` → `data/salary/`

**Management Scripts** (moved to `scripts/management/`):
- `cleanup_duplicate_employees.py`
- `clear_payroll_cache.py`
- `create_missing_employees_from_attendance.py`

**Utility Scripts** (moved to `scripts/utilities/`):
- `upload_all_attendance.py`
- `upload_monthly_attendance.py`
- `upload_multiple_months.py`
- `check_attendance_data.py`
- `fix_attendance_working_days.py`

**Documentation** (moved to `docs/`):
- `NET_SALARY_EXPLANATION.md`

### 🔧 Technical Updates
- **Path Resolution**: Updated all scripts to use relative paths instead of hardcoded absolute paths
- **Django Setup**: Scripts now dynamically find project root regardless of execution location
- **Import Fixes**: Fixed import paths in all moved Python scripts

### 📋 Benefits
- **Cleaner Root**: Only essential Django files remain in project root
- **Better Organization**: Files grouped by function and type
- **Improved Maintainability**: Easier to locate and manage different types of files
- **Scalability**: Structure supports future growth and additional file types

### 🚨 Breaking Changes
- **Script Locations**: All utility scripts moved to new directories
- **File Paths**: Excel file references need to use new `data/` directory paths

### 🔄 Migration Notes
- Scripts maintain backward compatibility through dynamic path resolution
- No database changes required
- All functionality preserved with improved organization