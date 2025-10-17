#!/bin/bash
# Wizard of Oz - Common Development Tasks
# Quick access to frequently used commands

set -e

PROJECT_DIR="projects/wizard-of-oz"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

function print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function print_error() {
    echo -e "${RED}❌ $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if in correct directory
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Not in Aperture root directory"
    echo "Current directory: $(pwd)"
    echo "Expected to find: $PROJECT_DIR"
    exit 1
fi

# Show menu if no argument provided
if [ $# -eq 0 ]; then
    print_header "Wizard of Oz - Common Tasks"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Available commands:"
    echo "  dev           - Start development server"
    echo "  build         - Build for production"
    echo "  test          - Run type checking and build test"
    echo "  preview       - Preview production build"
    echo "  deploy        - Deploy to production (push to main)"
    echo "  status        - Check project status"
    echo "  logs          - Check recent Vercel logs"
    echo "  clean         - Clean build artifacts and node_modules"
    echo ""
    exit 0
fi

COMMAND=$1

case $COMMAND in
    dev)
        print_header "Starting Development Server"
        cd $PROJECT_DIR
        print_info "Location: $PROJECT_DIR"
        print_info "Command: npm run dev"
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
            print_info "Build output: $PROJECT_DIR/dist"
        else
            print_error "Build failed"
            exit 1
        fi
        ;;

    test)
        print_header "Running Tests"
        cd $PROJECT_DIR

        print_info "Test 1: Type checking..."
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

        print_success "All tests passed! Ready to deploy."
        ;;

    preview)
        print_header "Previewing Production Build"
        cd $PROJECT_DIR

        if [ ! -d "dist" ]; then
            print_warning "Build directory not found, running build first..."
            npm run build
        fi

        print_info "Starting preview server..."
        npm run preview
        ;;

    deploy)
        print_header "Deploying to Production"

        # Check if on main branch
        CURRENT_BRANCH=$(git branch --show-current)
        if [ "$CURRENT_BRANCH" != "main" ]; then
            print_error "Not on main branch"
            print_info "Current branch: $CURRENT_BRANCH"
            print_info "Vercel only deploys from main branch"
            echo ""
            read -p "Switch to main and merge? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git checkout main
                git merge $CURRENT_BRANCH
            else
                exit 1
            fi
        fi

        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD --; then
            print_error "Uncommitted changes detected"
            git status --short
            echo ""
            read -p "Commit changes? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                read -p "Commit message: " commit_msg
                git add .
                git commit -m "$commit_msg"
            else
                exit 1
            fi
        fi

        # Run tests before deploying
        print_info "Running pre-deploy tests..."
        cd $PROJECT_DIR
        if ! npm run build; then
            print_error "Build failed - cannot deploy"
            exit 1
        fi
        cd ../..

        # Push to main
        print_info "Pushing to main..."
        if git push origin main; then
            print_success "Deployed to production!"
            print_info "Vercel will automatically deploy from main branch"
            print_info "Check deployment status at: https://vercel.com"
        else
            print_error "Push failed"
            exit 1
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
        print_info "Package Info:"
        npm version
        echo ""

        print_info "Build Status:"
        if [ -d "dist" ]; then
            print_success "Build directory exists"
            echo "Last modified: $(stat -f "%Sm" dist)"
        else
            print_warning "No build directory found"
        fi
        ;;

    logs)
        print_header "Checking Vercel Logs"
        print_info "Opening Vercel dashboard..."

        if command -v vercel &> /dev/null; then
            vercel logs
        else
            print_warning "Vercel CLI not installed"
            print_info "Install with: npm i -g vercel"
            print_info "Or visit: https://vercel.com/dashboard"
        fi
        ;;

    clean)
        print_header "Cleaning Project"
        cd $PROJECT_DIR

        print_warning "This will remove:"
        echo "  - node_modules/"
        echo "  - dist/"
        echo "  - .vite/"
        echo ""
        read -p "Continue? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Removing build artifacts..."
            rm -rf dist .vite
            print_success "Build artifacts removed"

            print_info "Removing node_modules..."
            rm -rf node_modules
            print_success "node_modules removed"

            print_info "Reinstalling dependencies..."
            npm install
            print_success "Dependencies reinstalled"

            print_success "Project cleaned successfully"
        else
            print_info "Clean cancelled"
        fi
        ;;

    *)
        print_error "Unknown command: $COMMAND"
        echo "Run '$0' without arguments to see available commands"
        exit 1
        ;;
esac
