# pin_auth.py
# PIN authentication endpoints for 2-layer authentication

import logging
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import CustomUser, UserPIN

logger = logging.getLogger(__name__)


class SetupPINView(APIView):
    """
    Setup or update PIN for authenticated user
    Requires current password for security
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        pin = request.data.get('pin')
        password = request.data.get('password')
        
        # Validate inputs
        if not pin or not password:
            return Response(
                {'error': 'PIN and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify PIN format
        if len(str(pin)) != 4 or not str(pin).isdigit():
            return Response(
                {'error': 'PIN must be exactly 4 digits'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify current password
        if not user.check_password(password):
            return Response(
                {'error': 'Invalid password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Get or create UserPIN
            user_pin, created = UserPIN.objects.get_or_create(user=user)
            
            # Set the PIN
            user_pin.set_pin(pin)
            
            # Enable PIN authentication
            user_pin.is_enabled = True
            user_pin.save()
            
            logger.info(f"PIN {'created' if created else 'updated'} for user {user.email}")
            
            return Response({
                'success': True,
                'message': 'PIN setup successfully',
                'pin_enabled': True
            })
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error setting up PIN for user {user.email}: {str(e)}")
            return Response(
                {'error': 'Failed to setup PIN'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VerifyPINView(APIView):
    """
    Verify PIN after successful password login
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        pin = request.data.get('pin')
        
        # Validate inputs
        if not email or not pin:
            return Response(
                {'error': 'Email and PIN are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get user
            user = CustomUser.objects.get(email=email)
            
            # Check if user has PIN enabled
            if not hasattr(user, 'pin_auth') or not user.pin_auth.is_enabled:
                return Response(
                    {'error': 'PIN authentication not enabled for this user'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify PIN
            success, message = user.pin_auth.verify_pin(pin)
            
            if success:
                logger.info(f"PIN verified successfully for user {user.email}")
                return Response({
                    'success': True,
                    'message': message,
                    'user_id': user.id,
                    'email': user.email
                })
            else:
                logger.warning(f"Failed PIN attempt for user {user.email}: {message}")
                return Response(
                    {'error': message},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error verifying PIN: {str(e)}")
            return Response(
                {'error': 'Failed to verify PIN'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DisablePINView(APIView):
    """
    Disable PIN authentication for user
    Requires current password for security
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        password = request.data.get('password')
        
        # Validate password
        if not password:
            return Response(
                {'error': 'Password is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify current password
        if not user.check_password(password):
            return Response(
                {'error': 'Invalid password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Check if user has PIN
            if not hasattr(user, 'pin_auth'):
                return Response(
                    {'error': 'PIN not setup for this user'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Disable PIN
            user.pin_auth.is_enabled = False
            user.pin_auth.save()
            
            logger.info(f"PIN disabled for user {user.email}")
            
            return Response({
                'success': True,
                'message': 'PIN authentication disabled',
                'pin_enabled': False
            })
            
        except Exception as e:
            logger.error(f"Error disabling PIN for user {user.email}: {str(e)}")
            return Response(
                {'error': 'Failed to disable PIN'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PINStatusView(APIView):
    """
    Check if PIN authentication is enabled for user
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            # Check if user has PIN setup
            has_pin = hasattr(user, 'pin_auth')
            is_enabled = has_pin and user.pin_auth.is_enabled
            is_locked = has_pin and user.pin_auth.is_locked()
            
            locked_until = None
            if is_locked and user.pin_auth.locked_until:
                locked_until = user.pin_auth.locked_until.isoformat()
            
            return Response({
                'has_pin': has_pin,
                'pin_enabled': is_enabled,
                'is_locked': is_locked,
                'locked_until': locked_until
            })
            
        except Exception as e:
            logger.error(f"Error checking PIN status for user {user.email}: {str(e)}")
            return Response(
                {'error': 'Failed to check PIN status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CheckPINRequiredView(APIView):
    """
    Check if PIN is required for a user (used after password login)
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = CustomUser.objects.get(email=email)
            
            # Check if user has PIN enabled
            pin_required = hasattr(user, 'pin_auth') and user.pin_auth.is_enabled
            
            return Response({
                'pin_required': pin_required,
                'email': email
            })
            
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error checking PIN requirement: {str(e)}")
            return Response(
                {'error': 'Failed to check PIN requirement'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
