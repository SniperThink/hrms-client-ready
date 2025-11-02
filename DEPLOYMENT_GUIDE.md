# HRMS Project - Complete Deployment Guide
## Vercel (Frontend) + Railway (Backend)

---

## 📋 Table of Contents
1. [Project Analysis](#project-analysis)
2. [Backend Deployment (Railway)](#backend-deployment-railway)
3. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Troubleshooting](#troubleshooting)

---

## 🔍 Project Analysis

### Backend Stack
- **Framework**: Django 5.2
- **Database**: PostgreSQL (Neon - already configured)
- **WSGI Server**: Gunicorn with Gevent workers
- **Task Queue**: Celery + Redis (Optional - currently disabled)
- **Key Features**: Multi-tenant HRMS, JWT Authentication, Excel processing

### Frontend Stack
- **Framework**: React 18.3 with Vite
- **UI**: Tailwind CSS, Lucide React icons
- **Charts**: Chart.js, Recharts
- **Routing**: React Router DOM v7.5

### Dependencies Analysis

#### ✅ **Backend - REQUIRED Dependencies** (Keep These)
```
# Core Django
Django==5.2
psycopg2-binary==2.9.11
dj-database-url==2.1.0
whitenoise==6.6.0
gunicorn==21.2.0
gevent==24.2.1

# REST Framework & Auth
djangorestframework==3.16.1
djangorestframework-simplejwt==5.5.1
django-cors-headers==4.9.0
django-filter==24.2

# Configuration
python-decouple==3.8

# Data Processing (Used in Excel uploads)
pandas==2.3.3
numpy==2.3.4
openpyxl==3.1.5
et-xmlfile==2.0.0

# Utilities (Used in views)
pytz==2023.3
python-dateutil==2.9.0.post0
```

#### ⚠️ **Backend - CONDITIONAL Dependencies** (Keep for flexibility)
```
# Celery & Redis - Currently disabled but configured
celery==5.5.3
redis==6.4.0
kombu==5.5.4
amqp==5.3.1
billiard==4.2.2
vine==5.1.0

# Keep these as fallback for async tasks
```

#### ❌ **Backend - REMOVE/OPTIONAL Dependencies**
```
waitress==3.0.0  # Only for Windows local testing, not needed in Railway
python-dotenv==1.0.0  # Redundant - using python-decouple

# Testing (Not needed in production)
pytest==8.0.2
pytest-django==4.8.0
Faker==37.8.0
factory-boy==3.3.0

# Development (Not needed in production)
autopep8==2.3.2

# Unused security libraries
Pillow==12.0.0  # NOT USED - No ImageField in models
PyJWT==2.10.1  # Redundant - djangorestframework-simplejwt handles JWT
bcrypt==4.3.0  # NOT USED - Django handles password hashing
passlib==1.7.4  # NOT USED
```

#### 📦 **Optimized Backend Requirements**
```
# Django Core
Django==5.2
psycopg2-binary==2.9.11
dj-database-url==2.1.0
whitenoise==6.6.0
gunicorn==21.2.0
gevent==24.2.1

# Django REST Framework
djangorestframework==3.16.1
djangorestframework-simplejwt==5.5.1
django-cors-headers==4.9.0
django-filter==24.2

# Configuration Management
python-decouple==3.8

# Data Processing
pandas==2.3.3
numpy==2.3.4
openpyxl==3.1.5
et-xmlfile==2.0.0

# Task Scheduling
pytz==2023.3
python-dateutil==2.9.0.post0

# Celery & Task Queue (Optional - for future scaling)
celery==5.5.3
redis==6.4.0
kombu==5.5.4
amqp==5.3.1
billiard==4.2.2
vine==5.1.0

# Core Dependencies
tzdata==2025.2
asgiref==3.10.0
sqlparse==0.5.3

# CLI utilities (needed by Celery)
click==8.3.0
click-didyoumean==0.3.1
click-repl==0.3.0
click-plugins==1.1.1.2
prompt-toolkit==3.0.52

# Other Dependencies
packaging==25.0
six==1.17.0
wcwidth==0.2.14
```

---

## 🚀 Backend Deployment (Railway)

### Step 1: Pre-Deployment Checklist

#### A. Environment Variables Required
Create these in Railway dashboard:

```bash
# Django Core Settings
SECRET_KEY=<generate-new-secret-key-here>
DEBUG=False
ALLOWED_HOSTS=*.railway.app,yourdomain.com

# Database (Neon PostgreSQL - Already configured)
DATABASE_URL=postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=npg_kiW2lJnVcsu8
DB_HOST=ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech
DB_PORT=5432

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
CORS_ALLOW_ALL_ORIGINS=False
FORCE_CORS_ALL_ORIGINS=False

# Frontend URL
FRONTEND_URL=https://your-frontend.vercel.app

# Email Configuration (Gmail SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=Team.Sniperthink@gmail.com
EMAIL_HOST_PASSWORD=sucf esxk namx mtwa
DEFAULT_FROM_EMAIL=Team.Sniperthink@gmail.com

# Celery Configuration (Optional - can be disabled)
CELERY_ENABLED=False
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Multi-tenant Configuration
DEFAULT_TENANT_SUBDOMAIN=demo

# Invitation Settings
INVITATION_TOKEN_EXPIRY_HOURS=72
OTP_EXPIRY_MINUTES=10

# Gunicorn Settings (Optional overrides)
GUNICORN_WORKERS=2
GUNICORN_TIMEOUT=300
PORT=8000
```

#### B. Generate New SECRET_KEY
Run this command locally to generate a secure secret key:

```python
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Step 2: Railway Setup

#### A. Create Railway Account
1. Go to [railway.app](https://railway.app/)
2. Sign up with GitHub account
3. Connect your repository

#### B. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your backend repository: `hrms-backend`
4. Select branch: `main`

#### C. Configure Build Settings

**Root Directory**: `backend-tally-dashboard`

**Build Command**: (Leave empty - Railway auto-detects)

**Start Command**:
```bash
gunicorn --config gunicorn_config.py dashboard.wsgi:application
```

Alternative (if gunicorn_config.py doesn't work):
```bash
gunicorn --worker-class gevent --workers 2 --bind 0.0.0.0:$PORT --timeout 300 dashboard.wsgi:application
```

#### D. Add Environment Variables
In Railway Dashboard:
1. Go to your project → Variables
2. Add all environment variables from Step 1A
3. Railway will provide a `PORT` variable automatically - use it

### Step 3: Database Configuration

#### Option 1: Use Existing Neon Database (Recommended)
Your Neon PostgreSQL is already configured. Just set:
```bash
DATABASE_URL=postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require
```

#### Option 2: Create Railway PostgreSQL (Alternative)
1. In Railway project → "New" → "Database" → "PostgreSQL"
2. Railway will provide `DATABASE_URL` automatically
3. You'll need to migrate your data from Neon

### Step 4: Initial Deployment

1. **Push Changes**: Commit any changes to GitHub
   ```bash
   cd backend-tally-dashboard
   git add .
   git commit -m "Configure for Railway deployment"
   git push origin main
   ```

2. **Railway Auto-Deploy**: Railway will automatically build and deploy

3. **Monitor Logs**: In Railway dashboard → Deployments → View Logs

### Step 5: Database Migrations

After first deployment, run migrations:

```bash
# Option 1: Using Railway CLI
railway run python manage.py migrate
railway run python manage.py createsuperuser

# Option 2: Using Railway Shell (in Dashboard)
# Go to project → Settings → Open Shell
python manage.py migrate
python manage.py createsuperuser
```

### Step 6: Static Files

Django settings already configured with WhiteNoise:
```python
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
```

Run collectstatic:
```bash
railway run python manage.py collectstatic --noinput
```

### Step 7: Setup Cache Table

For database caching:
```bash
railway run python manage.py createcachetable
```

### Step 8: Domain Configuration

1. **Get Railway URL**: `your-project.railway.app`
2. **Update ALLOWED_HOSTS** in environment variables:
   ```
   ALLOWED_HOSTS=your-project.railway.app,*.railway.app
   ```
3. **Custom Domain** (Optional):
   - Railway Settings → Domains → Add Custom Domain
   - Add CNAME record in your DNS: `your-domain.com` → `your-project.railway.app`

---

## 🌐 Frontend Deployment (Vercel)

### Step 1: Pre-Deployment Checklist

#### A. Update API Configuration

**File**: `frontend-tally-dashboard/src/config/apiConfig.ts`

```typescript
// API Configuration for different environments
export const API_CONFIG = {
  getBaseUrl: () => {
    // Production - Use Railway backend URL
    if (window.location.hostname.includes('vercel.app') || 
        window.location.hostname === 'your-custom-domain.com') {
      return 'https://your-project.railway.app'; // Your Railway URL
    }

    // Development
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000';
    }

    // Fallback
    return 'http://127.0.0.1:8000';
  },

  getApiUrl: (endpoint: string = '') => {
    const baseUrl = API_CONFIG.getBaseUrl();
    return `${baseUrl}/api${endpoint}`;
  },
};

export const API_BASE_URL = API_CONFIG.getBaseUrl();
export const API_BASE = API_CONFIG.getApiUrl();
```

#### B. Create Environment File

**File**: `frontend-tally-dashboard/.env.production`

```bash
VITE_API_URL=https://your-project.railway.app
```

#### C. Update Hardcoded URLs

**Files to update**:
1. `src/utils/ProgressiveEmployeeLoader.js`
2. `src/hooks/useProgressiveEmployees.js`

**Change**:
```javascript
// Before
constructor(baseUrl = 'http://localhost:8000') {
  this.baseUrl = baseUrl;
}

// After
constructor(baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000') {
  this.baseUrl = baseUrl;
}
```

### Step 2: Vercel Setup

#### A. Create Vercel Account
1. Go to [vercel.com](https://vercel.com/)
2. Sign up with GitHub account

#### B. Import Project
1. Click "New Project"
2. Import from GitHub: `hrms-frontend` or your frontend repo
3. Select branch: `main`

#### C. Configure Build Settings

**Framework Preset**: Vite

**Root Directory**: `frontend-tally-dashboard`

**Build Command**:
```bash
npm run build
```

**Output Directory**:
```bash
dist
```

**Install Command**:
```bash
npm install
```

#### D. Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables:

```bash
VITE_API_URL=https://your-project.railway.app
```

### Step 3: Configure Routing

**File**: `frontend-tally-dashboard/vercel.json` (Create this file)

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

### Step 4: Deploy

1. **Push Changes**:
   ```bash
   cd frontend-tally-dashboard
   git add .
   git commit -m "Configure for Vercel deployment"
   git push origin main
   ```

2. **Vercel Auto-Deploy**: Vercel will automatically build and deploy

3. **Get Deployment URL**: `your-project.vercel.app`

### Step 5: Update Backend CORS

After getting Vercel URL, update Railway environment variables:

```bash
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app,http://localhost:5173
FRONTEND_URL=https://your-project.vercel.app
```

Redeploy backend in Railway dashboard.

---

## 🔧 Post-Deployment Configuration

### 1. Test Authentication Flow

```bash
# Test registration endpoint
curl -X POST https://your-project.railway.app/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "company_name": "Test Company"
  }'

