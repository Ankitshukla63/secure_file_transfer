from rest_framework import serializers
from .models import User, File
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['user_type'] = user.user_type
        return token

class UserSignUpSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'user_type')

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            user_type='client_user'
        )

class FileUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = File
        fields = ('file',)

class FileListSerializer(serializers.ModelSerializer):
    uploader_username = serializers.CharField(source='uploader.username', read_only=True)

    class Meta:
        model = File
        fields = ('id', 'original_filename', 'file_type', 'uploaded_at', 'uploader_username')
