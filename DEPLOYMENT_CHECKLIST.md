# 📋 DEPLOYMENT CHECKLIST

## Pre-Deployment Tasks

### 🔐 Security
- [ ] Generate new SECRET_KEY (don't use default)
- [ ] Set DEBUG=False
- [ ] Review all environment variables for sensitive data
- [ ] Remove any hardcoded passwords/keys from code
- [ ] Verify .env files are in .gitignore ✓
- [ ] Change default database passwords
- [ ] Review ALLOWED_HOSTS configuration
- [ ] Setup CSRF_TRUSTED_ORIGINS

### 📦 Backend Preparation
- [ ] Update `requirements.txt` or use `requirements.production.txt`
- [ ] Test build locally: `pip install -r requirements.production.txt`
- [ ] Run migrations locally: `python manage.py migrate`
- [ ] Run `python manage.py check --deploy`
- [ ] Test collectstatic: `python manage.py collectstatic`
- [ ] Verify Procfile/start command
- [ ] Review gunicorn_config.py settings

### 🎨 Frontend Preparation
- [ ] Update `src/config/apiConfig.ts` ✓
- [ ] Update hardcoded localhost URLs ✓
- [ ] Create `vercel.json` ✓
- [ ] Create `.env.production` ✓
- [ ] Test build locally: `npm run build`
- [ ] Check for console errors in build
- [ ] Verify all dependencies in package.json

### 🗄️ Database
- [ ] Backup current database
- [ ] Verify Neon PostgreSQL connection
- [ ] Test connection string with psql
- [ ] Document current schema version
- [ ] Plan migration strategy

---

## Railway Backend Deployment

### 📝 Account Setup
- [ ] Create Railway account
- [ ] Connect GitHub repository
- [ ] Verify billing/credit setup

### 🚀 Project Creation
- [ ] Create new Railway project
- [ ] Select GitHub repository
- [ ] Set root directory: `backend-tally-dashboard`
- [ ] Configure start command

### 🔧 Configuration
- [ ] Copy all variables from `.env.railway`
- [ ] Generate and set new SECRET_KEY
- [ ] Set DEBUG=False
- [ ] Configure ALLOWED_HOSTS
- [ ] Set DATABASE_URL (Neon)
- [ ] Set EMAIL configuration
- [ ] Set CELERY_ENABLED=False (initially)
- [ ] Verify PORT is set by Railway

### 🎯 First Deployment
- [ ] Trigger initial deployment
- [ ] Monitor build logs
- [ ] Wait for successful deployment
- [ ] Note Railway URL

### 🗃️ Database Setup
- [ ] Run: `railway run python manage.py migrate`
- [ ] Run: `railway run python manage.py createcachetable`
- [ ] Run: `railway run python manage.py createsuperuser`
- [ ] Run: `railway run python manage.py collectstatic --noinput`
- [ ] Verify database tables created

### ✅ Backend Testing
- [ ] Access Railway URL in browser
- [ ] Check admin panel: `/admin/`
- [ ] Test API health endpoint: `/api/health/`
- [ ] Test CORS preflight request
- [ ] Check Railway logs for errors
- [ ] Test database connection
- [ ] Verify static files loading

---

## Vercel Frontend Deployment

### 📝 Account Setup
- [ ] Create Vercel account
- [ ] Connect GitHub repository

### 🎨 Frontend Updates
- [ ] Update VITE_API_URL in `.env.production`
- [ ] Replace placeholder URL with Railway URL
- [ ] Update `src/config/apiConfig.ts` if needed
- [ ] Commit and push changes

### 🚀 Project Creation
- [ ] Import project from GitHub
- [ ] Select correct repository
- [ ] Set root directory: `frontend-tally-dashboard`
- [ ] Framework: Vite
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`

### 🔧 Configuration
- [ ] Set VITE_API_URL environment variable
- [ ] Set to Railway backend URL
- [ ] Apply to Production environment

### 🎯 First Deployment
- [ ] Trigger deployment
- [ ] Monitor build logs
- [ ] Wait for successful deployment
- [ ] Note Vercel URL

### ✅ Frontend Testing
- [ ] Access Vercel URL in browser
- [ ] Check for console errors
- [ ] Test page routing
- [ ] Test page refresh (routing)
- [ ] Verify assets loading

---

## Integration & Final Configuration

### 🔗 Connect Frontend & Backend
- [ ] Copy Vercel URL
- [ ] Update Railway CORS_ALLOWED_ORIGINS
- [ ] Update Railway FRONTEND_URL
- [ ] Redeploy backend (auto-redeploys)
- [ ] Wait for backend restart

### 🧪 End-to-End Testing
- [ ] Open Vercel frontend URL
- [ ] Test user registration
- [ ] Verify email sending
- [ ] Test user login
- [ ] Check JWT token generation
- [ ] Test authentication flow
- [ ] Upload test Excel file
- [ ] View dashboard data
- [ ] Test all major features
- [ ] Test on mobile browser
- [ ] Test multi-tenant features

### 🔍 CORS Testing
- [ ] Open browser DevTools
- [ ] Check Network tab for CORS errors
- [ ] Verify preflight (OPTIONS) requests
- [ ] Test from different browsers
- [ ] Verify cookies/credentials work

### 📊 Performance Testing
- [ ] Check page load times
- [ ] Test with multiple users
- [ ] Monitor Railway metrics
- [ ] Check Vercel analytics
- [ ] Test under load (if needed)

---

## Post-Deployment Tasks

### 🎯 Optimization
- [ ] Enable Vercel Analytics
- [ ] Setup Railway monitoring
- [ ] Configure log retention
- [ ] Setup error tracking (Sentry)
- [ ] Review and optimize database indexes
- [ ] Setup CDN for static files (if needed)

### 🔐 Security Hardening
- [ ] Enable HTTPS (automatic on both platforms)
- [ ] Verify SSL certificates
- [ ] Test security headers
- [ ] Run security audit: `npm audit`
- [ ] Check for known vulnerabilities
- [ ] Review access logs
- [ ] Setup rate limiting (if needed)

### 📦 Backup Strategy
- [ ] Setup automated database backups
- [ ] Document backup procedure
- [ ] Test restore procedure
- [ ] Setup offsite backup storage
- [ ] Configure backup retention policy

### 📝 Documentation
- [ ] Document deployment URLs
- [ ] Create runbook for common issues
- [ ] Document environment variables
- [ ] Create rollback procedure
- [ ] Document monitoring setup
- [ ] Share access with team

### 👥 Team Setup
- [ ] Add team members to Railway
- [ ] Add team members to Vercel
- [ ] Setup notification channels
- [ ] Create deployment procedures
- [ ] Setup CI/CD (if needed)

---

## Custom Domain Setup (Optional)

### Railway Custom Domain
- [ ] Purchase domain (if needed)
- [ ] Add domain in Railway settings
- [ ] Create DNS CNAME record
- [ ] Wait for DNS propagation
- [ ] Verify SSL certificate
- [ ] Update ALLOWED_HOSTS
- [ ] Update CORS_ALLOWED_ORIGINS

### Vercel Custom Domain
- [ ] Add domain in Vercel settings
- [ ] Create DNS A/CNAME records
- [ ] Wait for DNS propagation
- [ ] Verify SSL certificate
- [ ] Update backend CORS settings

---

## Monitoring & Maintenance

### 📊 Regular Checks
- [ ] Setup uptime monitoring (UptimeRobot, etc.)
- [ ] Monitor Railway logs daily
- [ ] Check Vercel analytics weekly
- [ ] Review error logs
- [ ] Check database size/performance
- [ ] Monitor API response times

### 🔄 Regular Maintenance
- [ ] Weekly database backups
- [ ] Monthly dependency updates
- [ ] Quarterly security audits
- [ ] Review and rotate secrets
- [ ] Check SSL certificate expiry
- [ ] Review access logs

### 🚨 Incident Response
- [ ] Create incident response plan
- [ ] Document rollback procedure
- [ ] Setup alert notifications
- [ ] Create emergency contacts list
- [ ] Test disaster recovery

---

## Scaling Considerations

### When to Scale Backend
- [ ] Monitor Railway metrics
- [ ] Watch for high CPU usage (>80%)
- [ ] Watch for high memory usage (>80%)
- [ ] Monitor response times (>1s)
- [ ] Consider adding Redis for caching
- [ ] Consider enabling Celery workers

### Celery Setup (Future)
- [ ] Add Redis to Railway
- [ ] Update CELERY_ENABLED=True
- [ ] Update CELERY_BROKER_URL
- [ ] Deploy Celery worker service
- [ ] Deploy Celery beat service
- [ ] Test background tasks

### Database Scaling
- [ ] Monitor Neon metrics
- [ ] Consider read replicas
- [ ] Implement database caching
- [ ] Optimize slow queries
- [ ] Consider connection pooling

---

## Troubleshooting Checklist

### Backend Issues
- [ ] Check Railway logs: `railway logs`
- [ ] Verify environment variables
- [ ] Check database connection
- [ ] Verify migrations ran successfully
- [ ] Check static files collected
- [ ] Test API endpoints manually
- [ ] Review CORS configuration

### Frontend Issues
- [ ] Check Vercel build logs
- [ ] Check browser console errors
- [ ] Verify VITE_API_URL is set
- [ ] Test API connectivity
- [ ] Check network tab in DevTools
- [ ] Verify vercel.json configuration

### Common Issues
- [ ] CORS errors → Update CORS_ALLOWED_ORIGINS
- [ ] 404 on refresh → Check vercel.json rewrites
- [ ] Database errors → Check connection string
- [ ] Static files 404 → Run collectstatic
- [ ] Authentication fails → Check JWT settings
- [ ] Email not sending → Verify SMTP settings

---

## Success Criteria

### ✅ Deployment is Successful When:
- [ ] Frontend accessible at Vercel URL
- [ ] Backend accessible at Railway URL
- [ ] User registration works
- [ ] User login works
- [ ] Email verification works
- [ ] Excel upload works
- [ ] Dashboard displays data
- [ ] Multi-tenant features work
- [ ] No console errors
- [ ] No CORS errors
- [ ] All tests pass
- [ ] Performance is acceptable (<2s page load)
- [ ] Mobile responsive
- [ ] SSL certificates valid

---

## 🎉 Final Steps

- [ ] Announce deployment to team
- [ ] Update documentation with URLs
- [ ] Share login credentials securely
- [ ] Create user onboarding guide
- [ ] Schedule post-deployment review
- [ ] Celebrate successful deployment! 🚀

---

**Estimated Total Time**: 2-3 hours (including testing)

**Remember**: 
- Take your time with each step
- Don't skip security checks
- Test thoroughly before sharing with users
- Keep this checklist updated with your learnings

**Document your deployment**: Save URLs, credentials, and any issues encountered for future reference.
