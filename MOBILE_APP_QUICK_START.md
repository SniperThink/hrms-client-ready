# Mobile App Quick Start Guide

## 🎯 Overview

This document provides a quick reference for scaffolding a mobile app based on the HRMS Tally Dashboard web application.

## 📋 Quick Reference

### Tech Stack Recommendation
- **React Native (Expo)** or **Flutter**
- **State Management**: Redux Toolkit (RN) or Riverpod (Flutter)
- **Navigation**: React Navigation v6 (RN) or GoRouter (Flutter)
- **HTTP**: Axios with interceptors
- **UI**: React Native Paper (RN) or Material Design 3 (Flutter)

### Key Features
1. Multi-tenant architecture with tenant subdomain header
2. JWT authentication with auto-refresh
3. Single session enforcement
4. Progressive data loading
5. Offline support with local caching

### Core Screens
1. **Auth**: Login, Signup, Forgot Password
2. **Overview**: Dashboard with stats and charts
3. **Employees**: Directory, Details, Add/Edit
4. **Attendance**: Tracker (calendar), Log (list), Entry
5. **Payroll**: Overview, Monthly list, Details, Advance Manager
6. **More**: Leaves, Holidays, Team, Settings, Support

### API Base URL
- **Development**: `http://localhost:8000`
- **Production**: Set via environment variable

### Authentication Headers
```javascript
{
  "Authorization": "Bearer <access_token>",
  "X-Tenant-Subdomain": "<tenant_subdomain>",
  "Content-Type": "application/json"
}
```

### Color Palette
- Primary: `#0B5E59` (Teal)
- Primary Dark: `#074E49`
- Accent: `#C2E812` (Lime Green)
- Background: `#FFFFFF`

### Key API Endpoints
- Login: `POST /api/public/login/`
- Employees: `GET /api/employees/`
- Attendance: `GET /api/attendance/`
- Payroll: `GET /api/payroll/monthly/`
- Dashboard: `GET /api/dashboard/stats/`

## 📖 Full Documentation

For complete details, see: **`MOBILE_APP_SCAFFOLDING_PROMPT.md`**

That document includes:
- Complete API endpoint list
- Data model definitions
- UI/UX design system
- State management structure
- Implementation checklist
- Security requirements
- Code examples

## 🚀 Getting Started

1. **Read the full prompt**: `MOBILE_APP_SCAFFOLDING_PROMPT.md`
2. **Set up project**: React Native (Expo) or Flutter
3. **Configure API**: Set base URL and headers
4. **Implement auth**: Login, token management, secure storage
5. **Build screens**: Follow the navigation hierarchy
6. **Add features**: Progressive loading, offline support, etc.

## 💡 Pro Tips

1. **Start with authentication** - Everything depends on it
2. **Use the same API structure** - Don't reinvent the wheel
3. **Match the web UI** - Keep design consistent
4. **Implement progressive loading** - Essential for large datasets
5. **Handle offline gracefully** - Cache data and queue actions
6. **Test with real backend** - Use the actual API endpoints

---

**For detailed implementation guide, refer to `MOBILE_APP_SCAFFOLDING_PROMPT.md`**

