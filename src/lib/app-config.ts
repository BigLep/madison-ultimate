// Application-wide configuration
// Update these values for different deployment environments

export const APP_CONFIG = {
  // Contact Information
  COACH_EMAIL: process.env.COACH_EMAIL || 'madisonultimate@gmail.com',

  // External Links
  /** Season / "Learn more" Notion page. Used on landing page and player portal home. */
  SEASON_INFO_URL: 'https://madisonultimate.notion.site/2026-Fall-Madison-Ultimate-3bdc4da46f758073930af31f3af0cc4c',
  /** Season label shown on the Player Portal home tab. Update each season (SEASON_SETUP.md). */
  SEASON_LABEL: 'Fall 2026 Season',
  /** Player Portal Guide (Notion). Re-check after any portal change; the login step changed for Fall 2026. */
  PLAYER_PORTAL_DOCUMENTATION: 'https://madisonultimate.notion.site/Player-Portal-345c4da46f758323926e01c5aec75afc',
  /** Buttondown newsletter subscribe/archive page. */
  MAILING_LIST_JOIN_URL: 'https://buttondown.com/madisonultimate',

  // Join the Community — linked from /player/$id and the portal home only (never the public homepage).
  // The invite itself is WHATSAPP_COMMUNITY_JOIN_URL in env; see SEASON_SETUP.md.
  /** Public path that redirects to the WhatsApp invite. */
  WHATSAPP_JOIN_PATH: '/whatsapp',
  /** Notion (or other) URL to learn more about the WhatsApp community. */
  WHATSAPP_LEARN_MORE_URL: 'https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#76fc4da46f7582c9899b01109ade6891',
  /** Game snack and tent signup (SignUpGenius for Fall 2026). Empty string = the snack line is not shown. */
  GAME_SNACK_SIGNUP_URL: 'https://www.signupgenius.com/go/8050B4DA4AB28A4F58-59057492-snack',

  // Season features (SEASON_SETUP.md): decide at the start of each season.
  /**
   * Whether coaches set a per-game Activation Status (Active / Inactive / TBD) in Game Availability
   * that the Games tab should show. Fall 2026: off. When off, the pill and the
   * "assuming activated" wording never appear, whatever the sheet holds.
   */
  HAS_ACTIVATION_STATUS: false,
  /**
   * Notion (or other) URL explaining Activation Status on game cards, used only when
   * HAS_ACTIVATION_STATUS is true. Empty string = label only, no link.
   */
  ACTIVATION_STATUS_INFO_URL: '',

  // App Information
  APP_NAME: 'Madison Ultimate Player Portal',
  VERSION: '1.0.0',
} as const;

// Type definitions for configuration
export type AppConfig = typeof APP_CONFIG;