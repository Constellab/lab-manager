# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Running

- `npm run build` - Build the NestJS application
- `npm run start` - Start the application
- `npm run start:dev` - Start in development mode with file watching
- `npm run start:debug` - Start in debug mode with file watching
- `npm run start:prod` - Start the production build

### Docker

- `npm run build-image` - Build Docker image as 'lab-manager'
- `docker build -t lab_manager_test .` - Test Dockerfile build

## Architecture Overview

### Core Application Structure

This is a NestJS-based lab management application that orchestrates Docker containers for scientific computing environments. The application manages multiple environments (production, development, desktop) and handles Docker Compose lifecycle operations.

**Key Modules:**

- `CoreModule` - Configuration, logging, file operations, and shared services
- `LabModule` - Lab environment management and desktop compose services
- `DockerModule` - Docker Compose management with main and sub-compose architecture
- `BackupModule` - Backup operations
- `LabManagerModule` - Core lab manager functionality

### Docker Compose Architecture

The application uses a sophisticated Docker Compose management system:

**Main Compose (`docker-compose.yml`):**

- Manages core lab services (glab, codelab, front-end)
- Handles production and development database containers
- Configured with Traefik routing for multi-domain access
- Located in `src/assets/docker-compose.yml`

**Sub-Compose System:**

- Managed by `SubComposeManager` and `DockerComposeService`
- Dynamic registration and lifecycle management of additional compose files
- Each sub-compose identified by `brickName` and `uniqueName`
- Files stored in volume-based `sub-composes/` directory with JSON config tracking

**Key Classes:**

- `DockerComposeService` - Main service for compose operations
- `MainDockerCompose` - Handles the primary lab compose file
- `DockerCompose` - Generic compose file operations (up/down/status)
- `DockerComposeYaml` - YAML parsing and manipulation
- `LabStandaloneFrontComposeService` - Auto-starts the standalone configuration front container in `desktop` and `private-cloud` modes

### Environment Profiles

Configured via `ENVIRONMENT_PROFILE` environment variable:

- `prod` - Production lab environment (cloud-reachable, full compose stack, API key required)
- `dev` - Development environment (uses `docker-compose-local.yml`, API key bypassed)
- `desktop` - Desktop/standalone mode (single-user install, standalone front on host port 82, API key bypassed)
- `private-cloud` - Prod-grade cloud lab on a private network the Constellab cloud cannot reach. Behaves like `prod` for the compose lifecycle but also starts the standalone front behind traefik on `lab-config.${VIRTUAL_HOST}` and bypasses the API key for on-site configuration
- `test` - Testing environment

See [src/app/core/models/config.class.ts](src/app/core/models/config.class.ts) for the authoritative description of each profile.

### Configuration System

- Uses NestJS ConfigModule with environment-specific settings
- `CoreConfigService` provides centralized config access
- Volume-based storage using `VOLUME_PATH` environment variable
- API key authentication via `LAB_MANAGER_API_KEY`

### Development Setup

For local development, the application expects to run inside a Docker container with:

- Docker-in-Docker capability for managing lab containers
- Networks: `gencovery-network-dev` and `gencovery-network-prod`
- Volume mounts for persistent data and configuration
- Configuration file at `/app/config/config.json`

### Code Formatting

The project uses:

- ESLint with TypeScript rules
- Prettier for code formatting
- Single quotes preference for JavaScript/TypeScript
- Format on save enabled in VS Code
- Automatic import organization for TypeScript files
