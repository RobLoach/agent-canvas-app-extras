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

- The title starts with ⏳ running, ✋ needs your confirmation, ⏸️ paused, ✅ finished or ❌ stopped, in place of Canvas's own status emoji, and is left out when the conversation's title already starts with it.
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
2. Click **Add app** at the top right
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
- Canvas has no app API for settings, tab titles or page styles yet. The app works with Canvas's markup directly (its app card, chat, sidebar and title), so an OpenHands update that changes it can break a feature.
- Settings, runs that ended while you were away, and what you've read are kept in the browser's `localStorage`, under `openhands-extras:settings`, `:unseen` and `:read`, so they're per browser rather than per backend.
- While a feature that needs conversation statuses is on, the app asks the Agent Server for them in one request when the chat changes (at most every 3 seconds), every 15 seconds while a run is going, and every 30 seconds for the counts and unread markers. Nothing is requested while those features are off, and unread markers rest while the tab is hidden.

### Tests

The tests run `extension.js` against a Canvas-like page in [jsdom](https://github.com/jsdom/jsdom) with Node's built-in test runner. They need Node 20.19, 22.13 or 24 and newer.

```
npm install
npm test
```

GitHub Actions runs them on every pull request and push to `master`.

## License

[MIT](LICENSE)
