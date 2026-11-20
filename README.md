# Agent Canvas App: Extras

An [OpenHands](https://www.openhands.dev/) Agent Canvas app that adds a few UI tweaks: agent status in your browser tab and app icon, desktop notifications, unread markers, keyboard shortcuts, voice chat, and a quieter chat.

## Features

### Chat

| Name | What it does |
| :-- | :-- |
| **Wide chat** | Lets the chat use the full width of the page. |
| **Focused new chat** | Hides the new chat page's "What do you want to work on?" heading and tagline. |
| **Collapse agent activity** | Folds "Running" and "Reading" chat entries into expandable "Thinking" entries. |
| **Responsive tables** | Stacks a table's rows when it's too wide for the chat. |
| **Keyboard shortcuts** | <kbd>?</kbd> lists them, <kbd>/</kbd> focuses the message box, <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> open the previous or next conversation and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>↓</kbd> the next one waiting for your confirmation or unread, even from the message box, <kbd>Alt</kbd>+<kbd>N</kbd> starts a new chat, and <kbd>Alt</kbd>+<kbd>V</kbd> starts or stops Canvas's mic. Canvas's own <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> menu covers the rest. |

### Voice

| Name | What it does |
| :-- | :-- |
| **Voice chat** | After you speak a message with Canvas's mic, sends it, reads the agent's reply aloud, then turns the mic back on for your next message, keeping a phone's screen awake meanwhile. Code stays in the chat rather than being read out, and it tells you when the agent needs your confirmation or stops with an error. Say "stop" to press Canvas's Stop, "never mind" to send nothing, "repeat that" to hear the last reply again, or "new chat" to start one. Pressing a key or opening another conversation stops it. |
| **Hands-free** | Stops Canvas's mic once you stop talking, or after 10 seconds of silence, so with Voice chat you never have to tap it. |
| **Voice** | Which of your browser's English voices reads aloud. **Automatic** picks the best one your device has, from [Readium Speech](https://github.com/readium/speech)'s 10 highest rated voices, Microsoft Edge's online ones, and the best that Chrome, Apple's devices and Windows come with. The list groups them by region, best first, hides novelty voices, marks the ones that send what they read online, and reads a sample in each voice you pick, which **Preview** plays again. |
| **Reading speed** | How fast replies and messages are read, from 0.75× to 2×. |
| **Read aloud buttons** | Adds a button beside the copy button on the agent's messages that reads the message aloud, or stops reading it. <kbd>Esc</kbd> stops it too. |

### Notifications

| Name | What it does |
| :-- | :-- |
| **Tab status** | Shows the agent's status in the tab's title and icon, and counts the conversations that need your input on the installed app's icon. |
| **Desktop notifications** | Notifies you when the agent finishes or needs you while you're away. |
| **Notification sounds** | Chimes when the agent needs your confirmation while you're away. |
| **Unread markers** | Marks the conversations in the sidebar that changed since you last had them open. |
| **Check for changes every** | How often the settings above ask the Agent Server for changes: from every 5 seconds to every 5 minutes, every 10 seconds by default. |

### Accessibility

| Name | What it does |
| :-- | :-- |
| **Font size** | Makes Canvas's text, and the space around it, smaller or larger, from 75% to 150%, on top of your browser's own font size. |
| **Reduce motion** | Stops Canvas's spinners, pulses, fades and slides, whatever your system's motion setting. |
| **Clear links and focus** | Underlines every link, not only on hover, and outlines what has keyboard focus in a thick ring. |
| **Bigger tap targets** | Makes buttons and sidebar rows at least 44 pixels tall on touch screens. |

### Phone and app

| Name | What it does |
| :-- | :-- |
| **Installable app** | Lets your browser install Canvas as an app, with New chat and Settings shortcuts and a title bar in Canvas's colours, clear of notches and home indicators. |
| **Mobile fixes** | On phones and tablets, keeps the message box above the browser's toolbar, opens the sidebar across the whole screen without conversation previews running off it, shows buttons that otherwise only appear on hover, keeps Canvas's dialogs on screen, scrolling when they're taller, and stops the Automate tabs cutting off their names. |


## Install

Extras is checked against OpenHands 1.40. It needs a local Agent Server, as Canvas doesn't offer apps on OpenHands Cloud backends.

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
- The settings page is an app page, which Canvas serves at `/extensions/agent-canvas-app-extras/settings`, as it has no way for an app to add a page under Customize. The app adds the settings page to Customize's menu itself, and hides its own sidebar link.
- Canvas has no app API for settings, tab titles or page styles yet. The app works with Canvas's markup directly (its app card, chat, sidebar and title), so an OpenHands update that changes it can break a feature.
- Voice chat reads replies with the browser's own voices (`speechSynthesis`), so nothing leaves your machine beyond what Canvas's mic already sends. While it waits for a reply it asks the Agent Server about that one conversation every 2 seconds. Hands-free opens a second stream from the mic to hear when you've stopped talking, as Canvas's mic gives no sign of it.
- Voice ranks the browser's voices with Readium Speech's recommended voices, under its BSD 3-Clause license, which [`src/voices-en.js`](src/voices-en.js) carries. `npm run voices` rebuilds that file from the Readium commit pinned in [`scripts/voices.js`](scripts/voices.js), keeping only English, its 10 highest rated voices and the best each other platform preloads, so the bundle stays small.
- Settings, runs that ended while you were away, what you've read and the conversation you're looking at are kept in the browser's `localStorage`, under `openhands-extras:settings`, `:unseen`, `:read` and `:viewing`, so they're per browser rather than per backend.
- While a feature that needs conversation statuses is on, the app asks the Agent Server for them, and for unread markers, in one request when the chat changes, at most once per **Check for changes every**, and that often while a run is going or for the counts and unread markers. Unread markers asks about every conversation in the sidebar at most once a minute, as the Agent Server sends each one's whole history of costs, and in between only about new ones. Nothing is requested while those features are off, and unread markers rest while the tab is hidden.

### Tests

The tests run `extension.js` against a Canvas-like page in [jsdom](https://github.com/jsdom/jsdom) with Node's built-in test runner. They need Node 20.19, 22.13 or 24 and newer.

```
npm install
npm test
```

GitHub Actions runs them on every pull request and push to `master`.

## License

[MIT](LICENSE)
