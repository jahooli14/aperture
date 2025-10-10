# Contributing to Aperture

Thank you for your interest in contributing to Aperture! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm or pnpm
- Git

### Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/aperture.git`
3. Navigate to the project: `cd aperture/projects/wizard-of-oz`
4. Install dependencies: `npm install`
5. Start development server: `npm run dev`

## Development Workflow

### Branch Naming
Use descriptive branch names with prefixes:
- `feature/ISSUE-123-add-user-authentication`
- `fix/ISSUE-456-resolve-memory-leak`
- `docs/ISSUE-789-update-api-documentation`
- `chore/ISSUE-101-update-dependencies`

### Commit Messages
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no functional changes)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add OAuth2 login support

Implements Google and GitHub OAuth2 authentication
with session management and token refresh.

Closes #123
```

```
fix(api): resolve timeout issue in data fetching

The API was timing out on large datasets. Increased
timeout and added pagination support.

Fixes #456
```

### Code Standards

#### TypeScript
- Use strict TypeScript settings
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

#### React
- Use functional components with hooks
- Follow React best practices
- Use TypeScript for prop types
- Keep components focused and reusable

#### Styling
- Use Tailwind CSS for styling
- Follow mobile-first responsive design
- Use semantic HTML elements
- Ensure accessibility standards (WCAG 2.1)

#### File Organization
- Keep files under 300 lines when possible
- Use descriptive file and directory names
- Group related functionality together
- Export components from index files

### Testing
- Write tests for new features and bug fixes
- Ensure existing tests pass: `npm test`
- Aim for meaningful test coverage
- Use descriptive test names

### Linting and Formatting
Before submitting code:
```bash
npm run lint       # Check for linting issues
npm run build      # Ensure code builds successfully
```

## Pull Request Process

### Before Creating a PR
1. Create an issue describing the problem or feature
2. Create a branch from `main`
3. Make your changes following the guidelines above
4. Test your changes thoroughly
5. Update documentation if needed

### Creating the PR
1. Push your branch to your fork
2. Create a Pull Request against the `main` branch
3. Fill out the PR template completely
4. Link the related issue(s)
5. Add appropriate labels

### PR Requirements
- [ ] All CI checks pass
- [ ] Code follows project standards
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] PR description is clear and complete
- [ ] No merge conflicts

### Review Process
- PRs require at least one approval
- Address reviewer feedback promptly
- Keep discussions constructive and focused
- Update your branch if needed

## Issue Guidelines

### Before Creating an Issue
- Search existing issues to avoid duplicates
- Check if the issue is already resolved in the latest version
- Gather relevant information (browser, OS, steps to reproduce)

### Issue Types
- **Bug Report**: Something isn't working correctly
- **Feature Request**: Suggest new functionality
- **Question**: Need help or clarification
- **Documentation**: Improvements to docs

### Writing Good Issues
- Use clear, descriptive titles
- Provide detailed descriptions
- Include steps to reproduce (for bugs)
- Add screenshots when helpful
- Use appropriate labels

## Development Tips

### Project Structure
```
aperture/
├── projects/wizard-of-oz/     # Main application
│   ├── src/                   # Source code
│   ├── public/                # Static assets
│   ├── package.json           # Dependencies
│   └── vite.config.ts         # Build configuration
├── .github/                   # GitHub templates and workflows
└── README.md                  # Project documentation
```

### Local Development
- Use `npm run dev` for development server
- Use `npm run build` to test production builds
- Use `npm run preview` to test production builds locally

### Debugging
- Use browser dev tools for client-side debugging
- Check console for errors and warnings
- Use React DevTools extension for component debugging

## Getting Help

- Create an issue for questions or problems
- Check existing documentation
- Review closed issues for similar problems

## Recognition

Contributors will be recognized in our project documentation and release notes. Thank you for helping make Aperture better!

## License

By contributing to Aperture, you agree that your contributions will be licensed under the same license as the project.