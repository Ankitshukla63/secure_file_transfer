from django.contrib import admin
from .models import User, File

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'email', 'user_type', 'is_email_verified', 'is_staff')
    list_filter = ('user_type', 'is_email_verified', 'is_staff')
    search_fields = ('username', 'email')
    ordering = ('id',)

@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ('id', 'original_filename', 'file_type', 'uploaded_at', 'uploader')
    list_filter = ('file_type', 'uploaded_at')
    search_fields = ('original_filename', 'uploader__username')
    ordering = ('-uploaded_at',)
