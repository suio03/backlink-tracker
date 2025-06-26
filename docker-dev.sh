#!/bin/bash

# =====================================
# Docker Development Environment Helper
# =====================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment with hot reload..."
    check_docker
    
    # Stop any existing containers
    docker compose -f docker-compose.dev.yml down
    
    # Build and start services
    docker compose -f docker-compose.dev.yml up --build -d
    
    print_success "Development environment started!"
    print_status "Application will be available at: http://localhost:3001"
    print_status "Database is available at: localhost:5432"
    print_status ""
    print_status "Use 'npm run docker:dev:logs' to view logs"
    print_status "Use 'npm run docker:dev:stop' to stop the environment"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping development environment..."
    docker compose -f docker-compose.dev.yml down
    print_success "Development environment stopped!"
}

# Function to view logs
logs_dev() {
    print_status "Showing development environment logs..."
    docker compose -f docker-compose.dev.yml logs -f
}

# Function to rebuild and restart
restart_dev() {
    print_status "Restarting development environment..."
    stop_dev
    start_dev
}

# Function to show status
status_dev() {
    print_status "Development environment status:"
    docker compose -f docker-compose.dev.yml ps
}

# Function to access app container shell
shell_dev() {
    print_status "Opening shell in app container..."
    docker compose -f docker-compose.dev.yml exec app sh
}

# Function to show help
show_help() {
    echo "Docker Development Environment Helper"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the development environment with hot reload"
    echo "  stop      Stop the development environment"
    echo "  logs      Show logs from all services"
    echo "  restart   Restart the development environment"
    echo "  status    Show status of all services"
    echo "  shell     Open shell in the app container"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start      # Start development environment"
    echo "  $0 logs       # View logs"
    echo "  $0 stop       # Stop environment"
}

# Main script logic
case "${1:-start}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    logs)
        logs_dev
        ;;
    restart)
        restart_dev
        ;;
    status)
        status_dev
        ;;
    shell)
        shell_dev
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 