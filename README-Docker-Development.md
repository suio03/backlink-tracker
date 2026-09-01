# Docker Development Environment with Hot Reload

This document explains how to set up and use the Docker development environment with hot reload functionality.

## 🚀 Quick Start

### 1. Start the Development Environment
```bash
./docker-dev.sh start
```
This will:
- Build the development Docker images
- Start PostgreSQL database with all data
- Start Next.js development server with hot reload
- Make the app accessible at http://localhost:3001

### 2. View Logs
```bash
./docker-dev.sh logs
```

### 3. Stop the Environment
```bash
./docker-dev.sh stop
```

## 📁 Files Created

### Development Docker Files
- **`Dockerfile.dev`** - Development optimized Dockerfile
- **`docker-compose.dev.yml`** - Development Docker Compose configuration
- **`docker-dev.sh`** - Helper script for managing development environment

### Key Differences from Production

| Feature | Production | Development |
|---------|------------|-------------|
| **Dockerfile** | Multi-stage optimized | Single stage with dev dependencies |
| **Code Changes** | Requires rebuild | ✅ **Hot reload enabled** |
| **Volume Mounting** | No source mounting | ✅ **Source code mounted** |
| **Dependencies** | Production only | All dependencies including dev |
| **Environment** | `NODE_ENV=production` | `NODE_ENV=development` |
| **Build Process** | Optimized build | Development server |

## 🔥 Hot Reload Features

### What Gets Hot Reloaded
- ✅ **React Components** - Instant updates
- ✅ **API Routes** - Server restarts automatically
- ✅ **Styles (CSS/Tailwind)** - Instant updates
- ✅ **TypeScript Files** - Compiled and updated
- ✅ **Configuration Files** - May require restart

### Volume Mounting Strategy
```yaml
volumes:
  # Mount entire source code
  - .:/app
  # Exclude node_modules (use container's version)
  - /app/node_modules
  # Exclude .next build directory
  - /app/.next
```

## 🛠️ Available Commands

### Helper commands
```bash
# Start development environment
./docker-dev.sh start

# Stop development environment
./docker-dev.sh stop

# View logs
./docker-dev.sh logs

# Restart environment
./docker-dev.sh restart

# Check status
./docker-dev.sh status

# Access container shell
./docker-dev.sh shell

# Production commands (for comparison)
docker compose -f docker-compose.yml up --build -d
docker compose -f docker-compose.yml down
```

### Direct Script Usage
```bash
# Using the script directly
./docker-dev.sh start
./docker-dev.sh stop
./docker-dev.sh logs
./docker-dev.sh restart
./docker-dev.sh status
./docker-dev.sh shell
./docker-dev.sh help
```

## 🔧 Environment Configuration

### Development Environment Variables
```bash
# Database
POSTGRES_DB=backlink_tracker
POSTGRES_USER=backlink_user
POSTGRES_PASSWORD=dev_password_123

# Application
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1

# Hot Reload (for Docker compatibility)
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true

# Database Connection
DATABASE_URL=postgresql://backlink_user:dev_password_123@postgres:5432/backlink_tracker?sslmode=disable
BACKLINK_EXTENSION_TOKEN=replace_with_a_local_test_token
OPENAI_API_KEY=replace_with_a_backend_only_test_key
OPENAI_CONTENT_MODEL=gpt-5-nano
```

## 🐛 troubleshooting

### Hot Reload Not Working?
1. **Check polling settings**: Some systems require polling for file watching in Docker
   ```yaml
   environment:
     CHOKIDAR_USEPOLLING: "true"
     WATCHPACK_POLLING: "true"
   ```

2. **Verify volume mounts**: Ensure source code is properly mounted
   ```bash
   docker exec -it backlink-app-dev ls -la /app
   ```

3. **Check logs**: Look for file watcher errors
   ```bash
   ./docker-dev.sh logs
   ```

### Database Issues?
1. **Clear database volume**: Start fresh
   ```bash
   docker volume rm backlink-tracker_postgres_data_dev
   ./docker-dev.sh start
   ```

2. **Check database connection**:
   ```bash
   docker exec -it backlink-postgres-dev psql -U backlink_user -d backlink_tracker
   ```

### Performance Issues?
1. **Exclude unnecessary files**: Add to `.dockerignore`
2. **Use bind mounts**: For better performance on some systems
3. **Increase Docker memory**: In Docker Desktop settings

## 📊 Development vs Production

### When to Use Each

**Use Development Setup (`docker:dev`) when:**
- ✅ Actively developing and need hot reload
- ✅ Testing database changes
- ✅ Debugging issues
- ✅ Making frequent code changes

**Use Production Setup (`docker:prod`) when:**
- ✅ Testing production builds
- ✅ Performance testing
- ✅ Final deployment testing
- ✅ Demonstrating to stakeholders

## 🚢 Deployment

The development setup is only for local development. For production deployment:

1. **Use production Docker setup**:
   ```bash
   docker compose -f docker-compose.yml up --build -d
   ```

2. **Or deploy to Dokploy/server**:
   - The production `Dockerfile` and `docker-compose.yml` are optimized for deployment
   - Environment variables should be set securely
   - Use proper database credentials

## 📝 Development Workflow

1. **Start development environment**:
   ```bash
   ./docker-dev.sh start
   ```

2. **Make code changes** - Hot reload automatically updates

3. **View logs if needed**:
   ```bash
   ./docker-dev.sh logs
   ```

4. **Access database directly if needed**:
   ```bash
   docker exec -it backlink-postgres-dev psql -U backlink_user -d backlink_tracker
   ```

5. **Stop when done**:
   ```bash
   ./docker-dev.sh stop
   ```

## 🎯 Benefits

- **⚡ Fast Development**: No rebuild required for code changes
- **🔄 Automatic Refresh**: Browser updates automatically
- **📦 Isolated Environment**: Consistent across all machines
- **🗄️ Real Database**: PostgreSQL with all real data
- **🛠️ Easy Management**: Simple npm scripts for all operations
- **🔧 Debugging**: Easy access to logs and container shell
