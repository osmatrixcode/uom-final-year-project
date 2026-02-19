# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Intelligent Email Assistance Outlook Add-in - a Microsoft Outlook desktop application that integrates LLMs to generate intelligent email responses. This is a third-year undergraduate final project for BSc Computer Science & Mathematics at the University of Manchester.

## Development Commands

### Client (Outlook Add-in) - run from `/client` directory

```bash
npm run dev-server      # Start webpack dev server on https://localhost:3000
npm run build           # Production build
npm run build:dev       # Development build
npm run lint            # Check for linting issues
npm run lint:fix        # Auto-fix linting issues
npm run validate        # Validate manifest.xml
```

### Server (FastAPI) - run from `/server` directory

```bash
uvicorn app.main:app --reload --port 8000
```

### Manual Sideloading (Required)

Automatic sideloading doesn't work. To test the add-in:
1. Run `npm run dev-server` in `/client`
2. Follow [Microsoft's manual sideload instructions](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing?tabs=xmlmanifest#sideload-manually)
3. In Outlook: click an email → Reply → APP icon → select add-in → Show Task Pane

## Architecture

```
client/                     # React + TypeScript Outlook Add-in
├── src/taskpane/
│   ├── components/        # React components (App, Header, BasicBtn, etc.)
│   ├── services/          # API communication (apiClient, basicService)
│   ├── hooks/             # TanStack Query hooks (useBasicService)
│   ├── taskpane.ts        # Office.js integration for email body manipulation
│   └── config.ts          # API URL configuration
├── manifest.xml           # Outlook add-in manifest
└── webpack.config.js      # Build configuration

server/                     # FastAPI backend (layered architecture)
├── app/
│   ├── main.py            # FastAPI app setup, CORS, router includes
│   ├── api/
│   │   └── routes.py      # API route handlers (uses dependency injection)
│   └── services/
│       └── hello_world.py # Business logic services
└── requirements.txt
```

### Key Patterns

- **Data Fetching**: TanStack React Query for API calls and caching
- **UI Components**: Fluent UI React Components (Microsoft's design system)
- **Office Integration**: `Office.context.mailbox.item.body.setSelectedDataAsync()` in taskpane.ts inserts text into email body
- **API Client**: Generic HTTP client in `services/apiClient.ts` with service layer in `services/basicService.ts`
- **Backend Architecture**: Layered with routes (API layer) → services (business logic), using FastAPI dependency injection

### Configuration

- Client dev server: https://localhost:3000
- Backend API: http://localhost:8000 (configured in `config.ts`)
- CORS enabled for localhost:3000, localhost:3001

## Tech Stack

- **Frontend**: React 18, TypeScript 5.4, Webpack 5, Fluent UI 9, TanStack Query 5
- **Backend**: Python FastAPI
- **Office Integration**: office-js API
