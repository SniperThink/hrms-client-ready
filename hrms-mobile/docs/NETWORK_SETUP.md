# Network Configuration Guide

## 🔧 Fixing "Network Request Failed" Error

### Common Causes:
1. **Using `localhost` on physical device** - Devices can't access `localhost` on your computer
2. **Android blocking HTTP** - Android blocks cleartext (HTTP) traffic by default
3. **Wrong IP address** - Need to use your computer's actual IP address

## ✅ Solutions

### For Development (Local Backend)

#### Option 1: Using Emulator/Simulator
- **iOS Simulator**: Use `http://localhost:8000` ✅ (Already configured)
- **Android Emulator**: Use `http://10.0.2.2:8000` ✅ (Already configured)

#### Option 2: Using Physical Device

1. **Find your computer's IP address:**
   ```bash
   # Linux/Mac
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```
   Look for something like `192.168.1.100` or `192.168.0.5`

2. **Set environment variable:**
   Create a `.env` file in the project root:
   ```bash
   EXPO_PUBLIC_API_URL=http://YOUR_IP_ADDRESS:8000
   ```
   Example: `EXPO_PUBLIC_API_URL=http://192.168.1.100:8000`

3. **Make sure your backend is accessible:**
   - Ensure your Django backend is running
   - Check that it's listening on `0.0.0.0:8000` (not just `127.0.0.1`)
   - Update Django settings if needed:
     ```python
     # In settings.py
     ALLOWED_HOSTS = ['*']  # For development only
     ```

4. **Restart Expo:**
   ```bash
   npx expo start --clear
   ```

### For Production

1. **Use HTTPS URL:**
   ```bash
   EXPO_PUBLIC_API_URL=https://your-api-domain.com
   ```

2. **Remove cleartext traffic permission** (in `app.json`):
   - Remove `"usesCleartextTraffic": true`
   - Remove or update `network_security_config.xml` to only allow HTTPS

## 🔍 Testing Network Connection

Add this to your app to test the connection:

```typescript
// Test API connection
const testConnection = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health/`);
    console.log('Connection successful:', response.status);
  } catch (error) {
    console.error('Connection failed:', error);
    console.log('API_BASE_URL:', API_BASE_URL);
  }
};
```

## 📝 Current Configuration

The app is configured to:
- ✅ Allow HTTP traffic on Android (for development)
- ✅ Use correct localhost URLs for emulators
- ✅ Support environment variable override

## 🚨 Important Notes

1. **Security**: The `usesCleartextTraffic: true` setting is for **development only**. Remove it in production.

2. **Firewall**: Make sure your firewall allows connections on port 8000.

3. **Same Network**: Your device and computer must be on the same Wi-Fi network.

4. **Backend CORS**: Ensure your Django backend allows requests from your device:
   ```python
   CORS_ALLOWED_ORIGINS = [
       'http://localhost:8081',  # Expo dev server
       'http://192.168.1.100:8081',  # Your IP
   ]
   ```

## 🐛 Troubleshooting

### Still getting "Network Request Failed"?

1. **Check API URL:**
   ```typescript
   console.log('API_BASE_URL:', API_BASE_URL);
   ```

2. **Test from device browser:**
   Open `http://YOUR_IP:8000/api/health/` in your device's browser

3. **Check backend logs:**
   See if requests are reaching your Django server

4. **Try ping:**
   From your device, try to ping your computer's IP address

5. **Rebuild app:**
   ```bash
   npx expo prebuild --clean
   npx expo run:android  # or run:ios
   ```