# Test login
curl -X POST https://your-project.railway.app/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

### 2. Setup Monitoring

#### Railway Logs
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs
```

#### Vercel Logs
View in Dashboard → Project → Logs

### 3. Setup Celery Worker (Optional)

If you enable Celery later:

1. **Add Redis to Railway**:
   - New → Database → Redis
   - Get `REDIS_URL` from Railway

2. **Update Environment**:
   ```bash
   CELERY_ENABLED=True
   CELERY_BROKER_URL=<redis-url>
   CELERY_RESULT_BACKEND=<redis-url>
   ```

3. **Add Worker Service**:
   - In Railway, create new service from same repo
   - Start Command: `celery -A dashboard worker -l info`

4. **Add Beat Service** (for periodic tasks):
   - Create another service
   - Start Command: `celery -A dashboard beat -l info`

### 4. Database Backup Strategy

#### Neon Automated Backups
Neon provides automatic backups. Check your Neon dashboard.

#### Manual Backup
```bash
# Using Railway shell
railway run pg_dump $DATABASE_URL > backup.sql

# Or directly from Neon
pg_dump "postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech:5432/neondb" > backup.sql
```

### 5. Performance Optimization

#### Backend (Railway)
```python
# settings.py - Already configured
CONN_MAX_AGE = 600  # Database connection pooling
DATABASES['default']['CONN_HEALTH_CHECKS'] = True
```

#### Frontend (Vercel)
```javascript
// Add to vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2', 'recharts'],
        },
      },
    },
  },
});
```

---

## 🐛 Troubleshooting

### Backend Issues

#### 1. Database Connection Errors
**Error**: `psycopg2.OperationalError: could not connect to server`

**Solution**:
```bash
# Check DATABASE_URL format
# Should be: postgresql://user:password@host:port/dbname?sslmode=require

