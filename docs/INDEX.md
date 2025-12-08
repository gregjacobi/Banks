# Bank Explorer Documentation

Welcome to the Bank Explorer documentation hub. This index organizes all project documentation by topic.

---

## 📚 Quick Navigation

- [Skills](#skills) - Claude AI skills for commercial lending
- [Features](#features) - Application features and implementations
- [Setup & Deployment](#setup--deployment) - Installation and deployment guides
- [Development](#development) - Development notes and project info
- [Archive](#archive) - Historical documentation

---

## 🤖 Skills

Claude AI skills for commercial lending workflows.

### Credit Memo Creation & Review

| Document | Description | Size |
|----------|-------------|------|
| [Both Skills Summary](skills/BOTH_SKILLS_SUMMARY.md) | **START HERE** - Overview of both banker and analyst skills | 8.5K |
| [Quick Start](skills/QUICK_START.md) | Fast 3-step upload guide | 1.9K |
| [Enterprise Upload Instructions](skills/ENTERPRISE_UPLOAD_INSTRUCTIONS.md) | Detailed upload guide for banker skill | 11K |
| [Analyst Skill README](skills/ANALYST_SKILL_README.md) | Complete analyst skill documentation | 13K |
| [Credit Memo Package](skills/CI_Credit_Memo_Skill_Package.md) | Full packaged skill for Projects | 21K |
| [Upload Instructions](skills/CI_Credit_Memo_Upload_Instructions.md) | Step-by-step upload guide | 9K |
| [Package Summary](skills/PACKAGE_SUMMARY.md) | Technical package details | 7.4K |

**What's What:**
- **Commercial Banker Skill** (`ci-credit-memo`) - Creates comprehensive C&I loan credit memos
- **Credit Analyst Skill** (`credit-analyst-review`) - Provides independent review and risk assessment

**Quick Links:**
- Skill source code: [`/skill-dev/`](../skill-dev/)
- Upload files: `ci-credit-memo-skill.zip` (37KB), `credit-analyst-skill.zip` (32KB)

---

## ✨ Features

Documentation for key application features.

| Document | Description | Size |
|----------|-------------|------|
| [Intelligent Source Selection](features/INTELLIGENT_SOURCE_SELECTION.md) | Smart data source selection system | 18K |
| [Citation System](features/CITATION_SYSTEM.md) | Data sourcing and citation tracking | 6.8K |
| [Logo Finder](features/LOGO_FINDER.md) | Automated bank logo discovery | 14K |
| [Peer Comparison Update](features/PEER_COMPARISON_UPDATE.md) | Peer group analysis feature | 5.2K |
| [Background Jobs](features/BACKGROUND_JOBS_IMPLEMENTATION.md) | Async processing system | 6K |
| [Batch Research](features/BATCH_RESEARCH.md) | Bulk data processing | 8.7K |

**Feature Categories:**
- **Data Intelligence:** Source selection, citations, logo finder
- **Analysis:** Peer comparisons, batch research
- **Infrastructure:** Background jobs, async processing

---

## 🚀 Setup & Deployment

Installation, configuration, and deployment guides.

| Document | Description | Size |
|----------|-------------|------|
| [Deployment Guide](setup/DEPLOYMENT.md) | Heroku deployment instructions | 4.5K |
| [RAG Setup](setup/RAG_SETUP.md) | Vector search and grounding setup | 8.3K |
| [Google Slides Setup](setup/GOOGLE_SLIDES_SETUP.md) | Presentation generation config | 9K |
| [Render Data Import](setup/RENDER_DATA_IMPORT.md) | Data migration from Render | 9.1K |

**Setup Topics:**
- **Production Deployment:** Heroku, environment configuration
- **Search & AI:** RAG/vector search, Claude integration
- **Data Migration:** Render.com to Heroku migration
- **Integrations:** Google Slides API setup

---

## 🔧 Development

Project development information.

| Document | Description |
|----------|-------------|
| [README.md](../README.md) | Main project README |
| [Claude.md](../Claude.md) | Claude Code project instructions |

**Development Resources:**
- Project source: [`/server/`](../server/), [`/client/`](../client/)
- Skills development: [`/skill-dev/`](../skill-dev/)
- Environment: `.env` file configuration

---

## 📦 Archive

Historical documentation and debug notes.

| Document | Description | Size |
|----------|-------------|------|
| [Import Fix Summary](archive/IMPORT_FIX_SUMMARY.md) | Historical import bug fix | 3.9K |
| [RAG Delete Debug](archive/RAG_DELETE_DEBUG.md) | RAG deletion debugging notes | 4.6K |
| [Test Delete RAG](archive/TEST_DELETE_RAG.md) | RAG deletion test documentation | 4.8K |

**Note:** Archive contains resolved issues and historical documentation retained for reference.

---

## 🗂️ Documentation Structure

```
docs/
├── INDEX.md (this file)
├── skills/          # Claude AI skills documentation
├── features/        # Feature implementation docs
├── setup/           # Setup and deployment guides
└── archive/         # Historical/debug documentation

Root level:
├── README.md        # Main project README
├── Claude.md        # Claude Code instructions
└── skill-dev/       # Skills under development
```

---

## 📖 Documentation Conventions

### File Naming
- `UPPERCASE_WITH_UNDERSCORES.md` - Documentation files
- `README.md` - Directory overview files
- `Claude.md` - Claude Code project instructions (special case)

### Document Types
- **README** - Overview and introduction
- **SETUP** - Installation and configuration
- **GUIDE** - Step-by-step instructions
- **SUMMARY** - High-level overview
- **IMPLEMENTATION** - Technical details

---

## 🔍 Finding What You Need

### I want to...

**Upload skills to claude.ai**
→ Start with [Both Skills Summary](skills/BOTH_SKILLS_SUMMARY.md)

**Understand how features work**
→ Browse [Features](#features) section

**Deploy the application**
→ See [Deployment Guide](setup/DEPLOYMENT.md)

**Develop or modify skills**
→ Check [`/skill-dev/`](../skill-dev/) and [Skills](#skills) docs

**Set up integrations**
→ See [Setup & Deployment](#setup--deployment) section

**Understand data sourcing**
→ Read [Citation System](features/CITATION_SYSTEM.md) and [Source Selection](features/INTELLIGENT_SOURCE_SELECTION.md)

---

## 📝 Recent Updates

- **Dec 2, 2025** - Organized all documentation into structured directories
- **Dec 2, 2025** - Created Credit Analyst skill for independent review
- **Dec 2, 2025** - Packaged Commercial Banker skill for Enterprise upload

---

## 🤝 Contributing to Docs

When adding new documentation:

1. **Choose the right location:**
   - Skills → `docs/skills/`
   - Features → `docs/features/`
   - Setup → `docs/setup/`
   - Archive → `docs/archive/` (only for resolved/historical)

2. **Update this index** with new document

3. **Follow naming conventions** (UPPERCASE_WITH_UNDERSCORES.md)

4. **Include in Claude.md** if relevant for AI assistance

---

**Last Updated:** December 2, 2025
**Documentation Version:** 1.0
