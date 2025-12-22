# Production Configuration Guide

## Environment Variables Setup

### Backend Configuration (`/app/backend/.env`)

```env
# Database Configuration
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"

# Security Configuration
JWT_SECRET_KEY="feWfN9igT1P1NpiWI3_M1WK_bpK1JZzbY9nbfu81gLI"

# CORS Configuration
CORS_ORIGINS="https://erp-dashboard-62.preview.emergentagent.com,http://localhost:3000,https://localhost:3000"
```

### Frontend Configuration (`/app/frontend/.env`)

```env
REACT_APP_BACKEND_URL=https://erp-dashboard-62.preview.emergentagent.com
WDS_SOCKET_PORT=443
```

---

## Production Deployment Checklist

### ✅ Security Configuration (COMPLETED)
- [x] JWT_SECRET_KEY configured with secure random key
- [x] CORS_ORIGINS limited to specific domains
- [x] No hardcoded URLs in code
- [x] Password hashing with bcrypt enabled

### ⚠️ For External Deployment

When deploying to external platforms (Vercel, Railway, etc.), update these values:

#### Backend Environment Variables:
```env
# Replace with your MongoDB Atlas connection string
MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net/database"

# Keep the same secret key or generate a new one
JWT_SECRET_KEY="feWfN9igT1P1NpiWI3_M1WK_bpK1JZzbY9nbfu81gLI"

# Update with your actual frontend domain(s)
CORS_ORIGINS="https://your-frontend-domain.vercel.app,https://www.your-domain.com"
```

#### Frontend Environment Variables:
```env
# Update with your actual backend API URL
REACT_APP_BACKEND_URL=https://your-backend-api.railway.app
```

---

## Generating New SECRET_KEY

If you need to generate a new secret key, run:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## CORS Configuration

Current allowed origins:
- https://erp-dashboard-62.preview.emergentagent.com (Production on Emergent)
- http://localhost:3000 (Local development)
- https://localhost:3000 (Local development with SSL)

To add more domains for production:
```env
CORS_ORIGINS="https://domain1.com,https://domain2.com,https://www.domain1.com"
```

---

## Security Notes

1. **Never commit `.env` files to Git**
   - Already in .gitignore
   - Manually configure on deployment platforms

2. **JWT_SECRET_KEY**
   - Must be at least 32 characters
   - Should be different for each environment (dev, staging, prod)
   - Never share publicly

3. **CORS_ORIGINS**
   - Only include trusted domains
   - Avoid using "*" in production
   - Include both www and non-www versions if needed

---

## Testing Production Configuration

### Test Authentication:
```bash
curl -X POST https://your-api-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Test CORS:
```bash
curl -I -X OPTIONS https://your-api-domain.com/api/ \
  -H "Origin: https://your-frontend-domain.com"
```

Should return:
```
access-control-allow-origin: https://your-frontend-domain.com
```

---

## Deployment Platforms Recommendations

### Frontend (React):
- **Vercel** - Recommended, automatic deployments from GitHub
- **Netlify** - Alternative, similar features
- **DigitalOcean App Platform** - Full control option

### Backend (FastAPI):
- **Railway** - Recommended, easy Python deployment
- **Render** - Alternative, free tier available
- **DigitalOcean App Platform** - Full control option

### Database (MongoDB):
- **MongoDB Atlas** - Recommended, 512MB free tier
- **DigitalOcean Managed MongoDB** - Paid, more control

---

## Post-Deployment Verification

After deployment, verify:

1. ✅ Frontend loads correctly
2. ✅ Login functionality works
3. ✅ API calls succeed (check browser console)
4. ✅ CORS headers are correct
5. ✅ Multi-tenant isolation working
6. ✅ RBAC permissions enforced
7. ✅ Mobile responsive design working
8. ✅ All modules accessible

---

## Monitoring & Maintenance

### Recommended Tools:
- **Sentry** - Error tracking and monitoring
- **LogRocket** - Frontend monitoring
- **Uptime Robot** - Uptime monitoring
- **Google Analytics** - Usage analytics

### Regular Tasks:
- Weekly database backups
- Monthly security updates
- Monitor error logs
- Check performance metrics

---

## Support & Documentation

- **Technical Support**: Discord - https://discord.gg/VzKfwCXC4A
- **Email Support**: support@emergent.sh
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **React Docs**: https://react.dev

---

**Last Updated**: January 2025
**Configuration Version**: 1.0
**Status**: Production Ready ✅
