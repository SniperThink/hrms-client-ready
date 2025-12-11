# HRMS Mobile App

React Native mobile application for HRMS Tally Dashboard, built with Expo Router.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS) or Android Studio (for Android)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure API URL:
   - Update `constants/Config.ts` with your backend API URL
   - Or set environment variable: `EXPO_PUBLIC_API_URL=http://your-api-url.com`

3. Start the development server:
```bash
npm start
```

4. Run on your preferred platform:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your device

## 📱 Features

### ✅ Implemented
- Authentication (Login, Signup, Forgot Password)
- Redux state management
- API service layer with token refresh
- Secure storage for tokens
- Dashboard/Overview screen
- Navigation structure (Tabs)
- Settings/More screen with logout

### 🚧 In Progress / Coming Soon
- Employee management (List, Details, Add/Edit)
- Attendance tracking (Calendar, Log, Entry)
- Payroll management (Overview, Details, Advance Manager)
- Leave management
- Holiday management
- User/Team management
- Charts and visualizations
- Offline support
- Push notifications

## 📁 Project Structure

```
hrms-mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication stack
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/            # Main app tabs
│   │   ├── index.tsx      # Dashboard
│   │   ├── employees.tsx
│   │   ├── attendance.tsx
│   │   ├── payroll.tsx
│   │   └── more.tsx
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
├── constants/             # App constants
│   ├── Colors.ts         # Color palette
│   └── Config.ts          # API configuration
├── services/              # API services
│   ├── api.ts            # Axios instance & interceptors
│   └── authService.ts    # Authentication service
├── store/                 # Redux store
│   ├── index.ts          # Store configuration
│   ├── slices/           # Redux slices
│   └── hooks.ts          # Typed hooks
├── types/                 # TypeScript types
│   └── index.ts
└── utils/                 # Utilities
    └── storage.ts        # Secure storage utilities
```

## 🔧 Configuration

### API Configuration

Update `constants/Config.ts`:

```typescript
export const API_BASE_URL = 'http://your-backend-url.com';
```

### Environment Variables

Create `.env` file (optional):

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

## 🔐 Authentication

The app uses JWT authentication with automatic token refresh:

- Access tokens stored in secure storage
- Automatic token refresh on 401 errors
- Multi-tenant support via `X-Tenant-Subdomain` header
- Session management

## 📦 Dependencies

### Core
- `expo` - Expo SDK
- `expo-router` - File-based routing
- `react-native` - React Native framework

### State Management
- `@reduxjs/toolkit` - Redux Toolkit
- `react-redux` - React bindings for Redux

### API & Storage
- Native `fetch` API - HTTP client (React Native built-in)
- `expo-secure-store` - Secure storage

### UI
- `react-native-paper` - Material Design components
- `@expo/vector-icons` - Icon library

### Utilities
- `date-fns` - Date manipulation
- `react-hook-form` - Form handling
- `yup` - Validation

## 🎨 Design System

The app follows the same design system as the web application:

- **Primary Color**: `#0B5E59` (Teal)
- **Accent Color**: `#C2E812` (Lime Green)
- **Font**: Poppins (when available)

See `constants/Colors.ts` for complete color palette.

## 🚀 Building for Production

### iOS
```bash
expo build:ios
```

### Android
```bash
expo build:android
```

## 📝 Development Notes

### Adding New Screens

1. Create screen file in appropriate directory:
   - `app/(auth)/` for authentication screens
   - `app/(tabs)/` for main app screens
   - `app/` for other screens

2. Add route in `_layout.tsx` if needed

3. Create service functions in `services/` if API calls needed

4. Add Redux slice in `store/slices/` if state management needed

### API Integration

All API calls should go through the `api` service in `services/api.ts`:

```typescript
import { api, API_ENDPOINTS } from '@/services/api';

const data = await api.get<DataType>(API_ENDPOINTS.employees);
```

### State Management

Use Redux Toolkit slices for state management:

```typescript
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const dispatch = useAppDispatch();
const employees = useAppSelector((state) => state.employees.employees);
```

## 🐛 Troubleshooting

### Common Issues

1. **Metro bundler cache issues**: Clear cache with `expo start -c`
2. **API connection errors**: Check `constants/Config.ts` for correct API URL
3. **Token refresh issues**: Ensure secure storage is properly configured
4. **Navigation errors**: Check Expo Router version compatibility

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Native Documentation](https://reactnative.dev/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript for all new files
3. Follow the design system in `constants/Colors.ts`
4. Write clear commit messages

## 📄 License

Same as the main HRMS project.

---

**Note**: This is a work in progress. Many features are still being implemented. Refer to the main HRMS web application for complete functionality reference.

