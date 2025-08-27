# 🚀 Render Deployment Guide

## Prerequisites
- Render account
- GitHub repository connected to Render

## Step 1: Create PostgreSQL Database

1. Go to Render Dashboard
2. Click "New" → "PostgreSQL"
3. Choose a name (e.g., "dystopian-exchange-db")
4. Select your preferred region
5. Choose the free plan for development
6. Note down the connection details

## Step 2: Deploy Backend Service

1. Go to Render Dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:

### **Basic Settings**
- **Name**: `dystopian-exchange-backend`
- **Environment**: `Node`
- **Region**: Same as your database
- **Branch**: `main` (or your default branch)

### **Build & Deploy Settings**
- **Build Command**: `npm run install-all`
- **Start Command**: `npm start`
- **Plan**: Free (or paid for better performance)

### **Environment Variables**
Add these environment variables in the Render dashboard:

```
DB_USER=your_db_user_from_step_1
DB_HOST=your_db_host_from_step_1
DB_NAME=dystopian_exchange
DB_PASSWORD=your_db_password_from_step_1
DB_PORT=5432
NODE_ENV=production
PORT=10000
```

**Note**: Replace the DB_* values with the actual connection details from your PostgreSQL database in Step 1.

## Step 3: Deploy Frontend Service

1. Go to Render Dashboard
2. Click "New" → "Static Site"
3. Connect your GitHub repository
4. Configure the service:

### **Basic Settings**
- **Name**: `dystopian-exchange-frontend`
- **Environment**: `Static Site`
- **Region**: Same as your backend

### **Build & Deploy Settings**
- **Build Command**: `npm run install-all && npm run build`
- **Publish Directory**: `client/dist`

### **Environment Variables**
Add this environment variable:

```
VITE_API_URL=https://your-backend-service-name.onrender.com
```

**Note**: Replace `your-backend-service-name` with the actual name you used in Step 2.

## Step 4: Update Backend CORS

After deploying the frontend, update the backend's `CLIENT_URL` environment variable:

```
CLIENT_URL=https://your-frontend-service-name.onrender.com
```

## Step 5: Initialize Database

1. Go to your backend service in Render
2. Click on "Shell"
3. Run the database setup command:
   ```bash
   npm run db:setup
   ```

## Step 6: Test Your Deployment

1. Visit your frontend URL
2. Try registering a new user
3. Check if the backend API is responding

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify all DB_* environment variables are correct
   - Check if the database is running
   - Ensure the database name exists

2. **CORS Errors**
   - Verify CLIENT_URL is set correctly in backend
   - Check that the frontend URL matches exactly

3. **Build Failures**
   - Check the build logs in Render
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

### Environment Variable Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DB_USER` | PostgreSQL username | Yes | - |
| `DB_HOST` | PostgreSQL host | Yes | - |
| `DB_NAME` | Database name | Yes | `dystopian_exchange` |
| `DB_PASSWORD` | PostgreSQL password | Yes | - |
| `DB_PORT` | PostgreSQL port | No | `5432` |
| `PORT` | Server port | No | `3001` |
| `NODE_ENV` | Environment | No | `development` |
| `CLIENT_URL` | Frontend URL for CORS | Yes (prod) | `http://localhost:5173` |
| `VITE_API_URL` | Backend API URL | Yes (prod) | `http://localhost:3001` |

## Cost Estimation

- **Free Tier**: $0/month (limited resources)
- **Paid Tier**: ~$7/month for better performance
- **Database**: Free tier available

## Next Steps (Phase 2)

After successful deployment, consider:
- Setting up custom domains
- Adding SSL certificates
- Implementing monitoring and logging
- Setting up CI/CD pipelines
- Adding environment-specific configurations