# Workit.OS

## Overview

Workit.OS is a comprehensive team management and collaboration platform designed specifically for marketing agencies and creative teams. The application combines task management, time tracking, team communication, file sharing, and client portals into a unified workspace. Built with a modern tech stack featuring React, TypeScript, and a glassmorphism design aesthetic, it provides role-based dashboards and real-time collaboration features to streamline agency operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side application is built using React 18 with TypeScript, utilizing a component-based architecture with the following key patterns:

- **Component Organization**: Uses shadcn/ui components for consistent design system implementation
- **State Management**: React Context API for authentication and theme management, TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom glassmorphism design system and CSS variables for theming
- **Authentication**: Firebase Authentication with email/password and Google OAuth support

### Backend Architecture
The server follows a REST API design with Express.js:

- **Server Framework**: Express.js with TypeScript for type safety
- **Real-time Communication**: WebSocket server using ws library for live updates (chat, notifications, timer sync)
- **Database Layer**: Drizzle ORM with PostgreSQL for type-safe database operations
- **File Structure**: Modular route handling with centralized storage abstraction

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM for schema management and migrations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Design**: Comprehensive schema covering users, workspaces, tasks, attendance, files, messages, and more
- **File Storage**: Firebase Storage for file uploads and media assets

### Authentication and Authorization
- **Authentication Provider**: Firebase Auth with multi-provider support
- **Authorization Model**: Role-based access control with roles including admin, team_leader, supervisor, employee, hr, client, and workspace_admin
- **Session Management**: Firebase handles session persistence and token refresh
- **User Profiles**: Extended user data stored in PostgreSQL with workspace associations

### Real-time Features
- **WebSocket Integration**: Real-time messaging, notifications, and timer synchronization
- **Live Updates**: Collaborative features for team activity feeds and task updates
- **Timer System**: Floating timer component with cross-page persistence and real-time sync

### UI/UX Design System
- **Design Language**: Glassmorphism with backdrop blur effects and translucent surfaces
- **Theme Support**: Light/dark mode with system preference detection
- **Internationalization**: English and Arabic language support with RTL layout handling
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Animation System**: CSS transitions and custom animations for enhanced user experience

## External Dependencies

### Core Infrastructure
- **Database**: Neon Database (serverless PostgreSQL)
- **Authentication**: Firebase Authentication and Firestore
- **File Storage**: Firebase Storage

### Third-party Integrations
- **Email Services**: SendGrid for transactional emails
- **Communication**: Slack Web API for team notifications
- **Payment Processing**: Stripe for subscription and payment handling
- **Documentation**: Notion API for content management integration

### Development and Build Tools
- **Build System**: Vite for fast development and optimized production builds
- **Database Management**: Drizzle Kit for schema migrations and database operations
- **Code Quality**: TypeScript for type safety and ESBuild for server-side bundling
- **UI Components**: Radix UI primitives with custom styling
- **Development Environment**: Replit-specific plugins for development workflow integration

### Frontend Libraries
- **State Management**: TanStack React Query for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with class-variance-authority for component variants
- **Icons**: Lucide React for consistent iconography
- **Animations**: Custom CSS animations with Tailwind utilities