from django.db import models
from django.utils import timezone
from .tenant import TenantAwareModel
from .auth import CustomUser


class SupportTicket(TenantAwareModel):
    """Support ticket model for user support requests"""
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    subject = models.CharField(max_length=200, help_text="Ticket subject")
    description = models.TextField(help_text="Detailed description of the issue")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open',
        help_text="Current status of the ticket"
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='medium',
        help_text="Priority level of the ticket"
    )
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='support_tickets',
        help_text="User who created the ticket"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Optional fields for admin response
    admin_response = models.TextField(blank=True, null=True, help_text="Admin response to the ticket")
    resolved_at = models.DateTimeField(blank=True, null=True, help_text="When the ticket was resolved")
    resolved_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        related_name='resolved_tickets',
        blank=True,
        null=True,
        help_text="Admin who resolved the ticket"
    )
    
    class Meta:
        app_label = 'excel_data'
        db_table = 'support_tickets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['priority', '-created_at']),
            models.Index(fields=['created_by', '-created_at']),
        ]
    
    def __str__(self):
        return f"Ticket #{self.id}: {self.subject}"
    
    def mark_resolved(self, user, response=None):
        """Mark ticket as resolved"""
        self.status = 'resolved'
        self.resolved_at = timezone.now()
        self.resolved_by = user
        if response:
            self.admin_response = response
        self.save()
    
    def mark_closed(self):
        """Mark ticket as closed"""
        self.status = 'closed'
        self.save()


