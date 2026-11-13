// Conversation statuses, and how Tab status and notifications show them.

// Canvas starts the open conversation's title with its own status emoji,
// which Tab status replaces rather than adding a second.
export const CANVAS_TITLE_STATUS = /^(?:🟢|✅|⚪|🔴) /u;

// Each label is English, and the key Canvas's translation of it, for its
// other languages.
export const STATUS_BADGES = {
  running: { emoji: '⏳', color: '#3b82f6', label: 'Running', key: 'COMMON$RUNNING' },
  waiting_for_confirmation: {
    emoji: '✋',
    color: '#f59e0b',
    label: 'Needs your confirmation',
    key: 'CHAT_INTERFACE$AGENT_AWAITING_USER_CONFIRMATION_MESSAGE',
  },
  paused: { emoji: '⏸️', color: '#9ca3af', label: 'Paused', key: 'COMMON$PAUSED' },
  finished: { emoji: '✅', color: '#22c55e', label: 'Finished', key: 'COMMON$FINISHED' },
  error: {
    emoji: '❌',
    color: '#ef4444',
    label: 'Stopped with an error',
    key: 'COMMON$ERROR',
  },
  stuck: {
    emoji: '❌',
    color: '#ef4444',
    label: 'Got stuck',
    key: 'AGENT_STATUS$AGENT_STOPPED',
  },
};

// Active badges show whenever the status holds; the rest only after this tab
// saw the run, until you come back to the tab.
export const ACTIVE_STATUSES = new Set(['running', 'waiting_for_confirmation']);
export const ENDED_STATUSES = new Set(['finished', 'error', 'stuck']);
export const NOTIFY_STATUSES = new Set(['waiting_for_confirmation', ...ENDED_STATUSES]);