# Verify Neon connection string is correct
# Test connection locally:
psql "postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require"
```

#### 2. Static Files Not Loading
**Error**: 404 on `/static/` files

**Solution**:
```bash
# Run collectstatic
railway run python manage.py collectstatic --noinput

# Verify WhiteNoise is in MIDDLEWARE (already configured)
# Check STATIC_ROOT and STATIC_URL in settings.py
```

#### 3. CORS Errors
**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**:
```python
# Update Railway environment variables
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app,https://another-domain.com
CORS_ALLOW_CREDENTIALS=True

# For debugging only (NOT for production):
# CORS_ALLOW_ALL_ORIGINS=True
```

#### 4. Gunicorn Timeout
**Error**: `Worker timeout`

**Solution**:
```bash
# Increase timeout in environment variables
GUNICORN_TIMEOUT=600

# Or in Procfile/start command
gunicorn --timeout 600 --worker-class gevent dashboard.wsgi:application
```

#### 5. Memory Issues
**Error**: `MemoryError` or workers killed

**Solution**:
```bash
# Reduce workers
GUNICORN_WORKERS=1

# Disable preload (uses less memory)
# Remove --preload-app from gunicorn command

# Optimize queries - use select_related() and prefetch_related()
```

### Frontend Issues

#### 1. API Connection Failed
**Error**: `Network Error` or `Failed to fetch`

**Solution**:
```javascript
// Check apiConfig.ts has correct Railway URL
console.log('API URL:', API_CONFIG.getBaseUrl());

