// Application-wide configuration
// Update these values for different deployment environments

export const APP_CONFIG = {
  // Contact Information
  COACH_EMAIL: process.env.COACH_EMAIL || 'madisonultimate@gmail.com',

  // External Links
  /** Season / "Learn more" Notion page. Used on landing page and player portal home. */
  SEASON_INFO_URL: 'https://madisonultimate.notion.site/2026-Fall-Madison-Ultimate-3bdc4da46f758073930af31f3af0cc4c',
  PLAYER_PORTAL_DOCUMENTATION: 'https://madisonultimate.notion.site/Player-Portal-276c4da46f7580f2b431dab687ef5f01',
  /** Buttondown newsletter subscribe/archive page. */
  MAILING_LIST_JOIN_URL: 'https://buttondown.com/madisonultimate',

  // Join the Community — linked from /player/$id and the portal home only (never the public homepage).
  // The invite itself is WHATSAPP_COMMUNITY_JOIN_URL in env; see SEASON_SETUP.md.
  /** Public path that redirects to the WhatsApp invite. */
  WHATSAPP_JOIN_PATH: '/whatsapp',
  /** Notion (or other) URL to learn more about the WhatsApp community. */
  WHATSAPP_LEARN_MORE_URL: 'https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#76fc4da46f7582c9899b01109ade6891',
  /** Notion (or other) URL for game snack signup. */
  GAME_SNACK_SIGNUP_URL: 'https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#c13c4da46f758327ad9c01ee675abb68',
  /**
   * Notion (or other) URL explaining Activation Status on practice/game cards.
   * Empty string = label only, no link. Set when this season has a heading for it.
   */
  ACTIVATION_STATUS_INFO_URL: '',

  // App Information
  APP_NAME: 'Madison Ultimate Player Portal',
  VERSION: '1.0.0',
} as const;

// Type definitions for configuration
export type AppConfig = typeof APP_CONFIG;