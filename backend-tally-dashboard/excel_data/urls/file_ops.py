from django.urls import path

from ..views import UploadSalaryDataAPIView, DownloadTemplateAPIView, EmployeeProfileViewSet
from ..views.utils import UploadAttendanceDataAPIView, DownloadAttendanceTemplateAPIView, UploadMonthlyAttendanceAPIView

urlpatterns = [
    path('upload-salary/', UploadSalaryDataAPIView.as_view(), name='upload-salary'),
    path('download-template/', DownloadTemplateAPIView.as_view(), name='download-template'),
    path('upload-attendance/', UploadAttendanceDataAPIView.as_view(), name='upload-attendance'),
    path('upload-monthly-attendance/', UploadMonthlyAttendanceAPIView.as_view(), name='upload-monthly-attendance'),
    path('download-attendance-template/', DownloadAttendanceTemplateAPIView.as_view(), name='download-attendance-template'),
    path('employees/bulk-upload/', EmployeeProfileViewSet.as_view({'post': 'bulk_upload'}), name='employee-bulk-upload'),
    path('employees/download-template/', EmployeeProfileViewSet.as_view({'get': 'download_template'}), name='employee-download-template'),
]
