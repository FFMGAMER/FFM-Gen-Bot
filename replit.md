# Overview

This is a Discord bot application built with Node.js that implements an account distribution system with tier-based access controls and cooldown mechanisms. The bot manages and distributes accounts across different user tiers (free, premium, booster, VIP) with role-based permissions and usage limitations.

**Project Status**: Imported from GitHub and configured for Replit environment (October 1, 2025)

# Recent Changes

- **October 1, 2025**: Initial GitHub import and Replit configuration
  - Installed Node.js 20 runtime environment
  - Installed npm dependencies (discord.js v14.22.1, fs-extra v11.3.2)
  - Configured Discord Bot workflow to run `node bot.js`
  - Added .gitignore for Node.js project
  - Restructured files to root directory for cleaner setup
  - **Required**: DISCORD_TOKEN environment variable must be set in Replit Secrets

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure
The bot follows a single-file architecture pattern with `bot.js` as the main entry point containing all core functionality. This monolithic approach simplifies deployment and maintenance for a focused Discord bot application.

## Data Storage Strategy
The system uses a file-based data storage approach with JSON files for persistence:
- **Local JSON Files**: User access permissions, cooldown states, and user-specific cooldowns are stored in separate JSON files
- **Directory-based Account Storage**: Account data is organized in a hierarchical directory structure under `./data/accounts/` with separate folders for each tier (free, premium, booster, vip)
- **Automatic Initialization**: The system ensures all required directories and files exist on startup

## Discord Bot Framework
Built using Discord.js v14 with the following architectural decisions:
- **Gateway Intents**: Configured for guilds, guild messages, and message content to handle server interactions
- **Slash Commands**: Uses modern Discord slash command architecture via REST API integration
- **Embed System**: Implements rich message formatting using Discord's embed builders

## Access Control System
The bot implements a multi-tiered access control system:
- **Role-based Permissions**: Four distinct user tiers with different privileges and limitations
- **Cooldown Management**: Both global and user-specific cooldown tracking to prevent abuse
- **File-based State**: Persistent storage of user permissions and usage patterns

## Error Handling and Reliability
- **Graceful Initialization**: Ensures all required data structures exist before operation
- **File System Safety**: Uses fs-extra for enhanced file operations with built-in error handling
- **Directory Structure Validation**: Automatically creates missing directories and files

# External Dependencies

## Core Dependencies
- **Discord.js v14.22.1**: Primary Discord API wrapper providing bot functionality, slash commands, embeds, and gateway management
- **fs-extra v11.3.2**: Enhanced file system operations with promises and additional utilities for JSON file handling

## Runtime Environment
- **Node.js**: Requires Node.js runtime environment (minimum version 16.11.0 as specified by Discord.js)
- **File System Access**: Requires read/write permissions for local data storage and account file management

## Discord Platform Integration
- **Discord Developer Portal**: Requires bot token and application configuration
- **Discord Gateway**: Real-time connection to Discord servers for command processing
- **Discord REST API**: For slash command registration and management