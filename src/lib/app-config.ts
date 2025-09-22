// Application-wide configuration
// Update these values for different deployment environments

export const APP_CONFIG = {
  // Contact Information
  COACH_EMAIL: process.env.COACH_EMAIL || 'madisonultimate@gmail.com',

  // External Links
  PLAYER_PORTAL_DOCUMENTATION: 'https://madisonultimate.notion.site/Player-Portal-276c4da46f7580f2b431dab687ef5f01',

  // App Information
  APP_NAME: 'Madison Ultimate Player Portal',
  VERSION: '1.0.0',
} as const;

// Type definitions for configuration
export type AppConfig = typeof APP_CONFIG;