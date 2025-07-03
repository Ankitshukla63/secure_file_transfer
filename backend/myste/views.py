
import os
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.http import FileResponse, HttpResponseForbidden
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User, File
from .serializers import CustomTokenObtainPairSerializer, UserSignUpSerializer, FileUploadSerializer, FileListSerializer
from .permissions import IsOpsUser, IsClientUser
from django.utils import timezone
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from rest_framework import serializers

# Initialize serializer for secure URL generation
s = URLSafeTimedSerializer(settings.SECRET_KEY)

# --- Authentication Views ---

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

# --- Client User Actions ---

class ClientSignUpView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSignUpSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()
        token = s.dumps({'user_id': user.id, 'email': user.email}, salt='email-verify-salt')
        verification_link = f"http://127.0.0.1:5500/verify-email.html?token={token}"
        send_mail(
            'Verify your email for File Sharing',
            f'Please click on the following link to verify your email: {verification_link}',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        return Response({
            "message": "User registered successfully. Verification email sent. Please check your inbox.",
        }, status=status.HTTP_201_CREATED)

class EmailVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, format=None):
        token = request.query_params.get('token')
        if not token:
            return Response({"message": "Token is missing."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = s.loads(token, salt='email-verify-salt', max_age=3600)
            user = get_object_or_404(User, id=data['user_id'], email=data['email'])
            if not user.is_email_verified:
                user.is_email_verified = True
                user.save()
                return Response({"message": "Email verified successfully."}, status=status.HTTP_200_OK)
            else:
                return Response({"message": "Email already verified."}, status=status.HTTP_200_OK)
        except SignatureExpired:
            return Response({"message": "Verification link expired."}, status=status.HTTP_400_BAD_REQUEST)
        except BadTimeSignature:
            return Response({"message": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"message": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ClientListUploadedFilesView(generics.ListAPIView):
    serializer_class = FileListSerializer
    permission_classes = [IsAuthenticated, IsClientUser]

    def get_queryset(self):
        return File.objects.all().order_by('-uploaded_at')

class ClientDownloadFileRequestView(APIView):
    permission_classes = [IsAuthenticated, IsClientUser]

    def get(self, request, assignment_id, format=None):
        file_obj = get_object_or_404(File, id=assignment_id)
        payload = {
            'file_id': file_obj.id,
            'user_id': request.user.id,
            'timestamp': timezone.now().isoformat()
        }
        download_token = s.dumps(payload, salt='download-salt')
        download_link = f"http://127.0.0.1:8000/api/download-file/{download_token}/"

        return Response({
            "download-link": download_link,
            "message": "success"
        }, status=status.HTTP_200_OK)

# --- Ops User Actions ---

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
class OpsFileUploadView(generics.CreateAPIView):
    queryset = File.objects.all()
    serializer_class = FileUploadSerializer
    permission_classes = [IsAuthenticated, IsOpsUser]

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES['file']
        file_extension = os.path.splitext(uploaded_file.name)[1].lower()
        allowed_extensions = ['.pptx', '.docx', '.xlsx']

        if file_extension not in allowed_extensions:
            raise serializers.ValidationError("Only .pptx, .docx, and .xlsx files are allowed.")

        serializer.save(
            uploader=self.request.user,
            original_filename=uploaded_file.name,
            file_type=file_extension.lstrip('.')
        )

# --- General File Download View (Secure Token-Based Access) ---

class DownloadFileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, encrypted_token, format=None):
        try:
            payload = s.loads(encrypted_token, salt='download-salt', max_age=300)
            file_id = payload['file_id']
            user_id_from_token = payload['user_id']

            user = get_object_or_404(User, id=user_id_from_token)
            if user.user_type != 'client_user':
                return HttpResponseForbidden("Access Denied: Only client users can download.")

            file_obj = get_object_or_404(File, id=file_id)
            file_path = file_obj.file.path

            if os.path.exists(file_path):
                response = FileResponse(open(file_path, 'rb'))
                response['Content-Disposition'] = f'attachment; filename=\"{file_obj.original_filename}\"'
                return response
            else:
                return Response({"message": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)

        except SignatureExpired:
            return HttpResponseForbidden("Download link expired.")
        except BadTimeSignature:
            return HttpResponseForbidden("Invalid download link.")
        except Exception as e:
            return Response({"message": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

