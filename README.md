# Discord Onboarding Bot

A comprehensive Discord bot for member onboarding with CAPTCHA verification, profile collection, alliance selection, and admin management features.

## Features

- **CAPTCHA Verification**: Human verification for new members
- **Profile Collection**: Collects in-game name, timezone, and language
- **Alliance Selection**: Members can choose from predefined alliances
- **Web Dashboard**: Real-time statistics and member management
- **Admin Commands**: User management and onboarding tools
- **Automated Reporting**: Hourly statistics to mod channels

## Setup

### Prerequisites

- Node.js 16.9.0 or higher
- Discord Bot Token
- Discord Application with proper intents enabled

### Installation

1. Clone the repository:
```bash
git clone https://github.com/honeybadger2121-home/Region40Bot_tags.git
cd Region40Bot_tags
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
BOT_TOKEN=your_discord_bot_token_here
```

4. Configure Discord Bot Intents:
   - Enable "Server Members Intent"
   - Enable "Message Content Intent"
   - Enable "Presence Intent"

### Running the Bot

#### Production Mode
```bash
# Start bot only
npm start

# Start dashboard only
npm run dashboard

# Start both bot and dashboard (recommended)
npm run both-trace

# Start both with concurrently (may show deprecation warnings)
npm run both
```

#### Development Mode
```bash
# Start bot only in development mode
npm run dev

# Start dashboard only in development mode
npm run dev-dashboard

# Start both in development mode
npm run dev-both
```

#### Debug Mode
```bash
# Start bot with debugger and detailed traces
npm run debug

# Start dashboard with debugger and detailed traces
npm run debug-dashboard
```

#### View Available Commands
```bash
npm run help
```

## Usage

### Bot Commands

- `/profile view` - View your profile
- `/profile edit` - Edit your profile
- `/alliance list` - List available alliances
- `/alliance change` - Change your alliance
- `/onboard @user` - Send onboarding DM to a specific user
- `/onboard-all` - Send onboarding DM to all server members (Admin only)
- `/dashboard` - Get dashboard link
- `/status` - Check your onboarding status
- `/reset-onboarding @user` - Reset a user's profile (Admin only)

### Web Dashboard

Access the web dashboard at `http://localhost:3000` to view:
- Total user statistics
- Verification progress
- Alliance distribution
- Recent onboardings

## Configuration

### Alliance Setup

Edit the alliance options in `index.js`:
```javascript
const allianceOptions = [
  { label: 'ANQA', value: 'ANQA', emoji: '💛' },
  { label: 'JAXA', value: 'JAXA', emoji: '🤍' },
  // Add more alliances here
];
```

### Channel Configuration

The bot looks for these channels:
- `welcome` - Welcome messages for new members
- `mod-log` - Logging and statistics

## Database

The bot uses SQLite with the following schema:
- `userId` - Discord user ID
- `inGameName` - Member's in-game name
- `timezone` - Member's timezone/country
- `language` - Preferred language
- `alliance` - Selected alliance
- `verified` - Verification status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Legal

- [Terms of Service](TERMS_OF_SERVICE.md)
- [Privacy Policy](PRIVACY_POLICY.md)

## Support

For support or questions, please open an issue on GitHub.
