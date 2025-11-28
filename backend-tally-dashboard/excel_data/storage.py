"""
Custom storage backends for Cloudflare R2
"""
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
import logging

logger = logging.getLogger(__name__)


class R2Storage(S3Boto3Storage):
    """
    Custom storage backend for Cloudflare R2 (S3-compatible)
    
    R2 is S3-compatible, so we can use django-storages' S3Boto3Storage
    with R2-specific endpoint configuration.
    """
    # Override default settings for R2
    default_acl = getattr(settings, 'AWS_DEFAULT_ACL', 'private')
    file_overwrite = getattr(settings, 'AWS_S3_FILE_OVERWRITE', False)
    location = ''  # Can be set to a prefix like 'attachments/'
    
    def __init__(self, *args, **kwargs):
        # Get R2 configuration from settings and set before parent init
        # Parent class will use these in _create_session
        self.endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
        self.region_name = getattr(settings, 'AWS_S3_REGION_NAME', 'auto')
        self.custom_domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
        
        # Log configuration for debugging
        if self.endpoint_url:
            logger.info(f"R2Storage initialized with endpoint: {self.endpoint_url}")
            logger.info(f"R2Storage bucket: {getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'NOT SET')}")
        
        super().__init__(*args, **kwargs)
    
    def _create_session(self):
        """Override session creation to use R2 endpoint and path-style addressing"""
        import boto3
        from botocore.config import Config
        
        # Configure boto3 for R2
        config = Config(
            region_name=self.region_name,
            signature_version='s3v4',
            s3={
                'addressing_style': 'path'  # R2 uses path-style addressing
            }
        )
        
        # Create session with R2 endpoint
        session = boto3.Session(
            aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
            aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None),
        )
        
        # Store config for use in connection creation
        self.config = config
        
        return session
    
    @property
    def _client(self):
        """Get boto3 client for presigned URL generation"""
        if not hasattr(self, '_r2_client') or self._r2_client is None:
            import boto3
            from botocore.config import Config
            
            # Configure boto3 for R2
            config = Config(
                region_name=self.region_name,
                signature_version='s3v4',
                s3={
                    'addressing_style': 'path'  # R2 uses path-style addressing
                }
            )
            
            # Get credentials from settings
            access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
            secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
            
            if not access_key or not secret_key:
                logger.error("R2 credentials not found in settings")
                raise ValueError("R2 credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) must be set")
            
            # Create boto3 CLIENT for presigned URLs
            self._r2_client = boto3.client(
                's3',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                endpoint_url=self.endpoint_url,  # R2 endpoint
                config=config
            )
            
            logger.debug(f"R2Storage client connection established to {self.endpoint_url}")
        
        return self._r2_client
    
    def url(self, name):
        """
        Generate URL for file in R2
        
        For private buckets, generates signed URLs (presigned URLs).
        For public buckets with custom domain, uses direct URLs.
        """
        if not name:
            return ''
        
        # Clean the name (remove leading slash if present)
        name = name.lstrip('/')
        
        # If custom domain is configured, use it (for public buckets)
        if hasattr(self, 'custom_domain') and self.custom_domain:
            if self.custom_domain.endswith('/'):
                return f"{self.custom_domain}{name}"
            return f"{self.custom_domain}/{name}"
        
        # For private files, generate signed URL (presigned URL)
        # This is the recommended approach for R2 private buckets
        try:
            # Use client (not resource) for presigned URL generation
            client = self._client
            
            # Generate presigned URL with proper parameters
            url = client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': name
                },
                ExpiresIn=3600  # 1 hour expiry - adjust as needed
            )
            
            logger.debug(f"Generated presigned URL for {name}: {url[:100]}...")
            return url
        except Exception as e:
            logger.error(f"Error generating presigned URL for {name}: {str(e)}", exc_info=True)
            # Don't fallback to unauthenticated URL - it won't work for private buckets
            raise ValueError(f"Failed to generate download URL: {str(e)}")

