# AI Assistant Workspace — Project Guide

## Overview
A modern web-based AI Assistant Workspace built with React, Vite, TypeScript, and Tailwind CSS.

## Tech Stack
- **Framework:** Vite + React (TypeScript)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Icons:** Lucide React
- **Directory Structure:**
  - `src/api/` — Mock API client and network handlers
  - `src/components/` — UI components (`chat/ChatContainer.tsx`)
  - `src/types/` — TypeScript interfaces for messages and payload contracts

## Development Workflow
- **Dev Server:** `npm run dev`
- **Build:** `npm run build`
- **Type Checking:** `tsc --noEmit`

## Code Conventions
- Use functional React components with explicit TypeScript interfaces.
- Use Tailwind CSS classes directly for UI styling.
- Keep state local to feature components unless shared globally.