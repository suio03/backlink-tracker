# Backlink Tracker - Docker Deployment Guide

Complete guide for deploying the Backlink Tracker application using Docker and Dokploy.

## Prerequisites

- Docker and Docker Compose installed on your server
- Dokploy set up and running
- Domain name configured (optional but recommended)

## Quick Start

### 1. Environment Setup

Copy the environment template and configure your settings:

```bash
cp env.example .env
```

Edit `.env` file with your configuration:

```bash
# Database Configuration
POSTGRES_DB=backlink_tracker
POSTGRES_USER=backlink_user
POSTGRES_PASSWORD=your_super_secure_password_here

# Application Database URL
DATABASE_URL=postgresql://backlink_user:your_super_secure_password_here@postgres:5432/backlink_tracker

# Application Configuration
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Security Configuration (generate secure keys!)
NEXTAUTH_SECRET=your_32_character_secret_key_here
NEXTAUTH_URL=https://your-domain.com
```

### 2. Generate Secure Keys

Generate a secure NextAuth secret:

```bash
# Option 1: Using openssl
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Local Testing (Optional)

Test the setup locally before deployment:

```bash
# Install dependencies
npm install

# Build and run with Docker Compose
docker-compose up --build

# Access the application
open http://localhost:3000
```

### 4. Dokploy Deployment

#### Method A: Git Repository (Recommended)

1. **Push your code to a Git repository** (GitHub, GitLab, etc.)

2. **Create a new project in Dokploy:**
   - Go to your Dokploy dashboard
   - Create new application
   - Select "Docker Compose" deployment type
   - Connect your Git repository

3. **Configure environment variables in Dokploy:**
   - Add all variables from your `.env` file
   - Make sure to use strong passwords for production

4. **Deploy:**
   - Dokploy will automatically build and deploy your application
   - The PostgreSQL database will be initialized with schema and seed data

#### Method B: Manual Upload

1. **Prepare deployment files:**
   ```bash
   # Create a deployment package
   tar -czf backlink-tracker.tar.gz \
     --exclude=node_modules \
     --exclude=.next \
     --exclude=.git \
     .
   ```

2. **Upload to your server and extract**

3. **Deploy with Dokploy using the docker-compose.yml file**

## Database Management

### Initial Setup

The database will be automatically initialized with:
- Complete schema (tables, indexes, triggers)
- Sample data (5 AI tool websites + 50 real directory resources)
- Auto-linking functionality enabled

### Manual Database Operations

If you need to run manual database operations:

```bash
# Connect to the PostgreSQL container
docker exec -it backlink-postgres psql -U backlink_user -d backlink_tracker

# View data
\dt  -- List tables
SELECT COUNT(*) FROM websites;
SELECT COUNT(*) FROM resources;
SELECT COUNT(*) FROM backlinks;

# Reset database (if needed)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\i /docker-entrypoint-initdb.d/01-schema.sql
\i /docker-entrypoint-initdb.d/02-seed.sql
```

### Backup and Restore

```bash
# Backup
docker exec backlink-postgres pg_dump -U backlink_user backlink_tracker > backup.sql

# Restore
docker exec -i backlink-postgres psql -U backlink_user backlink_tracker < backup.sql
```

## Monitoring and Maintenance

### Health Checks

The application includes built-in health checks:

- **Application health:** `https://your-domain.com/api/health`
- **Docker health checks:** Configured in docker-compose.yml

### Logs

View application logs:

```bash
# All services
docker-compose logs -f

# Application only
docker-compose logs -f app

# Database only
docker-compose logs -f postgres
```

### Updates

To update the application:

1. **Pull latest code** (if using Git integration)
2. **Rebuild in Dokploy** or manually:
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

## Configuration

### Domain Configuration

1. **Update environment variables:**
   ```bash
   NEXTAUTH_URL=https://your-domain.com
   ```

2. **Configure Dokploy** to handle SSL and domain routing

3. **Update Next.js config** if needed:
   ```javascript
   // next.config.js
   images: {
     domains: ['your-domain.com'],
   }
   ```

### Scaling

For higher loads, you can scale the application:

```bash
# Scale application instances
docker-compose up --scale app=3
```

Note: Database should remain as single instance for data consistency.

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   - Check DATABASE_URL format
   - Ensure PostgreSQL container is healthy
   - Verify network connectivity between containers

2. **Environment variables not loading:**
   - Check .env file syntax
   - Ensure variables are properly set in Dokploy
   - Restart containers after changes

3. **Build failures:**
   - Check Docker logs: `docker-compose logs app`
   - Verify all dependencies in package.json
   - Ensure sufficient disk space

4. **Permission issues:**
   - Check file ownership in containers
   - Verify PostgreSQL data directory permissions

### Debug Commands

```bash
# Check container status
docker-compose ps

# Inspect container configuration
docker inspect backlink-app
docker inspect backlink-postgres

# Test database connectivity
docker exec backlink-postgres pg_isready -U backlink_user

# Check application health
curl http://localhost:3000/api/health
```

## Security Considerations

1. **Use strong passwords** for database and NextAuth secret
2. **Enable SSL/HTTPS** in production
3. **Regular backups** of database
4. **Keep containers updated** with security patches
5. **Limit database access** to application containers only
6. **Monitor logs** for suspicious activity

## Support

If you encounter issues:

1. Check the logs first: `docker-compose logs`
2. Verify environment configuration
3. Test database connectivity
4. Review Dokploy deployment logs

The application includes comprehensive error handling and logging to help diagnose issues quickly. 