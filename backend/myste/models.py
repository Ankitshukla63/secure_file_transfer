from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    USER_TYPE_CHOICES = (
        ('ops_user', 'Operation User'),
        ('client_user', 'Client User'),
    )
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='client_user')
    is_email_verified = models.BooleanField(default=False)

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='myste_user_set',  # Unique related_name
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='myste_user_permissions_set',  # Unique related_name
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    def __str__(self):
        return self.username


class File(models.Model):
    uploader = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_files')
    file = models.FileField(upload_to='uploaded_files/')
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)  # e.g., 'pptx', 'docx', 'xlsx'
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_filename

