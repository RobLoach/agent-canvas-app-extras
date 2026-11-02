# Agent Canvas App: Extras

An [OpenHands](https://www.openhands.dev/) Agent Canvas app that adds a few UI tweaks: agent status in your browser tab and app icon, desktop notifications, and a quieter chat.

## Features

| Name | What it does |
| :-- | :-- |
| **Wide canvas** | Lets the chat use the full width of the canvas. |
| **Responsive tables** | Stacks a table's rows when it's too wide for the chat. |
| **Tab status** | Shows the agent's status in the tab's title and icon. |
| **Desktop notifications** | Notifies you when the agent finishes or needs you while you're away. |
| **Notification sounds** | Chimes when the agent needs your confirmation while you're away. |
| **App icon badge** | Counts the conversations that need your input on the installed app's icon. |
| **Unread markers** | Marks the conversations in the sidebar that changed since you last had them open. |
| **Title bar colour** | Matches the installed app's title bar to Canvas's colour theme. |
| **Collapse agent activity** | Folds "Running" and "Reading" chat entries into expandable "Thinking" entries. |

### Tab status

The tab's title starts with an emoji for the agent's status, like ⏳ running or ✅ finished. The tab icon gets a matching dot with how many conversations need your input. Runs still going in other conversations are counted too, like `⏳1 ✋1`.

### Desktop notifications

Shows the agent's final reply when it finishes, or why it stopped. Clicking a notification opens its conversation.

### Notification sounds

Plays two short tones when a run needs your confirmation while you're away. If Canvas's own sounds are on (Settings → App), the open conversation is left to Canvas.

### App icon badge

Works when Canvas is installed as an app with Chrome, Edge or Safari. It counts conversations waiting for your confirmation, plus runs that ended while you were away.

### Unread markers

A dot after a conversation's title in the sidebar means it changed since you last opened it. Opening it clears the dot.

### Collapse agent activity

The agent's "Running" and "Reading" entries fold into one expandable "Thinking" entry, like Canvas's own. Messages, edits and timed out commands stay visible.

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

- The app is a single browser module: [`extension.js`](extension.js). Responsive tables uses [Basic Table](https://github.com/jerrylow/basictable), embedded unchanged at the end of it, as Canvas loads an app from one file. A test checks it against the `basictable` package.
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
