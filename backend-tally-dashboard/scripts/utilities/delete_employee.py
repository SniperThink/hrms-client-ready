import sys
import os

# Initialize Django without manage.py shell
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dashboard.settings")
try:
    import django
    django.setup()
except Exception as exc:
    print("Failed to initialize Django. Ensure virtualenv is active and settings are correct.")
    raise


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/utilities/delete_employee.py <EMPLOYEE_ID>")
        sys.exit(1)

    emp_id = sys.argv[1]

    # Lazy import after Django setup via manage.py run
    from excel_data.models.employee import EmployeeProfile
    from excel_data.models.leave import Leave
    from excel_data.models.salary import SalaryData
    from excel_data.models.payroll import CalculatedSalary
    from excel_data.models.attendance import Attendance, DailyAttendance

    total_deleted = 0

    # Delete related-by-employee_id records first (non-FK relations)
    deleted = SalaryData.objects.filter(employee_id=emp_id).delete()
    total_deleted += deleted[0]
    print(f"Deleted SalaryData: {deleted[0]}")

    deleted = CalculatedSalary.objects.filter(employee_id=emp_id).delete()
    total_deleted += deleted[0]
    print(f"Deleted CalculatedSalary: {deleted[0]}")

    deleted = Attendance.objects.filter(employee_id=emp_id).delete()
    total_deleted += deleted[0]
    print(f"Deleted Attendance: {deleted[0]}")

    deleted = DailyAttendance.objects.filter(employee_id=emp_id).delete()
    total_deleted += deleted[0]
    print(f"Deleted DailyAttendance: {deleted[0]}")

    # Delete FK-related Leave via EmployeeProfile link (CASCADE will also work if we delete employee later)
    deleted = Leave.objects.filter(employee__employee_id=emp_id).delete()
    total_deleted += deleted[0]
    print(f"Deleted Leave: {deleted[0]}")

    # Finally delete the EmployeeProfile
    deleted = EmployeeProfile.objects.filter(employee_id=emp_id).delete()
    total_deleted += deleted[0]
    print(f"Deleted EmployeeProfile: {deleted[0]}")

    print(f"Total rows deleted: {total_deleted}")


if __name__ == "__main__":
    main()