// Verify CORS is configured on backend
// Check browser console for CORS errors
```

#### 2. Build Failures
**Error**: `Module not found` or `Type error`

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run lint

# Test build locally
npm run build
```

#### 3. Routing Issues (404 on Refresh)
**Error**: 404 when refreshing page

**Solution**:
Ensure `vercel.json` has correct rewrites (see Frontend Step 3)

#### 4. Environment Variables Not Working
**Error**: `undefined` environment variables

**Solution**:
```bash
# Vercel only exposes VITE_ prefixed variables
# Change from: REACT_APP_API_URL
# To: VITE_API_URL

# Access with: import.meta.env.VITE_API_URL
# NOT: process.env.VITE_API_URL
```

### Common Deployment Issues

#### 1. "Application Error" on Railway
Check logs:
```bash
railway logs
```

Common causes:
- Missing environment variables
- Database migration not run
- Port binding issues (ensure using `$PORT`)

#### 2. Vercel Deployment Stuck
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Try manual build locally: `npm run build`

#### 3. Email Not Sending
```python
# Test email configuration
python manage.py shell

from django.core.mail import send_mail
send_mail(
    'Test Subject',
    'Test Message',
    'Team.Sniperthink@gmail.com',
    ['recipient@example.com'],
    fail_silently=False,
)
```

