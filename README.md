# Orbit

**Orbit** is a note-taking and organization application designed to help students with ADHD manage their schoolwork, organize information, and build better habits. It brings notes, organizational tools, habit tracking, and AI-assisted support together in one workspace.

The goal of Orbit is to make staying organized easier without overwhelming students with unnecessary complexity.

## Features

- **Note-taking:** Create and manage notes using the BlockNote rich-text editor.
- **Organization:** Organize notes and notebooks in a centralized workspace.
- **Tables and Charts:** Use structured content to organize and present information.
- **Habit Tracking:** Keep track of habits and build more consistent routines.
- **AI Assistance:** Interact with AI-powered chat functionality for additional support.
- **Workspace Navigation:** Navigate between different notes and organizational sections.

## Technology Stack

Orbit was developed using the following technologies:

| Technology | Purpose |
|---|---|
| React.js | Frontend development and user interface |
| Node.js | Backend development |
| JavaScript / TypeScript | Application programming |
| Tailwind CSS | Interface styling |
| BlockNote | Rich-text note editor |
| PostgreSQL | Database |
| Neon | PostgreSQL database hosting |
| Gemini | AI-assisted chat functionality |

## Getting Started

Follow these instructions to run Orbit locally.

### Prerequisites

Before getting started, make sure you have:

- [Node.js](https://nodejs.org/) installed.
- npm installed (included with Node.js).
- Access to a PostgreSQL database.
- A Gemini API key if you want to use the AI functionality.

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
```

Navigate into the project directory:

```bash
cd orbit
```

### 2. Install Dependencies

Install the project's dependencies:

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root and configure the required environment variables.

Example:

```env
DATABASE_URL=your_postgresql_connection_string
GEMINI_API_KEY=your_gemini_api_key
```

Replace the example values with your actual credentials. The environment variable names must match those expected by the application.

**Important:** Never share or commit API keys, database credentials, or other private environment variables.

### 4. Run the Application

Start the development server:

```bash
npm run dev
```

Once the server starts, open the local development URL displayed in your terminal.

## Development

Orbit was developed with a focus on combining note-taking, organization, and AI-assisted functionality into a single application.

Git was used throughout development to track changes, maintain checkpoints, review modifications, and help troubleshoot issues during implementation.

AI development tools were also used to assist with exploring unfamiliar libraries, understanding implementation problems, and accelerating parts of the coding process.

## Project Goal

Orbit aims to provide students with ADHD a more approachable way to manage their notes, schoolwork, and habits. By combining organizational tools with AI-assisted functionality, Orbit seeks to make managing everyday academic responsibilities easier.

