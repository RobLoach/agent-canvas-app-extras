// Desktop notifications.

import { canvasLanguage, canvasTranslations } from './canvas.js';
import { STATUS_BADGES } from './statuses.js';

const PERMISSION_PROBLEMS = {
  denied: 'Notifications are blocked for this site in your browser settings.',
  default: "Your browser hasn't allowed notifications yet.",
};

export function notificationProblem() {
  if (!window.Notification || !window.isSecureContext) {
    return 'Your browser only allows notifications over HTTPS or on localhost.';
  }
  return PERMISSION_PROBLEMS[Notification.permission] ?? null;
}

export async function requestNotificationPermission() {
  await window.Notification?.requestPermission();
  return notificationProblem();
}

// Final responses are Markdown, which notifications show as raw text. Strip
// the syntax and cut on a word boundary without splitting an emoji.
function plainText(markdown, max = 200) {
  const text = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\*+|~~|`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Notify about a run's new status, in Canvas's language, with the agent's
// final reply when it finished. Clicking opens the run, which may not be the
// one on screen.
export async function notify(host, { id, title, status, icon, isOpen, isDisposed }) {
  if (window.Notification?.permission !== 'granted') return;
  const { label, key } = STATUS_BADGES[status];
  const language = canvasLanguage();
  let body =
    language === 'en' ? label : ((await canvasTranslations(language))[key] ?? label);
  if (status === 'finished') {
    const result = await host.agentServer
      .request({ path: `/api/conversations/${id}/agent_final_response` })
      .catch(() => null);
    if (result?.response) body = plainText(result.response) || body;
  }
  if (isDisposed()) return;
  const notification = new Notification(title || 'OpenHands', {
    body,
    tag: `openhands-extras-${id}`,
    icon,
  });
  notification.onclick = () => {
    window.focus();
    if (!isOpen()) host.navigate(`/conversations/${id}`);
    notification.close();
  };
}
