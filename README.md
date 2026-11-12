# Agent Canvas App: Extras

An [OpenHands](https://www.openhands.dev/) Agent Canvas app that adds a few UI tweaks: agent status in your browser tab and app icon, desktop notifications, keyboard shortcuts, a usage page, and a quieter chat.

## Features

| Name | What it does |
| :-- | :-- |
| **Wide canvas** | Lets the chat use the full width of the canvas. |
| **Responsive tables** | Stacks a table's rows when it's too wide for the chat. |
| **Collapse agent activity** | Folds "Running" and "Reading" chat entries into expandable "Thinking" entries. |
| **Keyboard shortcuts** | <kbd>?</kbd> lists them, <kbd>/</kbd> focuses the message box, <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> open the previous or next conversation, and <kbd>Alt</kbd>+<kbd>N</kbd> starts a new chat. Canvas's own <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> menu covers the rest. |
| **Tab status** | Shows the agent's status in the tab's title and icon, and counts the conversations that need your input on the installed app's icon. |
| **Desktop notifications** | Notifies you when the agent finishes or needs you while you're away. |
| **Notification sounds** | Chimes when the agent needs your confirmation while you're away. |
| **Unread markers** | Marks the conversations in the sidebar that changed since you last had them open. |
| **Installable app** | Lets your browser install Canvas as an app, with New chat, Conversations and Settings shortcuts and a title bar in Canvas's colours, clear of notches and home indicators. |
| **Mobile fixes** | Keeps Canvas's dialogs within small screens, scrolling when they're taller, and stops the Automate tabs cutting off their names. |
| **Usage page** | Adds a **Usage** page to the sidebar with what your conversations cost today, over 7 or 30 days, or all time, by model and by conversation. |

## Install

1. Visit **Customize > Apps** (`/apps`)
2. Click **Add app** at the top right
3. For the App source, enter:
   ```
   github:RobLoach/agent-canvas-app-extras
   ```
4. Click **Install**
5. **Enable** the Extras app
6. Open **Customize > Extras**, under Apps, or **Extras settings** on the app's card, and turn on the features you want, or click **Reset settings** to turn them all off

## Development

Feel free to propose more features in the issue queue.

- The app is a single browser module: [`extension.js`](extension.js). Responsive tables uses [Basic Table](https://github.com/jerrylow/basictable), embedded unchanged at the end of it, as Canvas loads an app from one file. A test checks it against the `basictable` package.
- The settings and usage pages are app pages, which Canvas serves at `/extensions/agent-canvas-app-extras/settings` and `/usage`, as it has no way for an app to add a page under Customize. The app adds the settings page to Customize's menu itself, and hides its own sidebar link.
- Canvas has no app API for settings, tab titles or page styles yet. The app works with Canvas's markup directly (its app card, chat, sidebar and title), so an OpenHands update that changes it can break a feature.
- Settings, runs that ended while you were away, what you've read and the conversation you're looking at are kept in the browser's `localStorage`, under `openhands-extras:settings`, `:unseen`, `:read` and `:viewing`, so they're per browser rather than per backend.
- While a feature that needs conversation statuses is on, the app asks the Agent Server for them, and for unread markers, in one request when the chat changes, at most every 20 seconds, and every 20 seconds while a run is going or for the counts and unread markers. Nothing is requested while those features are off, and unread markers rest while the tab is hidden.

### Tests

The tests run `extension.js` against a Canvas-like page in [jsdom](https://github.com/jsdom/jsdom) with Node's built-in test runner. They need Node 20.19, 22.13 or 24 and newer.

```
npm install
npm test
```

GitHub Actions runs them on every pull request and push to `master`.

## License

[MIT](LICENSE)
