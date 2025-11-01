from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
import uuid
from datetime import timedelta

User = get_user_model()

class EmailVerification(models.Model):
    """
    Model to store email verification tokens
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verifications')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    is_used = models.BooleanField(default=False)
    
    # Token expiry (24 hours)
    EXPIRY_HOURS = 24
    
    class Meta:
        app_label = 'excel_data'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token'], name='verification_token_idx'),
            models.Index(fields=['user', 'is_used'], name='verification_user_idx'),
        ]
    
    def __str__(self):
        return f"Verification for {self.email} - {'Verified' if self.is_used else 'Pending'}"
    
    @property
    def is_expired(self):
        """Check if the verification token has expired"""
        expiry_time = self.created_at + timedelta(hours=self.EXPIRY_HOURS)
        return timezone.now() > expiry_time
    
    @property
    def is_valid(self):
        """Check if the token is valid (not used and not expired)"""
        return not self.is_used and not self.is_expired
    
    def mark_as_verified(self):
        """Mark the verification as completed"""
        self.is_used = True
        self.verified_at = timezone.now()
        self.save()
        
        # Mark user's email as verified
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified'])
    
    @classmethod
    def create_verification(cls, user, email=None):
        """Create a new verification token for a user"""
        if email is None:
            email = user.email
            
        # Invalidate any existing unused verifications for this user
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        
        # Create new verification
        return cls.objects.create(user=user, email=email)
