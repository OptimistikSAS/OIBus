---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# OIBus developer handbook
If you want to contribute on OIBus, it's the right place to start ! We use a [GitHub repo](https://github.com/OptimistikSAS/OIBus).
You may want to take a look at the known issues to start working on OIBus by fixing small items.

If you want to improve OIBus with a new feature, please contact us first to discuss how to best implement it. You can start
with a new **feature issue**.

But first, you may want to download OIBus and start it on your machine from its sources.

## Technologies
- Install Node.js and NPM. Check the .nvm file to check on which version of Node.js OIBus run. Of course, you can directly use the
[nvm tool](https://github.com/nvm-sh/nvm)
- OIBus configuration is stored on a local SQLite database. You may need a SQL explorer tool such as [DBeaver](https://dbeaver.io/)
- OIBus can run on x64 or arm64 architectures (on Windows, Linux and Mac).
- Frontend is build with [Angular](https://angular.io/). No need to install it globally, since it is embedded in the dev dependencies.
- The documentation uses [Docusaurus](https://docusaurus.io/), based on [React](https://react.dev/)


## Steps to try out the application
### Fork the repository
If you want to contribute into the project, first fork the repository, and clone it from your fork with:

`git clone git@github.com:<your-fork>/OIBus.git`.

You will be able to make contributions through [Pull Requests](#submit-your-improvements)

Otherwise, **if you just want to try OIBus from source**, simply run:

`git clone git@github.com:OptimistikSAS/OIBus.git`

### Init shared folder
Shared folder contains model and some tools shared between frontend and backend. At first startup, you must beforehand
go into the `shared` folder and run `npm install`.

### Start the frontend
Open a terminal in the frontend folder (`cd frontend`)
- `npm install`
- `npm build`: build the frontend that will be served by the backend
- `npm start`: build the frontend and rebuild it on file changes. Useful when working on the frontend.

:::caution
The frontend is served from the backend, even with npm start. That means it won't reload automatically the web page when
files change. Just reload your page manually.
:::

To test your code: `npm test`
To check your files' linting: `npm run lint`

### Start the backend
Open a terminal in the backend folder (`cd backend`)
- `npm install`
- `npm start`
- Open up in the browser the following url: `http://localhost:2223`

The folder `data-folder` is used to store the cache, logs and configuration files.

The project is up and running, but currently there are no South or North connectors. A simple way to try out OIBus is 
to create a [FolderScanner](../guide/south-connectors/1-folder-scanner.md) South connector and a 
[Console](../guide/north-connectors/6-console.md) North connector.

### Start the documentation
Open a terminal in the documentation folder (`cd documentation`)
- `npm install`
- `npm start`
- Access the documentation on the following url: `http://localhost:3000`

## Submit your improvements
The default branch is `main`, every new branches must be created from this one. When you are satisfied with your changes,
you can create a Pull Request from your Fork repository to the Main repository on GitHub.

### Naming convention
Branch naming convention: **descriptive-name-of-the-issue#\<issue-number\>**, for example: `fix-folder-scanner-path#1564`.

Commits and PR name convention must follow the [conventional commits standard](https://www.conventionalcommits.org/en/v1.0.0/).

### Testing
All changes must be tested (with [jest](https://jestjs.io/) on the backend, with [jasmine](https://angular.io/guide/testing)
on the frontend) for three reasons:
- To be sure to properly understand your changes.
- To be sure that your changes are properly integrated in the project.
- To be sure we won't break your changes in futures modifications (if so, your tests will probably fail).

