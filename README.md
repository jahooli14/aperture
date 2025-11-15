# Aperture - Personal Projects Monorepo

> Personal experiments, tools, and apps by Dan Croome-Horgan

## Active Projects

### 👁️ Pupils (wizard-of-oz/)
Baby photo journey app with face alignment technology
- **Status**: ✅ Production
- **Live**: [aperture-wizard-of-oz.vercel.app](https://aperture-wizard-of-oz.vercel.app)
- **Tech**: React, Supabase, Face alignment ML

### 🎨 Polymath
Voice-to-memory personal knowledge graph & creative project tracker
- **Status**: ✅ Production
- **Live**: [Vercel deployment](https://polymath-gfvgwb3qx-daniels-projects-ca7c7923.vercel.app)
- **Tech**: React, Supabase, Gemini AI, Capacitor (Android)

### 🔧 Self-Healing Tests
Automated test repair system
- **Status**: 🚧 Active Development
- **Tech**: Playwright, AI-powered test fixing

### 📚 Autonomous Docs
Self-optimizing documentation system
- **Status**: ✅ Production
- **Cron**: Daily at 09:00 UTC via GitHub Actions
- **Tech**: Gemini AI, automated knowledge updates

## Experiments

Located in `projects/.experiments/`:
- **Baby Milestone Tracker** - AI-powered developmental milestone detection (extracted from Polymath)
- **Visual Test Generator** - Research project (use Playwright instead - see RECOMMENDATION.md)

## Documentation

- **[START_HERE.md](START_HERE.md)** - Onboarding guide for new contributors
- **[CLAUDE.md](CLAUDE.md)** - Project router (NUDJ work vs Aperture personal)
- **[CLAUDE-APERTURE.md](CLAUDE-APERTURE.md)** - Aperture-specific documentation
- **[NAVIGATION.md](NAVIGATION.md)** - Task-based documentation index
- **[NEXT_SESSION.md](NEXT_SESSION.md)** - Current work status

## Getting Started

```bash
# Clone the repo
git clone https://github.com/jahooli14/aperture.git
cd aperture

# Navigate to a specific project
cd projects/polymath    # or wizard-of-oz, self-healing-tests

# Install dependencies
npm install

# See project-specific README for setup instructions
```

## Structure

```
aperture/
├── projects/
│   ├── polymath/              # Voice memory & creative projects
│   ├── wizard-of-oz/          # Baby photo app (Pupils)
│   ├── self-healing-tests/    # Automated test repair
│   └── .experiments/          # Research & prototypes
├── scripts/
│   └── autonomous-docs/       # Self-optimizing documentation
├── .process/                  # Development processes & guidelines
├── research/                  # Technology research documents
└── knowledge-base/            # Autonomous docs audit trails
```

## Meta-Projects

- **Autonomous Documentation**: Runs daily to update docs with latest AI/Claude best practices
- **Self-Healing Tests**: Automatically repairs broken Playwright tests
- **Process Optimization**: Continuous improvement of development workflows

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Vercel Serverless, Supabase
- **AI**: Gemini API, Claude API
- **Mobile**: Capacitor (Polymath Android app)
- **Testing**: Playwright, Vitest
- **Deployment**: Vercel, GitHub Actions

## Philosophy

This monorepo follows a **lazy-loading documentation strategy**:
- Read only what's needed for current task
- Use NAVIGATION.md for task-based doc discovery
- Check project-specific NEXT_SESSION.md for status
- Consult .process/ for development patterns

## Contributing

This is a personal monorepo, but if you find something useful:
1. Check the project's README for setup
2. See CONTRIBUTING.md for guidelines
3. Open an issue if you find bugs

## License

Individual projects may have their own licenses - check project directories.
