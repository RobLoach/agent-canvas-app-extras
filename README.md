# Agent Canvas App: Extras

An [OpenHands](https://www.openhands.dev/) Agent Canvas app that adds a few UI tweaks: agent status in your browser tab and app icon, desktop notifications, and a quieter chat.

## Features

| Name | What it does |
| :-- | :-- |
| **Wide canvas** | Lets the chat use the full width of the canvas. |
| **Tab status** | Shows the agent's status in the tab's title and icon. |
| **Desktop notifications** | Notifies you when the agent finishes or needs you while you're away. |
| **Confirmation sound** | Chimes when the agent needs your confirmation while you're away. |
| **App icon badge** | Counts the conversations that need your input on the installed app's icon. |
| **Unread markers** | Marks the conversations in the sidebar that changed since you last had them open. |
| **Title bar colour** | Matches the installed app's title bar to Canvas's colour theme. |
| **Hide "Running" and "Reading"** | Folds those chat entries into expandable "Thinking" entries. |

### Tab status

- The title starts with ⏳ running, ✋ needs your confirmation, ⏸️ paused, ✅ finished or ❌ stopped. It replaces Canvas's own status emoji, which shows ✅ even while the agent waits for you, and is left out when the conversation's title already starts with it.
- The tab icon gets a matching coloured dot, numbered with how many conversations need your input, counted as for the app icon badge.
- Runs you opened in the tab that are still going elsewhere are counted, running ones with ⏳ and ones waiting for your confirmation with ✋, like `⏳3`, `⏳1 ✋1` or `✅ ⏳2`.

### Desktop notifications

- Shows the agent's final reply when it finishes, or why it stopped, in Canvas's language.
- Clicking a notification opens its conversation.

### Confirmation sound

- Plays two short tones when a run needs your confirmation while you're away.
- Canvas has sound notifications of its own, under Settings → App. While those are on, the conversation you have open is left to Canvas, so you don't hear both.

### App icon badge

- Works when Canvas is installed as an app with Chrome or Edge, or Safari's Add to Dock. Safari only shows it once notifications are allowed.
- Counts every conversation waiting for your confirmation, plus runs that ended while you were away until you open them. Those are remembered across reloads and shared by all your Canvas windows in this browser.

### Unread markers

- A dot after a conversation's title in the sidebar means it changed since you last had it open. Opening it clears the dot, and the conversation you're looking at is never marked.
- Everything counts as read when you switch it on. What you've read is remembered across reloads and shared by all your Canvas windows in this browser.

### Hide "Running" and "Reading"

- Each stretch of the agent's "Running" and "Reading" entries becomes one "Thinking" entry, like Canvas's own, which expands to show them.
- The agent's messages, edits and timed out commands stay visible.
- The last "Thinking" pulses while the conversation is running, and the activity chip above the message box says "Thinking" for those entries too.
- Follows Canvas's language.

## Install

1. Visit **Customize > Apps** (`/apps`)
2. Click on **Add app** at the top right
3. For the App source, enter:
   ```
   github:RobLoach/agent-canvas-app-extras
   ```
4. Click **Install**
5. **Enable** the Extras app
6. Turn on the features you want in the Extras card

## Development

Feel free to propose more features in the issue queue.

- The app is a single, dependency-free browser module: [`extension.js`](extension.js).
- All settings are stored in the browser's `localStorage` under `openhands-extras:settings`, so they're per browser rather than per backend.
- Canvas has no app API for settings, tab titles or page styles yet, so the app works with Canvas's markup directly: it adds its settings above the footer of its card (`data-testid="canvas-extension-card-agent-canvas-app-extras"`), and an OpenHands update that changes that markup can break a feature.
- While any feature other than Wide canvas or Title bar colour is on, the app asks the Agent Server for conversation statuses in one request (`GET /api/conversations?ids=…`): at most every 3 seconds while the chat is updating or when you come back to the tab, plus every 15 seconds while a run is going. Idle and finished conversations aren't polled.
- Tab status and the app icon badge also ask how many conversations are waiting for confirmation (`GET /api/conversations/count?status=waiting_for_confirmation`) with each check, and every 30 seconds otherwise, to catch runs started elsewhere. Runs that ended unseen are kept in `localStorage` under `openhands-extras:unseen`.
- Unread markers ask for the sidebar's conversations when the page changes, at most every 3 seconds, and every 30 seconds otherwise, in the same request as the statuses when both are due. What you've read is kept in `localStorage` under `openhands-extras:read`.

### Tests

The tests run `extension.js` against a Canvas-like page in [jsdom](https://github.com/jsdom/jsdom) with Node's built-in test runner. They need Node 20.19, 22.13 or 24 and newer.

```
npm install
npm test
```

GitHub Actions runs them on every pull request and push to `master`.

## License

[MIT](LICENSE)
