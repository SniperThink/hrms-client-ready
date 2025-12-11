# Starting Django Server for Mobile App Testing

## 🚀 Quick Start

To allow mobile app connections, start the Django server with:

```bash
python manage.py runserver 0.0.0.0:8000
```

**Important**: Use `0.0.0.0` instead of `127.0.0.1` or `localhost` so the server listens on all network interfaces.

## ✅ Configuration

The Django settings have been updated to:
- ✅ Allow all hosts when `DEBUG=True` (development mode)
- ✅ Allow all CORS origins in development
- ✅ Accept requests from any IP address in development

## 📱 Finding Your IP Address

To connect from a physical device, find your computer's IP:

```bash
# Linux/Mac
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or use:
hostname -I  # Linux
ipconfig getifaddr en0  # Mac (Wi-Fi)
ipconfig getifaddr en1  # Mac (Ethernet)

# Windows
ipconfig
```

Look for an IP like `192.168.x.x` or `10.x.x.x`.

## 🔧 Environment Variables (Optional)

If you want to restrict hosts even in development, set:

```bash
export ALLOWED_HOSTS="localhost,127.0.0.1,10.200.225.89,YOUR_IP"
```

## ⚠️ Security Note

The current configuration allows all hosts only when `DEBUG=True`. 

**For production:**
- Set `DEBUG=False`
- Set `ALLOWED_HOSTS` environment variable with specific domains
- Configure proper CORS origins

## 🐛 Troubleshooting

### Still getting "DisallowedHost" error?

1. **Check DEBUG mode:**
   ```python
   # In settings.py, ensure DEBUG is True for development
   DEBUG = config('DEBUG', default=True, cast=bool)
   ```

2. **Restart Django server:**
   ```bash
   # Stop the server (Ctrl+C) and restart:
   python manage.py runserver 0.0.0.0:8000
   ```

3. **Check firewall:**
   Make sure port 8000 is not blocked by firewall

4. **Verify server is listening:**
   ```bash
   netstat -an | grep 8000
   # Should show 0.0.0.0:8000, not 127.0.0.1:8000
   ```

