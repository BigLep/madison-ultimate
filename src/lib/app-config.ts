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
  /** Notion deep link to the Game Snacks and Tents section (which links the signup). Empty string = the snack line is not shown. */
  GAME_SNACK_SIGNUP_URL: 'https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#c13c4da46f758327ad9c01ee675abb68',

  /** Google Form for caretaker/player feedback (in the season Drive folder). `/feedback` redirects here, and the portal Home tab links it. Empty string = `/feedback` 404s and the portal line is hidden. Update each season. */
  FEEDBACK_FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSf9Ekb2D7VVX7AR2VzOJkNPTvE9i61-t0KEok7O2wn6U4xa4w/viewform',

  // Season features (SEASON_SETUP.md): decide at the start of each season.
  /**
   * Whether coaches set a per-game Activation Status (Active / Inactive / TBD) in Game Availability
   * that the Games tab should show. Fall 2026: on, for ACTIVATION_TEAMS only. When off, the pill and
   * the "assuming activated" wording never appear, whatever the sheet holds.
   */
  HAS_ACTIVATION_STATUS: true,
  /**
   * Teams whose players are activated game by game (compared case-insensitively). Only players on
   * these teams see Activation Status; everyone else plays every game they're available for.
   * Fall 2026: Silver (docs/fall-2026/practice-squad-merge-grill.md).
   */
  ACTIVATION_TEAMS: ['Silver'] as readonly string[],
  /**
   * Notion (or other) URL explaining Activation Status on game cards, used only when
   * HAS_ACTIVATION_STATUS is true. Empty string = label only, no link.
   */
  ACTIVATION_STATUS_INFO_URL: 'https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#c8ed51ef905f482c835d5093a120d4d7',

  // App Information
  APP_NAME: 'Madison Ultimate Player Portal',
  VERSION: '1.0.0',
} as const;

// Type definitions for configuration
export type AppConfig = typeof APP_CONFIG;