---

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] Generate new SECRET_KEY
- [ ] Set DEBUG=False
- [ ] Configure ALLOWED_HOSTS
- [ ] Update CORS_ALLOWED_ORIGINS
- [ ] Test database connection
- [ ] Verify email configuration
- [ ] Update frontend API URLs
- [ ] Remove test dependencies from requirements.txt
- [ ] Create .env files for both environments

### Backend (Railway)
- [ ] Create Railway project
- [ ] Connect GitHub repository
- [ ] Set environment variables
- [ ] Configure start command
- [ ] Deploy application
- [ ] Run database migrations
- [ ] Create superuser
- [ ] Run collectstatic
- [ ] Create cache table
- [ ] Test API endpoints
- [ ] Setup custom domain (optional)

### Frontend (Vercel)
- [ ] Update apiConfig.ts with Railway URL
- [ ] Create vercel.json
- [ ] Update hardcoded localhost URLs
- [ ] Set VITE_API_URL environment variable
- [ ] Deploy to Vercel
- [ ] Test authentication flow
- [ ] Verify routing works on refresh
- [ ] Setup custom domain (optional)

### Post-Deployment
- [ ] Update backend CORS with Vercel URL
- [ ] Test complete user flow (register → login → dashboard)
- [ ] Test Excel upload functionality
- [ ] Test multi-tenant features
- [ ] Setup monitoring/alerts
- [ ] Configure database backups
- [ ] Document deployment for team
- [ ] Test email verification flow
- [ ] Test password reset flow

---

## 🎯 Quick Deployment Summary

### Backend (Railway) - 5 Minutes
```bash
1. Create Railway project from GitHub
2. Set environment variables (copy from checklist)
3. Deploy with start command: gunicorn --config gunicorn_config.py dashboard.wsgi:application
4. Run: railway run python manage.py migrate
5. Create superuser: railway run python manage.py createsuperuser
```

### Frontend (Vercel) - 3 Minutes
```bash
1. Update src/config/apiConfig.ts with Railway URL
2. Create vercel.json
3. Import project to Vercel from GitHub
4. Set VITE_API_URL=https://your-project.railway.app
5. Deploy automatically
```

### Final Steps - 2 Minutes
```bash
1. Update Railway CORS_ALLOWED_ORIGINS with Vercel URL
2. Test login at https://your-project.vercel.app
3. Celebrate! 🎉
```

---

## 📞 Support Resources

- **Railway Docs**: https://docs.railway.app/
- **Vercel Docs**: https://vercel.com/docs
- **Django Deployment**: https://docs.djangoproject.com/en/5.2/howto/deployment/
- **Vite Deployment**: https://vitejs.dev/guide/static-deploy.html

---

## 🔐 Security Notes

1. **Never commit .env files** - Added to .gitignore ✓
2. **Use environment variables** for all secrets ✓
3. **Rotate SECRET_KEY** after deployment ✓
4. **Enable HTTPS** - Railway & Vercel provide automatic SSL ✓
5. **Set DEBUG=False** in production ✓
6. **Restrict CORS** to specific origins ✓
7. **Use strong passwords** for database and admin accounts
8. **Regular security updates** - Monitor dependencies
9. **Setup logging** - Monitor for suspicious activity
10. **Backup database** regularly

---

**Document Version**: 1.0  
**Last Updated**: November 1, 2025  
**Prepared For**: HRMS Deployment to Vercel + Railway
