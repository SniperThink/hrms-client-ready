# auth.py
# Contains authentication, user management, and invitation flows:
# - SystemUserRegistrationView
# - SystemUserLoginView
# - SystemUserProfileView
# - LogoutView
# - ForceLogoutView
# - UserManagementViewSet
# - TenantSignupView
# - PublicTenantLoginView
# - VerifyEmailView
# - ResendVerificationView
# - CheckVerificationStatusView
# - UserInvitationViewSet
# - EnhancedInvitationView
# - AcceptInvitationView
# - RequestPasswordResetView
# - VerifyOTPView
# - ResetPasswordView
# - ChangePasswordView
# - ValidateInvitationTokenView
# - CleanupTokensView
# - DeleteAccountView


import logging
import uuid

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.shortcuts import render
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import EmailVerification
from ..models import CustomUser, Tenant, UserPermissions
from ..serializers import (
    CustomUserSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)

# Initialize logger
logger = logging.getLogger(__name__)



class SystemUserRegistrationView(generics.CreateAPIView):

    permission_classes = (AllowAny,)

    serializer_class = UserRegistrationSerializer

    def post(self, request, *args, **kwargs):

        # Get tenant from request

        tenant = getattr(request, "tenant", None)

        if not tenant:

            return Response(
                {"error": "No tenant found"}, status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():

            user = serializer.save(tenant=tenant)

            return Response(
                {"message": "User created successfully"}, status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SystemUserLoginView(APIView):
    """
    System user login with single-session enforcement
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        from ..utils.session_manager import SessionManager

        # Check if user is already authenticated in current session
        is_authenticated, current_user, error_response = (
            SessionManager.check_current_authentication(request)
        )
        if is_authenticated:
            return error_response

        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")
        tenant = getattr(request, "tenant", None)

        if not email or not password:
            return Response({"error": "Email and password required"}, status=400)

        if not tenant:
            return Response({"error": "No tenant found"}, status=400)

        # Find user within tenant
        try:
            user = CustomUser.objects.get(email=email, tenant=tenant)
        except CustomUser.DoesNotExist:
            return Response({"error": "Invalid credentials"}, status=401)

        if not user.check_password(password):
            return Response({"error": "Invalid credentials"}, status=401)

        # Check if email is verified (only required for admin users, not invited users)
        if not user.email_verified and not user.is_invited:
            return Response(
                {
                    "error": "Email not verified. Please check your email and click the verification link to activate your account.",
                    "email_verified": False,
                    "email": user.email,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if tenant is active
        if not user.tenant.is_active:
            return Response(
                {"error": "Company account is suspended. Please contact support."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if tenant has credits
        if user.tenant.credits <= 0:
            return Response(
                {
                    "error": "Company account has no credits. Please contact support to add credits to your account.",
                    "no_credits": True,
                    "credits": user.tenant.credits,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check for existing active session
        has_session, should_deny, message = SessionManager.check_existing_session(user, request)
        if should_deny:
            return Response(
                {"error": message, "already_logged_in": True},
                status=status.HTTP_409_CONFLICT,
            )

        # Check if user must change password
        if hasattr(user, "must_change_password") and user.must_change_password:
            return Response(
                {
                    "message": "Password change required",
                    "must_change_password": True,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": f"{user.first_name} {user.last_name}".strip(),
                        "role": user.role,
                    },
                    "tenant": {
                        "id": user.tenant.id,
                        "name": user.tenant.name,
                        "subdomain": user.tenant.subdomain,
                    },
                },
                status=status.HTTP_200_OK,
            )

        # Create new session
        session_key = SessionManager.create_new_session(user, request)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Login successful",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "session_key": session_key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": f"{user.first_name} {user.last_name}".strip(),
                    "role": user.role,
                    "is_hr": getattr(user, "is_hr", False),
                    "is_tenant_admin": getattr(user, "is_tenant_admin", False),
                },
                "tenant": {
                    "id": user.tenant.id,
                    "name": user.tenant.name,
                    "subdomain": user.tenant.subdomain,
                },
            },
            status=status.HTTP_200_OK,
        )


class SystemUserProfileView(generics.RetrieveUpdateAPIView):

    permission_classes = (IsAuthenticated,)

    serializer_class = UserSerializer

    def get_object(self):

        return self.request.user


class LogoutView(APIView):
    """
    Logout view that clears user session and invalidates tokens
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..utils.session_manager import SessionManager

        try:
            user = request.user

            # Clear user session
            SessionManager.clear_user_session(user, request)

            # Try to blacklist the refresh token if provided
            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                try:
                    from rest_framework_simplejwt.tokens import RefreshToken

                    token = RefreshToken(refresh_token)
                    token.blacklist()
                except Exception as e:
                    # Token might already be invalid, log but continue
                    logger.warning(
                        f"Could not blacklist refresh token for user {user.email}: {e}"
                    )

            return Response(
                {"message": "Logged out successfully"}, status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(
                f"Logout error for user {request.user.email if request.user.is_authenticated else 'unknown'}: {e}"
            )
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Logout error: {str(e)}", exc_info=True)
            return Response(
                {"error": "Logout failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ForceLogoutView(APIView):
    """
    Force logout from all devices - clears session using only email
    Safer approach that doesn't require password transmission
    """

    permission_classes = [AllowAny]

    def post(self, request):
        from ..utils.session_manager import SessionManager

        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"error": "Email address is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Check if user is active
        if not user.is_active:
            return Response(
                {"error": "User account is deactivated"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Force clear all sessions for this user
        SessionManager.clear_user_session(user)

        from django.utils import timezone

        return Response(
            {
                "message": f"All sessions for {email} have been cleared. You can now login from this device.",
                "email": email,
                "cleared_at": timezone.now().isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class AdminForceLogoutView(APIView):
    """
    Admin force logout - allows admins to force logout other users
    Requires authentication and admin/hr_manager role
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..utils.session_manager import SessionManager

        # Check if user has admin or hr_manager role
        if request.user.role not in ["admin", "hr_manager"]:
            return Response(
                {
                    "error": "Insufficient permissions. Admin or HR Manager role required."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        target_email = request.data.get("email", "").strip().lower()

        if not target_email:
            return Response(
                {"error": "Email address is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Find target user within the same tenant
            target_user = CustomUser.objects.get(
                email=target_email, tenant=request.user.tenant
            )
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User not found in your organization"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if target user is active
        if not target_user.is_active:
            return Response(
                {"error": "Target user account is deactivated"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent admins from force logging out other admins (unless they're superuser)
        if (
            target_user.role == "admin"
            and request.user.role == "admin"
            and not request.user.is_superuser
        ):
            return Response(
                {"error": "Cannot force logout other administrators"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Force clear all sessions for the target user
        SessionManager.clear_user_session(target_user)

        from django.utils import timezone

        return Response(
            {
                "message": f"All sessions for {target_email} have been cleared by admin.",
                "target_email": target_email,
                "cleared_by": request.user.email,
                "cleared_at": timezone.now().isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class UserManagementViewSet(viewsets.ModelViewSet):
    """

    ViewSet for managing users within a tenant. Only accessible by tenant admins.

    """

    serializer_class = UserSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        # Only show users from current tenant

        tenant = getattr(self.request, "tenant", None)

        if tenant:

            return CustomUser.objects.filter(tenant=tenant).order_by("-date_joined")

        return CustomUser.objects.none()

    @action(detail=True, methods=["patch"])
    def update_permissions(self, request, pk=None):
        user = self.get_object()
        is_hr = request.data.get("is_hr", user.is_hr)
        is_tenant_admin = request.data.get("is_tenant_admin", user.is_tenant_admin)
        user.is_hr = is_hr
        user.is_tenant_admin = is_tenant_admin
        user.save()
        return Response({"message": "User permissions updated successfully"})

    @action(detail=True, methods=["delete"])
    def deactivate(self, request, pk=None):
        """Delete a user permanently"""
        user = self.get_object()

        # Prevent users from deleting themselves
        if user.id == request.user.id:
            return Response(
                {"error": "You cannot delete your own account"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Store user info before deletion
        user_email = user.email
        user_name = f"{user.first_name} {user.last_name}".strip()

        # Delete the user (this will cascade delete related objects)
        user.delete()

        return Response(
            {"message": f"User {user_name} ({user_email}) has been permanently deleted"}
        )

    @action(detail=True, methods=["patch"])
    def permissions(self, request, pk=None):
        """Update user permissions"""
        user = self.get_object()

        # Create permissions object if it doesn't exist
        if not user.permissions:
            from ..models import UserPermissions

            user.permissions = UserPermissions.objects.create()
            user.save()

        permissions_data = request.data.get("permissions", {})

        # Update user role if provided
        role = request.data.get("role")
        if role:
            # VALIDATION: Only 1 HR Manager and 1 Admin allowed per tenant
            # Only check if role is changing to hr_manager or admin
            if role in ["hr_manager", "admin"] and user.role != role:
                tenant = user.tenant
                
                if role == "hr_manager":
                    existing_hr_count = CustomUser.objects.filter(
                        tenant=tenant,
                        role="hr_manager"
                    ).exclude(id=user.id).count()  # Exclude current user
                    if existing_hr_count >= 1:
                        return Response(
                            {"error": "Only one HR Manager is allowed per organization. An HR Manager already exists."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                
                elif role == "admin":
                    existing_admin_count = CustomUser.objects.filter(
                        tenant=tenant,
                        role="admin"
                    ).exclude(id=user.id).count()  # Exclude current user
                    if existing_admin_count >= 1:
                        return Response(
                            {"error": "Only one Admin is allowed per organization. An Admin already exists."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
            
            user.role = role
            user.save()

        # Update permissions
        for key, value in permissions_data.items():
            if hasattr(user.permissions, key):
                setattr(user.permissions, key, value)

        user.permissions.save()

        # Return updated user data
        from serializers import CustomUserSerializer

        serializer = CustomUserSerializer(user)
        return Response(
            {"message": "Permissions updated successfully", "user": serializer.data}
        )


class TenantSignupView(APIView):
    """

    Self-service tenant signup - Users can create their own tenant/company

    """

    permission_classes = (AllowAny,)

    def post(self, request):

        try:

            # Parse JSON data properly

            if hasattr(request, "data"):

                # DRF parsed data

                data = request.data

            else:

                # Raw request, parse JSON manually

                import json

                data = json.loads(request.body.decode("utf-8"))

            # Get signup data
            import re  # Import re module at the top

            company_name = data.get("company_name", "").strip()

            subdomain = data.get("subdomain", "").strip().lower()
            # Generate subdomain from company name if not provided
            if not subdomain:
                subdomain = company_name.lower().replace(" ", "-").replace("_", "-")
                # Remove special characters and ensure uniqueness
                subdomain = re.sub(r"[^a-z0-9-]", "", subdomain)
                if not subdomain:
                    subdomain = f"company-{Tenant.objects.count() + 1}"

            admin_email = data.get("email", "").strip().lower()

            first_name = data.get("first_name", "").strip()

            last_name = data.get("last_name", "").strip()

            # Validation (password will be auto-generated)

            if not all([company_name, admin_email]):

                return Response(
                    {"error": "All fields are required: company_name, email"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate subdomain format (alphanumeric and dash only) - only if subdomain is provided
            if subdomain and not re.match(r"^[a-z0-9-]+$", subdomain):
                return Response(
                    {
                        "error": "Subdomain can only contain lowercase letters, numbers, and dashes"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if subdomain is already taken - only if subdomain is provided
            if subdomain and Tenant.objects.filter(subdomain=subdomain).exists():
                # Try to make it unique by appending a number
                counter = 1
                original_subdomain = subdomain
                while Tenant.objects.filter(subdomain=subdomain).exists():
                    subdomain = f"{original_subdomain}-{counter}"
                    counter += 1
                    if counter > 100:  # Prevent infinite loop
                        subdomain = f"company-{Tenant.objects.count() + 1}"
                        break

            # Check if email is already used

            if CustomUser.objects.filter(email=admin_email).exists():

                return Response(
                    {
                        "error": "This email is already registered. Please use a different email."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Create tenant

            tenant = Tenant.objects.create(
                name=company_name, subdomain=subdomain, is_active=True
            )

            # Generate a secure temporary password (similar to HR invitations)
            import secrets
            import string
            temp_password = "".join(
                secrets.choice(string.ascii_letters + string.digits) for _ in range(12)
            )

            # Create admin user for the tenant with HR-like verification
            # Email is pre-verified (like HR invitations) and must change password on first login
            try:
                admin_user = CustomUser.objects.create_user(
                    username=admin_email,
                    email=admin_email,
                    password=temp_password,
                    first_name=first_name,
                    last_name=last_name,
                    tenant=tenant,
                    role="admin",
                    is_active=True,
                    email_verified=True,  # Pre-verified like HR invitations
                    must_change_password=True,  # Flag to force password change on first login
                )

                # Send email with credentials (like HR invitations)
                from ..services.zeptomail_service import send_email_via_zeptomail
                from django.conf import settings
                
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://35.154.9.249')
                subject = f"Welcome to SniperThink - Your Account Details"

                message = f"""
Dear {first_name} {last_name},

Your company account has been created successfully on {tenant.name}'s HR management system.

Your login credentials are:

Email: {admin_email}
Temporary Password: {temp_password}

IMPORTANT: You will be required to change your password when you first log in.

Please log in at: {frontend_url}/login

If you have any questions, please contact support.

Best regards,
The SniperThink Team
                """.strip()

                try:
                    send_email_via_zeptomail(
                    to_email=admin_email,
                    subject=subject,
                    text_body=message
                )
                    email_sent = True
                except Exception as email_error:
                    logger.error(f"Failed to send credentials email to {admin_email}: {email_error}")
                    email_sent = False

                if email_sent:
                    return Response(
                        {
                            "message": f"Company and admin account created successfully! Credentials have been sent to {admin_email}",  # Include for manual sharing if email fails
                        },
                        status=status.HTTP_201_CREATED,
                    )
                else:
                    return Response(
                        {
                            "message": f"Company and admin account created successfully but email sending failed. Please contact administrator to get the credentials.",
                        },
                        status=status.HTTP_201_CREATED,
                    )

            except Exception as user_error:
                # Rollback tenant creation if user creation fails
                tenant.delete()
                # SECURITY: Don't expose internal error details to client
                logger.error(f"Failed to create admin user: {str(user_error)}", exc_info=True)
                return Response(
                    {"error": "Failed to create admin user. Please try again or contact support."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Failed to create company: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to create company. Please try again or contact support."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def send_verification_email(self, user, verification):
        """Send verification email to user"""
        try:
            from ..services.zeptomail_service import send_email_via_zeptomail
            from django.template.loader import render_to_string
            from django.utils.html import strip_tags
            from django.conf import settings

            # Create verification URL (pointing to backend API)
            verification_url = (
                f"http://localhost:8000/api/verify-email/{verification.token}/"
            )

            # Create email content (similar to existing email service)
            subject = (
                f"Verify your email - {user.tenant.name if user.tenant else 'HRMS'}"
            )

            message = f"""
Welcome to {user.tenant.name if user.tenant else 'HRMS'} - HR Management System

Hello {user.first_name} {user.last_name},

Thank you for signing up! To complete your registration and access your account, please verify your email address by clicking the link below:

{verification_url}

This verification link will expire in {EmailVerification.EXPIRY_HOURS} hours.

If you didn't create an account with {user.tenant.name if user.tenant else 'HRMS'}, please ignore this email.

Best regards,
The {user.tenant.name if user.tenant else 'HRMS'} Team
            """

            # Send email using the same method as existing email service
            send_email_via_zeptomail(
                to_email=user.email,
                subject=subject,
                text_body=message
            )

            logger.info(f"Verification email sent to {user.email}")

        except Exception as e:
            logger.error(f"Failed to send verification email to {user.email}: {e}")
            # Don't raise the exception to avoid breaking the signup process


class VerifyEmailView(APIView):
    """
    Verify email address using verification token
    """

    permission_classes = [AllowAny]

    def get(self, request, token):
        """Handle email verification link clicks"""
        try:
            verification = EmailVerification.objects.get(token=token)

            if verification.is_expired:
                return render(
                    request,
                    "email_verification_expired.html",
                    {
                        "error": "Verification link has expired. Please request a new one."
                    },
                )

            if verification.is_used:
                return render(
                    request,
                    "email_verification_already_verified.html",
                    {"message": "Email has already been verified."},
                )

            # Mark as verified
            verification.mark_as_verified()

            return render(
                request,
                "email_verification_success.html",
                {
                    "message": "Email verified successfully! You can now login to your account."
                },
            )

        except EmailVerification.DoesNotExist:
            return render(
                request,
                "email_verification_invalid.html",
                {"error": "Invalid verification link."},
            )
        except Exception as e:
            logger.error(f"Email verification error: {e}")
            return render(
                request,
                "email_verification_error.html",
                {"error": "An error occurred during verification. Please try again."},
            )


class ResendVerificationView(APIView):
    """
    Resend email verification
    """

    permission_classes = [AllowAny]

    def post(self, request):
        """Resend verification email"""
        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"error": "Email address is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomUser.objects.get(email=email)

            if user.email_verified:
                return Response(
                    {"error": "Email is already verified"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Create new verification token
            verification = EmailVerification.create_verification(user)

            # Send verification email
            self.send_verification_email(user, verification)

            return Response(
                {"message": "Verification email sent successfully"},
                status=status.HTTP_200_OK,
            )

        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User with this email does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.error(f"Resend verification error: {e}")
            return Response(
                {"error": "Failed to send verification email"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def send_verification_email(self, user, verification):
        """Send verification email to user using the working email service"""
        try:
            from ..services.zeptomail_service import send_email_via_zeptomail
            from django.conf import settings

            # Create verification URL (pointing to backend API)
            verification_url = (
                f"http://localhost:8000/api/verify-email/{verification.token}/"
            )

            # Create email content (similar to existing email service)
            subject = (
                f"Verify your email - {user.tenant.name if user.tenant else 'HRMS'}"
            )

            message = f"""
Welcome to {user.tenant.name if user.tenant else 'HRMS'} - HR Management System

Hello {user.first_name} {user.last_name},

Thank you for signing up! To complete your registration and access your account, please verify your email address by clicking the link below:

{verification_url}

This verification link will expire in {EmailVerification.EXPIRY_HOURS} hours.

If you didn't create an account with {user.tenant.name if user.tenant else 'HRMS'}, please ignore this email.

Best regards,
The {user.tenant.name if user.tenant else 'HRMS'} Team
            """

            # Send email using the same method as existing email service
            send_email_via_zeptomail(
                to_email=user.email,
                subject=subject,
                text_body=message
            )

            logger.info(f"Verification email sent to {user.email}")

        except Exception as e:
            logger.error(f"Failed to send verification email to {user.email}: {e}")
            raise


class CheckVerificationStatusView(APIView):
    """
    Check if user's email is verified
    """

    permission_classes = [AllowAny]

    def post(self, request):
        """Check verification status"""
        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"error": "Email address is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomUser.objects.get(email=email)

            return Response(
                {"email_verified": user.email_verified, "email": user.email},
                status=status.HTTP_200_OK,
            )

        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User with this email does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )


class PublicTenantLoginView(APIView):
    """
    Public login endpoint that doesn't require tenant context
    User provides email and password, system finds their tenant
    Includes single-session enforcement
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        from ..utils.session_manager import SessionManager

        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")
        # Always force logout - "last login wins" policy
        force_logout = True
        
        # For "last login wins", we skip the current authentication check
        # and let the session conflict logic handle force logout
        # is_authenticated, current_user, error_response = (
        #     SessionManager.check_current_authentication(request)
        # )
        # if is_authenticated:
        #     return error_response

        if not email or not password:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Find user by email (regardless of tenant)
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "Invalid email or password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check password
        if not user.check_password(password):
            return Response(
                {"error": "Invalid email or password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if user is active
        if not user.is_active:
            return Response(
                {"error": "Account is deactivated. Please contact support."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if user has a tenant assigned
        if not user.tenant:
            return Response(
                {
                    "error": "User account is not associated with any company. Please contact support."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if email is verified (only required for admin users, not invited users)
        if not user.email_verified and not user.is_invited:
            return Response(
                {
                    "error": "Email not verified. Please check your email and click the verification link to activate your account.",
                    "email_verified": False,
                    "email": user.email,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if tenant is active
        if not user.tenant.is_active:
            return Response(
                {"error": "Company account is suspended. Please contact support."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if tenant has credits
        if user.tenant.credits <= 0:
            return Response(
                {
                    "error": "Company account has no credits. Please contact support to add credits to your account.",
                    "no_credits": True,
                    "credits": user.tenant.credits,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check for IP-based session conflict (different user from same IP)
        has_ip_session, existing_user, ip_message = SessionManager.check_ip_based_session(
            request, force_logout_on_conflict=force_logout
        )
        if has_ip_session:
            # If force_logout=True, the check_ip_based_session will return False
            # and allow login. If it still returns True, it means force logout failed
            return Response(
                {"error": ip_message, "ip_blocked": True},
                status=status.HTTP_409_CONFLICT,
            )

        # Check for existing active session (same user, different location)
        has_session, should_deny, message = SessionManager.check_existing_session(
            user, request, force_logout_on_conflict=force_logout
        )
        if should_deny:
            return Response(
                {"error": message, "already_logged_in": True},
                status=status.HTTP_409_CONFLICT,
            )

        # Check if user must change password
        if hasattr(user, "must_change_password") and user.must_change_password:
            return Response(
                {
                    "message": "Password change required",
                    "must_change_password": True,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": f"{user.first_name} {user.last_name}".strip(),
                        "role": user.role,
                    },
                    "tenant": {
                        "id": user.tenant.id,
                        "name": user.tenant.name,
                        "subdomain": user.tenant.subdomain,
                    },
                },
                status=status.HTTP_200_OK,
            )

        # Create new session
        session_key = SessionManager.create_new_session(user, request)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Login successful",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "session_key": session_key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": f"{user.first_name} {user.last_name}".strip(),
                    "role": user.role,
                },
                "tenant": {
                    "id": user.tenant.id,
                    "name": user.tenant.name,
                    "subdomain": user.tenant.subdomain,
                },
            },
            status=status.HTTP_200_OK,
        )


class UserInvitationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing team member invitations and permissions"""

    serializer_class = CustomUserSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        # Return users from the same tenant only

        return CustomUser.objects.filter(tenant=self.request.user.tenant)

    def create(self, request):
        """Invite a new team member"""

        try:

            data = request.data

            # Validate required fields

            required_fields = ["email", "first_name", "last_name", "role"]

            for field in required_fields:

                if not data.get(field):

                    return Response(
                        {"error": f"{field} is required"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Check if user already exists

            if CustomUser.objects.filter(email=data["email"]).exists():

                return Response(
                    {"error": "User with this email already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # VALIDATION: Only 1 HR Manager and 1 Admin allowed per tenant
            role = data.get("role")
            tenant = request.user.tenant
            
            if role == "hr_manager":
                existing_hr_count = CustomUser.objects.filter(
                    tenant=tenant,
                    role="hr_manager"
                ).count()
                if existing_hr_count >= 1:
                    return Response(
                        {"error": "Only one HR Manager is allowed per organization. An HR Manager already exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            
            elif role == "admin":
                existing_admin_count = CustomUser.objects.filter(
                    tenant=tenant,
                    role="admin"
                ).count()
                if existing_admin_count >= 1:
                    return Response(
                        {"error": "Only one Admin is allowed per organization. An Admin already exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Generate temporary password

            temp_password = str(uuid.uuid4())[:8]

            # Create user with tenant context
            # Skip email verification for invited users - they are pre-verified by invitation

            user = CustomUser.objects.create_user(
                email=data["email"],
                password=temp_password,
                first_name=data["first_name"],
                last_name=data["last_name"],
                role=data["role"],
                tenant=request.user.tenant,
                is_invited=True,
                email_verified=True,  # Skip email verification for invited users
                phone_number=data.get("phone_number", ""),
                department=data.get("department", ""),
            )

            # Create permissions

            permissions_data = data.get("permissions", {})

            permissions = UserPermissions.objects.create(
                can_view=permissions_data.get("can_view", True),
                can_modify=permissions_data.get("can_modify", False),
                can_invite_users=permissions_data.get("can_invite_users", False),
                can_manage_payroll=permissions_data.get("can_manage_payroll", False),
                can_export_data=permissions_data.get("can_export_data", False),
            )

            user.permissions = permissions

            user.save()

            # Send invitation email with temporary password
            # SECURITY: Never return password in API response - only send via email
            try:
                from ..services.zeptomail_service import send_email_via_zeptomail
                from django.conf import settings
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
                
                subject = f"Welcome to {request.user.tenant.name} - Your Account Details"
                message = f"""
Dear {data['first_name']} {data['last_name']},

You have been invited to join {request.user.tenant.name}'s HR management system.

Your login credentials are:
Email: {data['email']}
Temporary Password: {temp_password}

IMPORTANT: You will be required to change your password when you first log in.

Please log in at: {frontend_url}/login

If you have any questions, please contact your administrator.

Best regards,
{request.user.first_name} {request.user.last_name}
{request.user.tenant.name}
                """.strip()
                
                send_email_via_zeptomail(
                    to_email=data['email'],
                    subject=subject,
                    text_body=message
                )
                email_sent = True
            except Exception as email_error:
                logger.error(f"Failed to send invitation email: {email_error}")
                email_sent = False

            serializer = self.get_serializer(user)

            return Response(
                {
                    "message": "User invited successfully. Temporary password has been sent to the user's email.",
                    "user": serializer.data,
                    "email_sent": email_sent,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in user invitation: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to invite user. Please try again or contact support."},
                status=status.HTTP_400_BAD_REQUEST
            )

    def list(self, request):
        """List all team members"""

        queryset = self.get_queryset()

        serializer = self.get_serializer(queryset, many=True)

        return Response({"results": serializer.data, "count": queryset.count()})

    @action(detail=True, methods=["patch"])
    def permissions(self, request, pk=None):
        """Update user permissions"""

        user = self.get_object()

        if not user.permissions:

            user.permissions = UserPermissions.objects.create()

            user.save()

        permissions_data = request.data.get("permissions", {})

        for key, value in permissions_data.items():

            if hasattr(user.permissions, key):

                setattr(user.permissions, key, value)

        user.permissions.save()

        serializer = self.get_serializer(user)

        return Response(
            {"message": "Permissions updated successfully", "user": serializer.data}
        )


class EnhancedInvitationView(APIView):
    """Simplified user invitation with preset password"""

    permission_classes = [IsAuthenticated]

    def post(self, request):

        try:

            import secrets

            import string

            from ..services.zeptomail_service import send_email_via_zeptomail

            from django.conf import settings

            data = request.data

            # Check if user has a tenant

            if not hasattr(request.user, "tenant") or not request.user.tenant:

                return Response(
                    {
                        "error": "User is not associated with any tenant. Please contact your administrator."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate required fields

            required_fields = ["email", "first_name", "last_name", "role"]

            for field in required_fields:

                if not data.get(field):

                    return Response(
                        {"error": f"{field} is required"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            email = data["email"].strip().lower()

            # Check if user already exists

            if CustomUser.objects.filter(email=email).exists():

                return Response(
                    {"error": "User with this email already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # VALIDATION: Only 1 HR Manager and 1 Admin allowed per tenant
            role = data.get("role")
            tenant = request.user.tenant
            
            if role == "hr_manager":
                existing_hr_count = CustomUser.objects.filter(
                    tenant=tenant,
                    role="hr_manager"
                ).count()
                if existing_hr_count >= 1:
                    return Response(
                        {"error": "Only one HR Manager is allowed per organization. An HR Manager already exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            
            elif role == "admin":
                existing_admin_count = CustomUser.objects.filter(
                    tenant=tenant,
                    role="admin"
                ).count()
                if existing_admin_count >= 1:
                    return Response(
                        {"error": "Only one Admin is allowed per organization. An Admin already exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Generate a secure temporary password

            temp_password = "".join(
                secrets.choice(string.ascii_letters + string.digits) for _ in range(12)
            )

            # Create the user directly with preset password
            # Skip email verification for invited users - they are pre-verified by invitation

            try:

                user = CustomUser.objects.create_user(
                    username=email,
                    email=email,
                    first_name=data["first_name"],
                    last_name=data["last_name"],
                    password=temp_password,
                    tenant=request.user.tenant,
                    role=data["role"],
                    is_invited=True,
                    email_verified=True,  # Skip email verification for invited users
                    must_change_password=True,  # Flag to force password change on first login
                )

                # Send email with credentials
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://35.154.9.249')
                subject = (
                    f"Welcome to {request.user.tenant.name} - Your Account Details"
                )

                message = f"""

Dear {data['first_name']} {data['last_name']},



You have been invited to join {request.user.tenant.name}'s HR management system.



Your login credentials are:

Email: {email}

Temporary Password: {temp_password}



IMPORTANT: You will be required to change your password when you first log in.



Please log in at: {frontend_url}/login



If you have any questions, please contact your administrator.



Best regards,

{request.user.first_name} {request.user.last_name}

{request.user.tenant.name}

                """.strip()

                try:

                    send_email_via_zeptomail(
                        to_email=email,
                        subject=subject,
                        text_body=message
                    )

                    email_sent = True

                except Exception as email_error:

                    email_sent = False

                if email_sent:

                    return Response(
                        {
                            "message": f"User created and invitation sent successfully to {email}",  # Include for manual sharing if email fails
                        },
                        status=status.HTTP_201_CREATED,
                    )

                else:

                    return Response(
                        {
                            "message": f"User created successfully but email sending failed. Please contact administrator to get the credentials.",
                        },
                        status=status.HTTP_201_CREATED,
                    )

            except Exception as user_error:
                # SECURITY: Don't expose internal error details to client
                logger.error(f"Failed to create user: {str(user_error)}", exc_info=True)
                return Response(
                    {"error": "Failed to create user. Please try again or contact support."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in invitation acceptance: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to accept invitation. Please try again or contact support."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AcceptInvitationView(APIView):
    """Accept invitation and set password"""

    permission_classes = [AllowAny]

    def post(self, request):

        try:

            from ..models import InvitationToken

            from ..services.email_service import send_welcome_email

            token = request.data.get("token")

            password = request.data.get("password")

            confirm_password = request.data.get("confirm_password")

            if not all([token, password, confirm_password]):

                return Response(
                    {"error": "Token, password, and confirm_password are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find invitation token

            try:

                invitation = InvitationToken.objects.get(token=token, is_used=False)

            except InvitationToken.DoesNotExist:

                return Response(
                    {"error": "Invalid or expired invitation token"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if token is expired

            if invitation.is_expired():

                return Response(
                    {"error": "Invitation token has expired"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if user already exists

            if CustomUser.objects.filter(email=invitation.email).exists():

                return Response(
                    {"error": "User with this email already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Create user account
            # Skip email verification for invited users - they are pre-verified by invitation

            user = CustomUser.objects.create_user(
                email=invitation.email,
                password=password,
                first_name=invitation.first_name,
                last_name=invitation.last_name,
                role=invitation.role,
                tenant=invitation.tenant,
                is_invited=True,
                is_active=True,
                email_verified=True,  # Skip email verification for invited users
            )

            # Mark invitation as used

            invitation.is_used = True

            invitation.save()

            # Send welcome email

            send_welcome_email(user)

            # Create new session for immediate login
            from ..utils.session_manager import SessionManager

            session_key = SessionManager.create_new_session(user, request)

            # Generate JWT tokens for immediate login
            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "message": "Account created successfully! Welcome to the team.",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": f"{user.first_name} {user.last_name}".strip(),
                        "role": user.role,
                    },
                    "tenant": {
                        "id": user.tenant.id,
                        "name": user.tenant.name,
                        "subdomain": user.tenant.subdomain,
                    },
                    "tokens": {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                    },
                    "session_key": session_key,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in password reset request: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to process password reset request. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RequestPasswordResetView(APIView):
    """Request password reset OTP"""

    permission_classes = [AllowAny]

    def post(self, request):

        try:

            from ..models import PasswordResetOTP

            from ..services.email_service import send_password_reset_otp, generate_otp

            from django.utils import timezone

            from datetime import timedelta

            from ..utils.utils import set_current_tenant

            email = request.data.get("email", "").strip().lower()

            if not email:

                return Response(
                    {"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Check if user exists and get their tenant

            try:

                user = CustomUser.objects.select_related("tenant").get(email=email)

                # Set the tenant context for this request

                if user.tenant:

                    set_current_tenant(user.tenant)

                    request.tenant = user.tenant

            except CustomUser.DoesNotExist:

                # Don't reveal if user exists or not for security

                return Response(
                    {
                        "message": "If an account with this email exists, you will receive an OTP code shortly."
                    },
                    status=status.HTTP_200_OK,
                )

            # Generate OTP

            otp_code = generate_otp()

            expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

            # Delete any existing unused OTPs for this email

            PasswordResetOTP.objects.filter(email=email, is_used=False).delete()

            # Create new OTP

            otp_record = PasswordResetOTP.objects.create(
                email=email, otp_code=otp_code, expires_at=expires_at
            )

            # Send OTP email

            email_sent = send_password_reset_otp(email, otp_code)

            if email_sent:

                return Response(
                    {
                        "message": f"OTP code has been sent to your email. It will expire in {settings.OTP_EXPIRY_MINUTES} minutes."
                    },
                    status=status.HTTP_200_OK,
                )

            else:

                # Clean up OTP if email failed

                otp_record.delete()

                return Response(
                    {"error": "Failed to send OTP email. Please try again."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in password reset request: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to process password reset request. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VerifyOTPView(APIView):
    """Verify OTP code"""

    permission_classes = [AllowAny]

    def post(self, request):

        try:

            from ..models import PasswordResetOTP

            email = request.data.get("email", "").strip().lower()

            otp_code = request.data.get("otp_code", "").strip()

            if not all([email, otp_code]):

                return Response(
                    {"error": "Email and OTP code are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find valid OTP

            try:

                otp_record = PasswordResetOTP.objects.get(
                    email=email, otp_code=otp_code, is_used=False
                )

            except PasswordResetOTP.DoesNotExist:

                return Response(
                    {"error": "Invalid OTP code"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Check if OTP is expired

            if otp_record.is_expired():

                return Response(
                    {"error": "OTP code has expired. Please request a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "message": "OTP verified successfully",
                    "reset_token": otp_record.id,  # Use OTP record ID as reset token
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in OTP verification: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to verify OTP. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ResetPasswordView(APIView):
    """Reset password with verified OTP"""

    permission_classes = [AllowAny]

    def post(self, request):

        try:

            from ..models import PasswordResetOTP

            reset_token = request.data.get("reset_token")

            email = request.data.get("email", "").strip().lower()

            new_password = request.data.get("new_password")

            confirm_password = request.data.get("confirm_password")

            if not all([reset_token, email, new_password, confirm_password]):

                return Response(
                    {"error": "All fields are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if new_password != confirm_password:

                return Response(
                    {"error": "Passwords do not match"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find OTP record

            try:

                otp_record = PasswordResetOTP.objects.get(
                    id=reset_token, email=email, is_used=False
                )

            except PasswordResetOTP.DoesNotExist:

                return Response(
                    {"error": "Invalid reset token"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Check if OTP is expired

            if otp_record.is_expired():

                return Response(
                    {"error": "Reset token has expired. Please request a new OTP."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find user and update password

            try:

                user = CustomUser.objects.get(email=email)

            except CustomUser.DoesNotExist:

                return Response(
                    {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
                )

            # Update password

            user.set_password(new_password)

            if hasattr(user, "must_change_password"):
                user.must_change_password = False

            user.save()

            # Mark OTP as used

            otp_record.is_used = True

            otp_record.save()

            return Response(
                {
                    "message": "Password reset successfully. You can now log in with your new password."
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in password reset: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to reset password. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChangePasswordView(APIView):
    """Change password for users who must change their password on first login"""

    permission_classes = [AllowAny]

    def post(self, request):

        try:

            email = request.data.get("email", "").strip().lower()

            current_password = request.data.get("current_password")

            new_password = request.data.get("new_password")

            confirm_password = request.data.get("confirm_password")

            if not all([email, current_password, new_password, confirm_password]):

                return Response(
                    {"error": "All fields are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find user

            try:

                user = CustomUser.objects.get(email=email)

            except CustomUser.DoesNotExist:

                return Response(
                    {"error": "User not found"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Verify current password

            if not user.check_password(current_password):

                return Response(
                    {"error": "Current password is incorrect"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate new password

            try:

                validate_password(new_password, user)

            except ValidationError as e:

                return Response(
                    {"error": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST
                )

            # Update password and remove must_change_password flag

            user.set_password(new_password)

            user.must_change_password = False

            user.save()

            # Generate JWT tokens for immediate login

            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "message": "Password changed successfully. You are now logged in.",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": f"{user.first_name} {user.last_name}".strip(),
                        "role": user.role,
                    },
                    "tenant": {
                        "id": user.tenant.id,
                        "name": user.tenant.name,
                        "subdomain": user.tenant.subdomain,
                    },
                    "tokens": {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                    },
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in password change: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to change password. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ValidateInvitationTokenView(APIView):
    """Validate invitation token"""

    permission_classes = [AllowAny]

    def get(self, request):

        try:

            from ..models import InvitationToken

            token = request.query_params.get("token")

            if not token:

                return Response(
                    {"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST
                )

            try:

                invitation = InvitationToken.objects.get(token=token, is_used=False)

            except InvitationToken.DoesNotExist:

                return Response(
                    {"error": "Invalid invitation token"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if invitation.is_expired():

                return Response(
                    {"error": "Invitation token has expired"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if user already exists

            if CustomUser.objects.filter(email=invitation.email).exists():

                return Response(
                    {"error": "User with this email already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "valid": True,
                    "invitation": {
                        "email": invitation.email,
                        "first_name": invitation.first_name,
                        "last_name": invitation.last_name,
                        "role": invitation.role,
                        "company": invitation.tenant.name,
                        "expires_at": invitation.expires_at,
                    },
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in invitation token validation: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to validate invitation token. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CleanupTokensView(APIView):
    """Cleanup expired tokens - for admin use"""

    permission_classes = [IsAuthenticated]

    def post(self, request):

        try:

            from ..services.email_service import cleanup_expired_tokens

            # Check if user has admin permissions

            if request.user.role != "admin":

                return Response(
                    {"error": "Only admins can perform cleanup operations"},
                    status=status.HTTP_403_FORBIDDEN,
                )

            invitation_count, otp_count = cleanup_expired_tokens()

            return Response(
                {
                    "message": "Cleanup completed successfully",
                    "expired_invitations_deleted": invitation_count,
                    "expired_otps_deleted": otp_count,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            # SECURITY: Don't expose internal error details to client
            logger.error(f"Error in token cleanup: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to cleanup tokens. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DeleteAccountView(APIView):
    """Delete user account - only allows users to delete their own account"""

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        try:
            user = request.user

            # Security check - users can only delete their own account
            if not user or not user.is_authenticated:
                return Response(
                    {"error": "Authentication required"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Prevent superusers from accidentally deleting their accounts
            if user.is_superuser:
                return Response(
                    {
                        "error": "Superuser accounts cannot be deleted. Please contact system administrator."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Store user info for logging
            user_email = user.email
            user_id = user.id
            tenant_name = (
                getattr(user.tenant, "name", "Unknown")
                if hasattr(user, "tenant") and user.tenant
                else "Unknown"
            )

            # Log the account deletion

            # Delete the user account
            # This will cascade delete related data based on model relationships
            user.delete()

            # Log successful deletion

            return Response(
                {
                    "message": "Your account has been successfully deleted. All your data has been permanently removed."
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:

            return Response(
                {
                    "error": "An error occurred while deleting your account. Please try again or contact support."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
