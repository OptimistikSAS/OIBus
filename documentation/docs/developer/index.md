---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# OIBus Developer Handbook

Welcome to the OIBus developer community! This guide will help you get started with contributing to OIBus.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (check `.nvmrc` for required version)
- [nvm](https://github.com/nvm-sh/nvm) (recommended for Node.js version management)
- [SQLite browser](https://sqlitebrowser.org/) or [DBeaver](https://dbeaver.io/) (for database inspection)
- Your preferred IDE (VS Code, IntelliJ, etc.)

### Recommended Tools

| Tool        | Purpose              | Installation                                        |
| ----------- | -------------------- | --------------------------------------------------- |
| Node.js     | JavaScript runtime   | [Download](https://nodejs.org/)                     |
| nvm         | Node version manager | [Installation guide](https://github.com/nvm-sh/nvm) |
| DBeaver     | Database management  | [Download](https://dbeaver.io/)                     |
| VS Code     | Code editor          | [Download](https://code.visualstudio.com/)          |
| Angular CLI | Frontend development | Installed via npm                                   |

## 📥 Setting Up Your Development Environment

### 1. Get the Source Code

Choose one of these options:

**Option A: For Contributors (Recommended)**

```bash
# Fork the repository on GitHub first
git clone git@github.com:<your-username>/OIBus.git
cd OIBus
git remote add upstream git@github.com:OptimistikSAS/OIBus.git
```

**Option B: For Evaluation Only**

```bash
git clone git@github.com:OptimistikSAS/OIBus.git
cd OIBus
```

### 2. Install Dependencies

```bash
# Install Node.js version specified in .nvmrc
nvm install
nvm use
```

### 3. Set Up the Backend

```bash
cd backend
npm install
npm start  # Starts on http://localhost:2223
```

### 4. Set Up the Frontend

```bash
cd frontend
npm install
npm start  # Builds and watches for changes
```

:::caution Frontend Note
The frontend is served by the backend. While `npm start` watches for changes, you'll need to **manually refresh** your browser to see updates.
:::

### 5. Set Up Documentation

```bash
cd documentation
npm install
npm start  # Starts on http://localhost:3000
```

### 6. Verify Your Setup

- Backend: [http://localhost:2223](http://localhost:2223)
- Documentation: [http://localhost:3000](http://localhost:3000)

## 🛠 Development Workflow

### Project Structure

```
OIBus/
├── backend/          # Backend server (Node.js)
├── frontend/         # Frontend application (Angular)
├── documentation/    # Project documentation (Docusaurus)
└── data-folder/      # Runtime data (created automatically)
```

### Quick Test Setup

To verify everything works:

1. Create a **FolderScanner** South connector (reads files from a directory)
2. Create a **Console** North connector (outputs to console)
3. Configure them to work together

## 🔧 Development Guidelines

### Branch Naming

```
<type>/<descriptive-name>#<issue-number>
```

Examples:

- `feature/add-new-connector#1234`
- `fix/folder-scanner-bug#5678`
- `docs/update-readme#9101`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Testing Requirements

All changes must include tests:

- **Backend**: [Jest](https://jestjs.io/) tests
- **Frontend**: [Jasmine](https://jasmine.github.io/) tests

Run tests with:

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Linting
npm run lint
```

## 📤 Submitting Contributions

### Before You Start

1. **Check existing issues** for similar work
2. **Create a feature issue** if adding new functionality
3. **Discuss your approach** with maintainers before coding

### Pull Request Process

1. Create a branch from `main` with proper naming
2. Make your changes and commit with clear messages
3. Push to your fork
4. Create a Pull Request to `OptimistikSAS/OIBus:main`
5. Ensure all tests pass
6. Wait for code review and address feedback

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] Documentation updated (if applicable)
- [ ] Changes are backward compatible
- [ ] New features include tests

## 🤝 Community Guidelines

### How to Contribute

1. **Start small**: Fix typos, improve docs, or tackle "good first issue" labels
2. **Ask questions**: Use GitHub discussions or issues
3. **Be patient**: We'll review your PR as soon as possible
4. **Stay engaged**: Be responsive to feedback

### Code of Conduct

We follow a [Code of Conduct](https://github.com/OptimistikSAS/OIBus/blob/main/DEVELOPER-GUIDELINES.md) to ensure a welcoming community.

## 📚 Learning Resources

### Technologies Used

| Area          | Technology   | Learning Resources                                                          |
| ------------- | ------------ | --------------------------------------------------------------------------- |
| Backend       | Node.js      | [Node.js Docs](https://nodejs.org/en/docs/)                                 |
| Frontend      | Angular      | [Angular Docs](https://angular.io/docs)                                     |
| Documentation | Docusaurus   | [Docusaurus Docs](https://docusaurus.io/)                                   |
| Testing       | Jest/Jasmine | [Jest Docs](https://jestjs.io/), [Jasmine Docs](https://jasmine.github.io/) |

### Recommended Reading

- [Angular Style Guide](https://angular.io/guide/styleguide)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

## 🎯 First Contributions

Looking for your first contribution? Check out:

- [Good first issues](https://github.com/OptimistikSAS/OIBus/labels/good%20first%20issue)
- [Documentation improvements](https://github.com/OptimistikSAS/OIBus/labels/documentation)
- [Bug reports](https://github.com/OptimistikSAS/OIBus/labels/bug)

---

**Ready to contribute?** We're excited to have you! 🎉
