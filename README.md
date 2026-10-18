# Agent Canvas App: Extras

An [OpenHands](https://www.openhands.dev/) Agent Canvas app which adds a few extra UI tweaks, along with agent status in your browser tab and desktop notifications.

## Features

| Name | Description |
| :-- | :-- |
| **Wide Canvas** | Removes the maximum width cap from the chat window so the conversation fills the full canvas width. |
| **Tab status** | Shows the open conversation's status in the browser tab. ⏳ ✋ ⏸️ ✅ or ❌. The tab icon gets a matching coloured dot. Runs you opened in the tab that are still going elsewhere are counted too, like `⏳3` or `✅ ⏳2`. |
| **Desktop notifications** | Notifies you when the agent finishes if the tab is in the background or the window isn't focused. |
| **App icon badge** | Shows how many conversations need your input on the icon of Canvas installed as an app (Chrome, Edge or Safari's Add to Dock): runs that ended or need your confirmation while you were away, until you open them. Safari only shows it once notifications are allowed. With several Canvas windows open, the last one to update sets the badge. |
| **Confirmation sound** | Plays a short chime when the agent needs your confirmation if the tab is in the background or the window isn't focused. |

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
- Tab status, notifications, the confirmation sound and the app icon badge ask the Agent Server for conversation statuses in one request (`GET /api/conversations?ids=…`), only while one of them is on: at most every 3 seconds while the chat is updating or when you come back to the tab, plus every 15 seconds while a run is going. Idle and finished conversations aren't polled.

### Tests

The tests run `extension.js` against a Canvas-like page in [jsdom](https://github.com/jsdom/jsdom) with Node's built-in test runner. They need Node 20.19, 22.13 or 24 and newer.

```
npm install
npm test
```

GitHub Actions runs them on every pull request and push to `master`.

## License

[MIT](LICENSE)
