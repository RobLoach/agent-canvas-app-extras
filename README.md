# Agent Canvas App: Extras

An [OpenHands](https://www.openhands.dev/) Agent Canvas app that adds a few UI tweaks: agent status in your browser tab and app icon, desktop notifications, unread markers, keyboard shortcuts, a usage page, and a quieter chat.

## Features

| Name | What it does |
| :-- | :-- |
| **Wide canvas** | Lets the chat use the full width of the canvas. |
| **Responsive tables** | Stacks a table's rows when it's too wide for the chat. |
| **Collapse agent activity** | Folds "Running" and "Reading" chat entries into expandable "Thinking" entries. |
| **Keyboard shortcuts** | <kbd>?</kbd> lists them, <kbd>/</kbd> focuses the message box, <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> open the previous or next conversation and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>↓</kbd> the next one waiting for your confirmation or unread, even from the message box, and <kbd>Alt</kbd>+<kbd>N</kbd> starts a new chat. Canvas's own <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> menu covers the rest. |
| **Tab status** | Shows the agent's status in the tab's title and icon, and counts the conversations that need your input on the installed app's icon. |
| **Desktop notifications** | Notifies you when the agent finishes or needs you while you're away. |
| **Notification sounds** | Chimes when the agent needs your confirmation while you're away. |
| **Unread markers** | Marks the conversations in the sidebar that changed since you last had them open. |
| **Font size** | Makes Canvas's text, and the space around it, smaller or larger, from 90% to 150%, on top of your browser's own font size. |
| **Reduce motion** | Stops Canvas's spinners, pulses, fades and slides, whatever your system's motion setting. |
| **Clear links and focus** | Underlines every link, not only on hover, and outlines what has keyboard focus in a thick ring. |
| **Bigger tap targets** | Makes buttons and sidebar rows at least 44 pixels tall on touch screens. |
| **Installable app** | Lets your browser install Canvas as an app, with New chat and Settings shortcuts and a title bar in Canvas's colours, clear of notches and home indicators. |
| **Mobile fixes** | On phones and tablets, keeps the message box above the browser's toolbar, opens the sidebar across the whole screen without conversation previews running off it, shows buttons that otherwise only appear on hover, keeps Canvas's dialogs on screen, scrolling when they're taller, and stops the Automate tabs cutting off their names. |
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
6. Open **Customize > Extras**, under Apps, and turn on the features you want, or click **Reset settings** to put them all back

## Development

Feel free to propose more features in the issue queue.

- The app's source is in [`src/`](src), one module per feature, from [`src/index.js`](src/index.js). Canvas loads an app from one file, so `npm run build` bundles them with Rollup into [`extension.js`](extension.js), which is checked in. `npm test` builds it first, and CI checks it matches `src/`.
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
