#!/bin/bash
# Vercel Deployment Helper
# Automates pre-deployment checks and deployment process

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

print_header "Vercel Deployment Helper"

# Check 1: Verify on main branch
print_info "Checking git branch..."
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
    print_error "Not on main branch"
    echo "Current branch: $CURRENT_BRANCH"
    echo ""
    read -p "Switch to main? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout main
        print_success "Switched to main"
    else
        print_error "Deployment cancelled - must be on main branch"
        exit 1
    fi
else
    print_success "On main branch"
fi

# Check 2: Verify working directory is clean or has changes to commit
print_info "Checking git status..."
if git diff-index --quiet HEAD --; then
    print_warning "No uncommitted changes"
    echo ""
    read -p "Continue with deployment anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled"
        exit 0
    fi
else
    print_success "Changes detected"
    git status --short
fi

# Check 3: Run type checking
print_info "Running type check..."
cd $PROJECT_DIR

if npm run typecheck > /dev/null 2>&1; then
    print_success "Type check passed"
else
    print_error "Type check failed"
    echo ""
    npm run typecheck
    echo ""
    read -p "Deploy anyway? (NOT recommended) (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    print_warning "Proceeding despite type errors..."
fi

# Check 4: Run build test
print_info "Testing production build..."

if npm run build > /dev/null 2>&1; then
    print_success "Build successful"
else
    print_error "Build failed"
    echo ""
    npm run build
    exit 1
fi

cd ../..

# Check 5: Confirm deployment
echo ""
print_header "Ready to Deploy"
echo ""
echo "This will:"
echo "  1. Commit all changes (if any)"
echo "  2. Push to main branch"
echo "  3. Trigger Vercel auto-deployment"
echo ""
read -p "Proceed with deployment? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deployment cancelled"
    exit 0
fi

# Step 1: Commit changes if needed
if ! git diff-index --quiet HEAD --; then
    echo ""
    read -p "Commit message: " commit_msg

    if [ -z "$commit_msg" ]; then
        print_error "Commit message required"
        exit 1
    fi

    git add .
    git commit -m "$commit_msg"
    print_success "Changes committed"
fi

# Step 2: Push to main
print_info "Pushing to main branch..."

if git push origin main; then
    print_success "Pushed to main"
else
    print_error "Push failed"
    exit 1
fi

# Step 3: Deployment info
echo ""
print_header "Deployment Initiated"
echo ""
print_success "Code pushed to main branch"
print_info "Vercel will automatically deploy"
print_info "Monitor status at: https://vercel.com/dashboard"
echo ""
print_info "Deployment typically takes 1-2 minutes"
echo ""

# Optional: Wait and check if vercel CLI is available
if command -v vercel &> /dev/null; then
    echo ""
    read -p "Monitor deployment with Vercel CLI? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Fetching deployment status..."
        vercel ls
    fi
fi

print_success "Deployment complete!"
