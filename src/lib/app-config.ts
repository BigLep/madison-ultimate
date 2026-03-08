// Application-wide configuration
// Update these values for different deployment environments

export const APP_CONFIG = {
  // Contact Information
  COACH_EMAIL: process.env.COACH_EMAIL || 'madisonultimate@gmail.com',

  // External Links
  /** Season / "Learn more" Notion page. Used on landing page and player portal home. */
  SEASON_INFO_URL: 'https://madisonultimate.notion.site/2026-Spring-Madison-Ultimate-2ffc4da46f75805a8817f19327bfa970',
  PLAYER_PORTAL_DOCUMENTATION: 'https://madisonultimate.notion.site/Player-Portal-276c4da46f7580f2b431dab687ef5f01',

  // Join the Community (player portal home) — update each new season; see SEASON_SETUP.md
  /** WhatsApp community join link. */
  WHATSAPP_COMMUNITY_JOIN_URL: 'https://chat.whatsapp.com/BOFsHNwVB2r4tUvE30Tn3B',
  /** Notion (or other) URL to learn more about the WhatsApp community. */
  WHATSAPP_LEARN_MORE_URL: 'https://madisonultimate.notion.site/More-Season-Info-2ffc4da46f7581d0b8e8f16282d39117#31dc4da46f758071be66eae740ecda64',
  /** Notion (or other) URL for game snack signup. */
  GAME_SNACK_SIGNUP_URL: 'https://madisonultimate.notion.site/More-Season-Info-2ffc4da46f7581d0b8e8f16282d39117#31dc4da46f7580bdaa3dcc3b396901d9',

  // App Information
  APP_NAME: 'Madison Ultimate Player Portal',
  VERSION: '1.0.0',
} as const;

// Type definitions for configuration
export type AppConfig = typeof APP_CONFIG;