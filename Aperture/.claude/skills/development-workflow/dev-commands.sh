#!/bin/bash
# Development Workflow - Common Commands Script
# Quick access to frequently used development commands

set -e

PROJECT_DIR="projects/wizard-of-oz"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

function print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

function print_success() { echo -e "${GREEN}✅ $1${NC}"; }
function print_error() { echo -e "${RED}❌ $1${NC}"; }
function print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
function print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Verify project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Show menu if no command provided
if [ $# -eq 0 ]; then
    print_header "Development Workflow Commands"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Available commands:"
    echo "  dev       - Start development server"
    echo "  build     - Build for production"
    echo "  test      - Run type checking and build test"
    echo "  preview   - Preview production build"
    echo "  clean     - Clean and reinstall dependencies"
    echo "  status    - Check project and git status"
    echo ""
    exit 0
fi

COMMAND=$1

case $COMMAND in
    dev)
        print_header "Starting Development Server"
        cd $PROJECT_DIR
        print_info "Running: npm run dev"
        npm run dev
        ;;

    build)
        print_header "Building for Production"
        cd $PROJECT_DIR

        print_info "Step 1/2: Type checking..."
        if npm run typecheck; then
            print_success "Type check passed"
        else
            print_error "Type check failed"
            exit 1
        fi

        print_info "Step 2/2: Building..."
        if npm run build; then
            print_success "Build successful"
            print_info "Output: $PROJECT_DIR/dist"
        else
            print_error "Build failed"
            exit 1
        fi
        ;;

    test)
        print_header "Running Tests"
        cd $PROJECT_DIR

        print_info "Test 1: TypeScript validation..."
        if npm run typecheck; then
            print_success "TypeScript validation passed"
        else
            print_error "TypeScript validation failed"
            exit 1
        fi

        print_info "Test 2: Production build..."
        if npm run build; then
            print_success "Production build passed"
        else
            print_error "Production build failed"
            exit 1
        fi

        print_success "All tests passed!"
        ;;

    preview)
        print_header "Previewing Production Build"
        cd $PROJECT_DIR

        if [ ! -d "dist" ]; then
            print_warning "Build not found, building first..."
            npm run build
        fi

        print_info "Starting preview server..."
        npm run preview
        ;;

    clean)
        print_header "Cleaning Project"
        cd $PROJECT_DIR

        print_warning "This will remove:"
        echo "  - node_modules/"
        echo "  - dist/"
        echo ""
        read -p "Continue? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf dist node_modules
            print_success "Cleaned successfully"

            print_info "Reinstalling dependencies..."
            npm install
            print_success "Dependencies installed"
        else
            print_info "Cancelled"
        fi
        ;;

    status)
        print_header "Project Status"

        print_info "Git Status:"
        git status --short
        echo ""

        print_info "Current Branch:"
        git branch --show-current
        echo ""

        print_info "Recent Commits:"
        git log --oneline -5
        echo ""

        cd $PROJECT_DIR

        print_info "Build Status:"
        if [ -d "dist" ]; then
            print_success "Build exists"
            echo "Modified: $(stat -f "%Sm" dist 2>/dev/null || stat -c "%y" dist)"
        else
            print_warning "No build found"
        fi
        ;;

    *)
        print_error "Unknown command: $COMMAND"
        echo "Run '$0' without arguments to see available commands"
        exit 1
        ;;
esac
