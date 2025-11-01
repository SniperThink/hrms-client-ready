from django.urls import include, path

# Modular url imports
from .routers import urlpatterns as router_urls
from .auth import urlpatterns as auth_urls
from .file_ops import urlpatterns as file_ops_urls
from .utils import urlpatterns as util_urls
from .payroll import urlpatterns as payroll_urls
from .sse import urlpatterns as sse_urls

urlpatterns = [
    path('', include((router_urls, 'excel_data'), namespace='api')),
    path('', include((auth_urls, 'excel_data'), namespace='auth')),
    path('', include((file_ops_urls, 'excel_data'), namespace='files')),
    path('', include((util_urls, 'excel_data'), namespace='utils')),
    path('', include((payroll_urls, 'excel_data'), namespace='payroll')),
    path('', include((sse_urls, 'excel_data'), namespace='sse')),
]
