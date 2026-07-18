#!/bin/bash

# Acceptance Test Runner Script
# This script helps run acceptance tests with different configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PLONE_URL="${PLONE_TEST_URL:-https://plone-intranet.kitconcept.com}"
PLONE_USER="${PLONE_TEST_USER:-admin}"
PLONE_PASS="${PLONE_TEST_PASS:-admin}"
SKIP_CLEANUP="${SKIP_CLEANUP:-false}"
TIMEOUT="${TIMEOUT:-300}"

# Print usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL        Plone site URL (default: $PLONE_URL)"
    echo "  -U, --user USER      Username (default: $PLONE_USER)"
    echo "  -P, --pass PASS      Password (default: $PLONE_PASS)"
    echo "  -s, --skip-cleanup   Skip cleanup (keep test pages)"
    echo "  -t, --timeout SEC    Test timeout in seconds (default: $TIMEOUT)"
    echo "  -d, --docker         Run against local Docker Plone"
    echo "  -h, --help          Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run with defaults"
    echo "  $0 --skip-cleanup                    # Keep test pages for debugging"
    echo "  $0 --url http://localhost:8080/Plone # Test against local Plone"
    echo "  $0 --docker                          # Start Docker Plone and test"
    echo ""
    echo "Environment variables:"
    echo "  PLONE_TEST_URL, PLONE_TEST_USER, PLONE_TEST_PASS, SKIP_CLEANUP"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            PLONE_URL="$2"
            shift 2
            ;;
        -U|--user)
            PLONE_USER="$2"
            shift 2
            ;;
        -P|--pass)
            PLONE_PASS="$2"
            shift 2
            ;;
        -s|--skip-cleanup)
            SKIP_CLEANUP="true"
            shift
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -d|--docker)
            DOCKER_MODE="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to start Docker Plone
start_docker_plone() {
    print_status "Starting Docker Plone..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Stop any existing Plone containers
    docker stop plone-test 2>/dev/null || true
    docker rm plone-test 2>/dev/null || true
    
    # Start new Plone container
    docker run -d \
        --name plone-test \
        -p 8080:8080 \
        -e SITE_ID=Plone \
        -e ADMIN_USER=admin \
        -e ADMIN_PASSWORD=admin \
        -e CORS_ALLOW_ORIGIN="*" \
        plone/plone-backend:6.0
    
    # Wait for Plone to be ready
    print_status "Waiting for Plone to be ready..."
    timeout 300 bash -c 'until curl -f http://localhost:8080/Plone >/dev/null 2>&1; do sleep 5; done'
    
    PLONE_URL="http://localhost:8080/Plone"
    PLONE_USER="admin"
    PLONE_PASS="admin"
    
    print_success "Docker Plone is ready at $PLONE_URL"
}

# Function to cleanup Docker
cleanup_docker() {
    if [ "$DOCKER_MODE" = "true" ]; then
        print_status "Stopping Docker Plone..."
        docker stop plone-test 2>/dev/null || true
        docker rm plone-test 2>/dev/null || true
    fi
}

# Function to run tests
run_tests() {
    print_status "Running acceptance tests..."
    print_status "Target: $PLONE_URL"
    print_status "User: $PLONE_USER"
    print_status "Cleanup: $([ "$SKIP_CLEANUP" = "true" ] && echo "disabled" || echo "enabled")"
    
    # Export environment variables for the test
    export PLONE_TEST_URL="$PLONE_URL"
    export PLONE_TEST_USER="$PLONE_USER"
    export PLONE_TEST_PASS="$PLONE_PASS"
    export SKIP_CLEANUP="$SKIP_CLEANUP"
    export CI="true"  # Enable CI mode for better logging
    
    # Build if needed
    if [ ! -f "dist/plone-client.js" ]; then
        print_status "Building project..."
        npm run build
    fi
    
    # Run the test with timeout (handle macOS/Linux differences)
    if command -v gtimeout >/dev/null 2>&1; then
        TIMEOUT_CMD="gtimeout"
    elif command -v timeout >/dev/null 2>&1; then
        TIMEOUT_CMD="timeout"
    else
        # No timeout command available, run without timeout
        TIMEOUT_CMD=""
    fi
    
    if [ -n "$TIMEOUT_CMD" ]; then
        if $TIMEOUT_CMD "$TIMEOUT" npm run test:acceptance:hello-world-direct; then
            print_success "Acceptance tests passed!"
            return 0
        else
            print_error "Acceptance tests failed!"
            return 1
        fi
    else
        # Run without timeout
        if npm run test:acceptance:hello-world-direct; then
            print_success "Acceptance tests passed!"
            return 0
        else
            print_error "Acceptance tests failed!"
            return 1
        fi
    fi
}

# Main execution
main() {
    print_status "Starting acceptance test run..."
    
    # Trap to ensure cleanup happens
    trap cleanup_docker EXIT
    
    # Start Docker if requested
    if [ "$DOCKER_MODE" = "true" ]; then
        start_docker_plone
    fi
    
    # Run tests
    if run_tests; then
        print_success "All tests completed successfully!"
        exit 0
    else
        print_error "Tests failed!"
        exit 1
    fi
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || ! grep -q "plone-mcp" package.json; then
    print_error "Please run this script from the plone-mcp project root directory"
    exit 1
fi

# Run main function
main