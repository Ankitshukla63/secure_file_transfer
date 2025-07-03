from django.urls import path
from .views import (
    MyTokenObtainPairView, ClientSignUpView, EmailVerifyView,
    ClientListUploadedFilesView, ClientDownloadFileRequestView,
    OpsFileUploadView, DownloadFileView
)

urlpatterns = [
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('client/signup/', ClientSignUpView.as_view(), name='client-signup'),
    path('client/verify-email/', EmailVerifyView.as_view(), name='email-verify'),
    path('client/files/', ClientListUploadedFilesView.as_view(), name='client-file-list'),
    path('client/download-request/<int:assignment_id>/', ClientDownloadFileRequestView.as_view(), name='client-download-request'),
    path('ops/upload/', OpsFileUploadView.as_view(), name='ops-file-upload'),
    path('download-file/<str:encrypted_token>/', DownloadFileView.as_view(), name='download-file'),
]
