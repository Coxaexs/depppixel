# 🎲 Custom Monopoly Game - Online Multiplayer

A fully customizable, online multiplayer Monopoly-like board game with real-time synchronization using Firebase.

## ✨ Features

### 🎮 Gameplay
- **Real-time multiplayer** - Play with friends online
- **2-8 players** support
- **Customizable board** - Edit property names, prices, and values
- **Trading system** - Trade properties and money with other players
- **Chance & Community Chest cards** - Random events to spice up gameplay
- **Property management** - Buy properties, build houses and hotels
- **Jail mechanics** - Roll doubles, pay fine, or use cards to escape
- **Bankruptcy detection** - Players who run out of money are eliminated

### ⚙️ Customization
- Starting money amount
- Pass GO bonus amount
- Maximum player count (2-8)
- Enable/disable trading
- Edit all property names and prices
- Custom Chance and Community Chest cards (coming soon)
- Board layout customization

### 🤖 Additional Features
- **Game lobby system** - Host creates game, others join with Game ID
- **Real-time game state** - All players see updates instantly
- **Persistent player IDs** - Reconnect if disconnected
- **Visual game board** - See player pieces, property ownership, houses/hotels
- **Game log** - Track all actions and events
- **Responsive design** - Works on desktop and mobile

## 🚀 Quick Start

### Prerequisites
- A Firebase account (free tier works!)
- A modern web browser
- A local web server (optional, but recommended)
## 🎯 How to Play

### Creating a Game

1. Enter your name
2. Click "Create New Game"
3. Customize game settings:
   - Starting money
   - Pass GO amount
   - Maximum players
   - Trading enabled/disabled
   - Property names and prices
4. Share the **Game ID** with friends
5. Wait for players to join
6. Click "Start Game" when ready

### Joining a Game

1. Enter your name
2. Get the Game ID from the host
3. Enter the Game ID
4. Click "Join Game"
5. Wait for the host to start

### Playing Your Turn

1. **Roll Dice** - Click to roll and move
2. **Landing on Properties**:
   - **Unowned** - Choose to buy or decline
   - **Owned by others** - Pay rent automatically
   - **Owned by you** - Nothing happens
3. **Manage Properties** - Build houses/hotels on your properties
4. **Trading** - Click "Trade" button on another player to propose trades
5. **End Turn** - Click when done to pass to next player

### Special Spaces

- **GO** - Collect money when passing
- **Jail** - Roll doubles, pay $50, or use Get Out of Jail card
- **Chance/Community Chest** - Draw a random card
- **Tax** - Pay the required amount
- **Go To Jail** - Sent directly to jail
- **Free Parking** - Just visiting, no effect

## 🔧 Troubleshooting

### "Firebase initialization error"
- Check that you've replaced the Firebase config with your actual values
- Make sure you've created a Firebase project
- Verify your API key is correct

### "Could not create game"
- Check browser console (F12) for errors
- Verify Firestore is enabled in your Firebase project
- Check that security rules allow write access

### "Game not found"
- Double-check the Game ID (case-sensitive)
- Make sure the host successfully created the game
- Check your internet connection

### Players can't see updates
- Verify all players are using the same Firebase project
- Check that Firestore rules allow read access
- Refresh the page and try again

### File:// Protocol Issues
- Use a local web server instead of opening the file directly
- Modern browsers restrict Firebase operations on file:// URLs

## 🎨 Customization Ideas

### Easy Customizations
- Change player starting money
- Adjust property prices
- Modify rent values
- Change property names to match your theme
- Adjust max players (2-8)

### Advanced Customizations (Edit the code)
- Add custom Chance/Community Chest cards
- Create different board layouts
- Add new property types
- Implement time limits per turn
- Add sound effects
- Create different game modes

## 🤖 Bot Support (Coming Soon)

Currently, the game supports multiplayer with human players. Bot support can be added by:
1. Creating an AI player that makes decisions
2. Implementing strategy logic for buying/trading
3. Auto-rolling dice on bot turns

## 📝 Todo / Upcoming Features

- [ ] Bot players with AI
- [ ] Custom card editor UI
- [ ] Mortgage properties
- [ ] Auction system for declined properties
- [ ] Player statistics and leaderboards
- [ ] Game replays
- [ ] Voice chat integration
- [ ] Mobile app version
- [ ] Tournament mode
- [ ] Custom themes/skins
- [ ] Save/load game state

## 🐛 Known Issues

- Card actions are simplified (not all effects implemented)
- No mortgage system yet
- Railroad/utility rent calculation may need refinement
- Bankruptcy doesn't redistribute properties yet

## 📄 License

Free to use and modify for personal and educational purposes.

## 🤝 Contributing

Feel free to fork, modify, and improve! Share your enhancements!

## 🎉 Have Fun!

Enjoy playing your custom Monopoly game with friends! Feel free to customize everything to make it your own unique experience.

---
