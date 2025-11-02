# 🚀 Railway Environment Variables Checklist

## ✅ Required Variables (Must Set in Railway Dashboard)

### 1. Django Core

- [x] **SECRET_KEY** - Generate new: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- [x] **DEBUG** = `False`
- [x] **ALLOWED_HOSTS** = `*.railway.app,hrms-client-ready-production.up.railway.app,hrms-client-ready.vercel.app,hrms-client-ready-sniperthinks-projects.vercel.app`

### 2. Database (Neon PostgreSQL)

- [x] **DATABASE_URL** = `postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require`

### 3. CORS Configuration ⚠️ **CRITICAL**

- [x] **CORS_ALLOWED_ORIGINS** = `https://hrms-client-ready.vercel.app,https://hrms-client-ready-sniperthinks-projects.vercel.app,https://hrms-client-ready-production.up.railway.app`
- [x] **CORS_ALLOW_ALL_ORIGINS** = `False`
- [x] **FORCE_CORS_ALL_ORIGINS** = `False`

### 4. Frontend Configuration

- [x] **FRONTEND_URL** = `https://hrms-client-ready.vercel.app`

### 5. Email (Gmail SMTP)

- [x] **EMAIL_BACKEND** = `django.core.mail.backends.smtp.EmailBackend`
- [x] **EMAIL_HOST** = `smtp.gmail.com`
- [x] **EMAIL_PORT** = `587`
- [x] **EMAIL_USE_TLS** = `True`
- [x] **EMAIL_HOST_USER** = `Team.Sniperthink@gmail.com`
- [x] **EMAIL_HOST_PASSWORD** = `sucf esxk namx mtwa`
- [x] **DEFAULT_FROM_EMAIL** = `Team.Sniperthink@gmail.com`

### 6. Celery (Optional - Currently Disabled)

- [x] **CELERY_ENABLED** = `False`

### 7. Security

- [x] **CSRF_TRUSTED_ORIGINS** = `https://*.railway.app,https://hrms-client-ready.vercel.app,https://hrms-client-ready-sniperthinks-projects.vercel.app`

### 8. Multi-tenant

- [x] **DEFAULT_TENANT_SUBDOMAIN** = `demo`

### 9. Auth Settings

- [x] **INVITATION_TOKEN_EXPIRY_HOURS** = `72`
- [x] **OTP_EXPIRY_MINUTES** = `10`

### 10. Gunicorn (Optional - Using defaults)

- [ ] **GUNICORN_WORKERS** = `4` (optional)
- [ ] **GUNICORN_TIMEOUT** = `120` (optional)
- [ ] **GUNICORN_WORKER_CLASS** = `sync` (optional - already in config)
- [ ] **GUNICORN_THREADS** = `4` (optional)

### 11. Logging

- [x] **LOG_LEVEL** = `INFO`

---

## 🔧 How to Set Variables in Railway

1. Go to [railway.app](https://railway.app)
2. Select your project: **hrms-client-ready**
3. Click on your service (backend)
4. Click **"Variables"** tab
5. Add each variable:
   - Click **"+ New Variable"**
   - Enter **Variable Name** (exactly as shown above)
   - Enter **Variable Value**
   - Click **"Add"**
6. Railway will auto-redeploy after changes

---

## ⚠️ Common Issues

### CORS Errors

**Symptom:** "No 'Access-Control-Allow-Origin' header"

**Fix:** Make sure `CORS_ALLOWED_ORIGINS` includes ALL these URLs (comma-separated, no spaces):

```
https://hrms-client-ready.vercel.app,https://hrms-client-ready-sniperthinks-projects.vercel.app,https://hrms-client-ready-production.up.railway.app
```

### ALLOWED_HOSTS Error

**Symptom:** "Invalid HTTP_HOST header"

**Fix:** Make sure `ALLOWED_HOSTS` includes:

```
*.railway.app,hrms-client-ready-production.up.railway.app,hrms-client-ready.vercel.app,hrms-client-ready-sniperthinks-projects.vercel.app
```

### Database Connection Failed

**Symptom:** "could not connect to server"

**Fix:** Verify `DATABASE_URL` has `?sslmode=require` at the end

---

## 📋 Quick Copy-Paste for Railway

```bash
# Core
SECRET_KEY=<generate-new-key>
DEBUG=False
ALLOWED_HOSTS=*.railway.app,hrms-client-ready-production.up.railway.app,hrms-client-ready.vercel.app,hrms-client-ready-sniperthinks-projects.vercel.app

# Database
DATABASE_URL=postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require

# CORS - CRITICAL!
CORS_ALLOWED_ORIGINS=https://hrms-client-ready.vercel.app,https://hrms-client-ready-sniperthinks-projects.vercel.app,https://hrms-client-ready-production.up.railway.app
FRONTEND_URL=https://hrms-client-ready.vercel.app

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=Team.Sniperthink@gmail.com
EMAIL_HOST_PASSWORD=sucf esxk namx mtwa
DEFAULT_FROM_EMAIL=Team.Sniperthink@gmail.com

# Security
CSRF_TRUSTED_ORIGINS=https://*.railway.app,https://hrms-client-ready.vercel.app,https://hrms-client-ready-sniperthinks-projects.vercel.app

# Other
CELERY_ENABLED=False
DEFAULT_TENANT_SUBDOMAIN=demo
INVITATION_TOKEN_EXPIRY_HOURS=72
OTP_EXPIRY_MINUTES=10
LOG_LEVEL=INFO
```

---

## ✅ Verification

After setting all variables:

1. **Check Deployment Logs** - Should see no errors
2. **Test CORS** - Open browser console at `https://hrms-client-ready.vercel.app`
3. **Test Login** - Should work without "Failed to fetch" errors
4. **Test API** - All endpoints should return data

---

**Last Updated:** November 2, 2025
