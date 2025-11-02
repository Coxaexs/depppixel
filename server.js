const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// Create HTTP server to serve files
const server = http.createServer((req, res) => {
    // Parse URL to get path without query string
    const parsedUrl = url.parse(req.url);
    let filePath = '.' + parsedUrl.pathname;
    if (filePath === './') filePath = './index.html';
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.ico': 'image/x-icon',
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error: '+error.code);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content, 'utf-8');
        }
    });
});

console.log('🟢 Starting Monopoly WebSocket server...');
// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Game storage
const games = new Map();

// Helper functions
function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Her oyuncuya benzersiz renk ata
const availableColors = [
    '#EF4444',  // Parlak Kırmızı
    '#3B82F6',  // Parlak Mavi
    '#10B981',  // Parlak Yeşil
    '#F59E0B',  // Parlak Turuncu
    '#8B5CF6',  // Parlak Mor
    '#EC4899',  // Parlak Pembe
    '#06B6D4',  // Parlak Cyan
    '#F97316'   // Parlak Koyu Turuncu
];

function assignUniqueColor(game) {
    // Kullanılmış renkleri bul
    const usedColors = game.players.map(p => p.color).filter(c => c);
    // Kullanılmamış renkleri bul
    const unusedColors = availableColors.filter(color => !usedColors.includes(color));
    // İlk kullanılmamış rengi döndür veya rastgele bir renk
    return unusedColors.length > 0 ? unusedColors[0] : availableColors[game.players.length % availableColors.length];
}

function broadcastToGame(gameId, message, excludeClientId = null) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && 
            client.gameId === gameId && 
            client.clientId !== excludeClientId) {
            client.send(JSON.stringify(message));
        }
    });
}

function getDefaultBoard() {
    return [
        { name: "GO", type: "go" },
        { name: "Mediterranean Ave", type: "property", price: 60, rent: [2, 10, 30, 90, 160, 250], color: "#a55a40", houseCost: 50 },
        { name: "Community Chest", type: "community_chest" },
        { name: "Baltic Ave", type: "property", price: 60, rent: [4, 20, 60, 180, 320, 450], color: "#a55a40", houseCost: 50 },
        { name: "Income Tax", type: "tax", amount: 200 },
        { name: "Reading Railroad", type: "railroad", price: 200 },
        { name: "Oriental Ave", type: "property", price: 100, rent: [6, 30, 90, 270, 400, 550], color: "#add8e6", houseCost: 50 },
        { name: "Chance", type: "chance" },
        { name: "Vermont Ave", type: "property", price: 100, rent: [6, 30, 90, 270, 400, 550], color: "#add8e6", houseCost: 50 },
        { name: "Connecticut Ave", type: "property", price: 120, rent: [8, 40, 100, 300, 450, 600], color: "#add8e6", houseCost: 50 },
        { name: "Jail / Just Visiting", type: "jail" },
        { name: "St. Charles Place", type: "property", price: 140, rent: [10, 50, 150, 450, 625, 750], color: "#d25298", houseCost: 100 },
        { name: "Electric Company", type: "utility", price: 150 },
        { name: "States Ave", type: "property", price: 140, rent: [10, 50, 150, 450, 625, 750], color: "#d25298", houseCost: 100 },
        { name: "Virginia Ave", type: "property", price: 160, rent: [12, 60, 180, 500, 700, 900], color: "#d25298", houseCost: 100 },
        { name: "Pennsylvania Railroad", type: "railroad", price: 200 },
        { name: "St. James Place", type: "property", price: 180, rent: [14, 70, 200, 550, 750, 950], color: "#f7941e", houseCost: 100 },
        { name: "Community Chest", type: "community_chest" },
        { name: "Tennessee Ave", type: "property", price: 180, rent: [14, 70, 200, 550, 750, 950], color: "#f7941e", houseCost: 100 },
        { name: "New York Ave", type: "property", price: 200, rent: [16, 80, 220, 600, 800, 1000], color: "#f7941e", houseCost: 100 },
        { name: "Free Parking", type: "free_parking" },
        { name: "Kentucky Ave", type: "property", price: 220, rent: [18, 90, 250, 700, 875, 1050], color: "#ed1c24", houseCost: 150 },
        { name: "Chance", type: "chance" },
        { name: "Indiana Ave", type: "property", price: 220, rent: [18, 90, 250, 700, 875, 1050], color: "#ed1c24", houseCost: 150 },
        { name: "Illinois Ave", type: "property", price: 240, rent: [20, 100, 300, 750, 925, 1100], color: "#ed1c24", houseCost: 150 },
        { name: "B. & O. Railroad", type: "railroad", price: 200 },
        { name: "Atlantic Ave", type: "property", price: 260, rent: [22, 110, 330, 800, 975, 1150], color: "#ffeb3b", houseCost: 150 },
        { name: "Ventnor Ave", type: "property", price: 260, rent: [22, 110, 330, 800, 975, 1150], color: "#ffeb3b", houseCost: 150 },
        { name: "Water Works", type: "utility", price: 150 },
        { name: "Marvin Gardens", type: "property", price: 280, rent: [24, 120, 360, 850, 1025, 1200], color: "#ffeb3b", houseCost: 150 },
        { name: "Go to Jail", type: "go_to_jail" },
        { name: "Pacific Ave", type: "property", price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: "#4caf50", houseCost: 200 },
        { name: "North Carolina Ave", type: "property", price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: "#4caf50", houseCost: 200 },
        { name: "Community Chest", type: "community_chest" },
        { name: "Pennsylvania Ave", type: "property", price: 320, rent: [28, 150, 450, 1000, 1200, 1400], color: "#4caf50", houseCost: 200 },
        { name: "Short Line", type: "railroad", price: 200 },
        { name: "Chance", type: "chance" },
        { name: "Park Place", type: "property", price: 350, rent: [35, 175, 500, 1100, 1300, 1500], color: "#2196f3", houseCost: 200 },
        { name: "Luxury Tax", type: "tax", amount: 100 },
        { name: "Boardwalk", type: "property", price: 400, rent: [50, 200, 600, 1400, 1700, 2000], color: "#2196f3", houseCost: 200 }
    ];
}

const defaultCards = {
    chance: [
        { text: "Advance to Go (Collect $200)", action: "move_to", space: 0, collect: true },
        { text: "Advance to Illinois Ave.", action: "move_to", space: 24 },
        { text: "Advance to St. Charles Place.", action: "move_to", space: 11 },
        { text: "Bank pays you dividend of $50.", action: "add_money", amount: 50 },
        { text: "Get Out of Jail Free.", action: "get_out_of_jail" },
        { text: "Go Back 3 Spaces.", action: "move_back", amount: 3 },
        { text: "Go to Jail. Go directly to Jail.", action: "go_to_jail" },
        { text: "Pay poor tax of $15.", action: "remove_money", amount: 15 },
        { text: "Your building loan matures. Collect $150.", action: "add_money", amount: 150 },
        { text: "Speeding fine $50.", action: "remove_money", amount: 50 },
        { text: "Pay school fees of $50.", action: "remove_money", amount: 50 },
        { text: "Take a trip to Reading Railroad.", action: "move_to", space: 5 },
        { text: "Advance to Boardwalk.", action: "move_to", space: 39 },
        { text: "Make general repairs on all properties. $25 per house, $100 per hotel.", action: "repair", house: 25, hotel: 100 },
    ],
    community_chest: [
        { text: "Advance to Go (Collect $200).", action: "move_to", space: 0, collect: true },
        { text: "Bank error in your favor. Collect $200.", action: "add_money", amount: 200 },
        { text: "Doctor's fees. Pay $50.", action: "remove_money", amount: 50 },
        { text: "From sale of stock you get $50.", action: "add_money", amount: 50 },
        { text: "Get Out of Jail Free.", action: "get_out_of_jail" },
        { text: "Go to Jail. Go directly to Jail.", action: "go_to_jail" },
        { text: "Holiday fund matures. Receive $100.", action: "add_money", amount: 100 },
        { text: "Income tax refund. Collect $20.", action: "add_money", amount: 20 },
        { text: "Life insurance matures. Collect $100.", action: "add_money", amount: 100 },
        { text: "Pay hospital fees of $100.", action: "remove_money", amount: 100 },
        { text: "You inherit $100.", action: "add_money", amount: 100 },
        { text: "You have won second prize in a beauty contest. Collect $10.", action: "add_money", amount: 10 },
        { text: "Receive $25 consultancy fee.", action: "add_money", amount: 25 },
        { text: "Street repairs. $40 per house, $115 per hotel.", action: "repair", house: 40, hotel: 115 },
    ]
};

// WebSocket connection handler
// WebSocket connection handler
wss.on('connection', (ws, req) => {
    ws.clientId = Math.random().toString(36).substring(7);
    const ip = req && req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
    console.log(`✅ Client connected: ${ws.clientId} from ${ip}`);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log(`📩 Received from ${ws.clientId}:`, message.type);
            
            switch(message.type) {
                case 'create_game':
                    handleCreateGame(ws, message);
                    break;
                case 'join_game':
                    handleJoinGame(ws, message);
                    break;
                case 'rejoin_game':
                    handleRejoinGame(ws, message);
                    break;
                case 'start_game':
                    handleStartGame(ws, message);
                    break;
                case 'update_game':
                    handleUpdateGame(ws, message);
                    break;
                case 'get_game':
                    handleGetGame(ws, message);
                    break;
                case 'chat_message':
                    handleChatMessage(ws, message);
                    break;
                case 'list_games':
                    handleListGames(ws, message);
                    break;
                case 'declare_bankruptcy':
                    handleDeclareBankruptcy(ws, message);
                    break;
                case 'add_bot':
                    handleAddBot(ws, message);
                    break;
                case 'roll_dice':
                    // Bot veya oyuncu zar atmak istediğinde
                    handleRollDice(ws, message);
                    break;
                case 'buy_property':
                    // Bot veya oyuncu mülk almak istediğinde
                    handleBuyProperty(ws, message);
                    break;
                case 'end_turn':
                    // Bot veya oyuncu turnunu bitirmek istediğinde
                    handleEndTurn(ws, message);
                    break;
                case 'voice_join':
                    // Player joined voice chat
                    handleVoiceJoin(ws, message);
                    break;
                case 'voice_leave':
                    // Player left voice chat
                    handleVoiceLeave(ws, message);
                    break;
                case 'voice_signal':
                    // WebRTC signaling
                    handleVoiceSignal(ws, message);
                    break;
                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        } catch (error) {
            console.error('❌ Error processing message:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });
    
    ws.on('close', () => {
        console.log(`❌ Client disconnected: ${ws.clientId}`);
    });
});

function handleCreateGame(ws, message) {
    const gameId = message.gameId || generateGameId();
    const { player, settings, private: isPrivate } = message;
    
    const newGame = {
        gameId,
        hostId: player.id,
        players: [player],
        state: 'lobby',
        private: isPrivate || false,
        settings: {
            ...settings,
            board: settings.board || getDefaultBoard()
        },
        trade: null,
        voiceChat: [], // Track players in voice chat
        createdAt: Date.now()
    };
    
    games.set(gameId, newGame);
    ws.gameId = gameId;
    ws.playerId = player.id;
    
    ws.send(JSON.stringify({
        type: 'game_created',
        gameId,
        game: newGame
    }));
    
    console.log(`🎮 Game created: ${gameId}`);
}

function handleJoinGame(ws, message) {
    const { gameId, player } = message;
    const game = games.get(gameId);
    
    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }
    
    // Allow joining even if game is playing (late join)
    const isLateJoin = game.state === 'playing';
    
    if (!isLateJoin && game.players.length >= game.settings.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game is full' }));
        return;
    }
    
    // If late joining, give player starting money
    if (isLateJoin) {
        player.money = game.settings.startingMoney || 1500;
        player.position = 0;
        player.inJail = false;
        player.jailTurns = 0;
        player.isBankrupt = false;
        player.isLucky = false;
        player.luckyTurnsLeft = 0;
        player.jailCount = 0;
        player.doublesCount = 0;
        console.log(`🎮 Late join: ${player.name} joining with $${player.money}`);
    }
    
    // Her oyuncuya benzersiz renk ata
    if (!player.color || player.color === '') {
        player.color = assignUniqueColor(game);
        console.log(`🎨 Assigned color ${player.color} to ${player.name}`);
    }
    
    // Check if player already in game
    if (!game.players.find(p => p.id === player.id)) {
        game.players.push(player);
    }
    
    ws.gameId = gameId;
    ws.playerId = player.id;
    
    // Send game state to joining player
    ws.send(JSON.stringify({
        type: 'game_joined',
        gameId,
        game
    }));
    
    // Broadcast to all other players
    broadcastToGame(gameId, {
        type: 'game_updated',
        game
    }, ws.clientId);
    
    console.log(`👤 Player ${player.name} joined game ${gameId}`);
}

function handleRejoinGame(ws, message) {
    const { gameId, playerId } = message;
    const game = games.get(gameId);
    
    if (!game) {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Game not found. The game may have ended.' 
        }));
        return;
    }
    
    // Find the player in the game
    const player = game.players.find(p => p.id === playerId);
    
    if (!player) {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Player not found in this game. You may have been removed.' 
        }));
        return;
    }
    
    if (player.isBankrupt) {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Cannot rejoin - you are bankrupt in this game.' 
        }));
        return;
    }
    
    // Reconnect the websocket
    ws.gameId = gameId;
    ws.playerId = playerId;
    
    // Send successful reconnection
    ws.send(JSON.stringify({
        type: 'game_joined',
        gameId,
        game,
        reconnected: true
    }));
    
    // Send updated game state
    ws.send(JSON.stringify({
        type: 'game_updated',
        game
    }));
    
    console.log(`🔄 Player ${player.name} (${playerId}) reconnected to game ${gameId}`);
    
    // Notify other players
    broadcastToGame(gameId, {
        type: 'player_reconnected',
        playerName: player.name,
        playerId: playerId
    }, ws.clientId);
}

function handleStartGame(ws, message) {
    const { gameId, settings, players } = message;
    const game = games.get(gameId);
    
    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }
    
    // Update settings and players if provided
    if (settings) {
        game.settings = { ...game.settings, ...settings };
    }
    if (players) {
        game.players = players;
    }
    
    // Initialize game state
    game.state = 'playing';
    game.properties = game.settings.board.map((p, i) => ({ 
        spaceIndex: i, 
        ownerId: null, 
        houses: 0 
    }));
    game.currentPlayerIndex = 0;
    game.turnState = 'start';
    game.lastDiceRoll = [0, 0];
    game.spaceVisits = new Array(game.settings.board.length).fill(0); // Kare ziyaret istatistikleri
    game.gameLog = [`Game started with ${game.players.length} players! It's ${game.players[0].name}'s turn.`];
    
    // Broadcast game start to all players
    broadcastToGame(gameId, {
        type: 'game_started',
        game
    });
    
    // Also send to the host
    ws.send(JSON.stringify({
        type: 'game_started',
        game
    }));
    
    console.log(`🚀 Game ${gameId} started with ${game.players.length} players`);
}

function handleUpdateGame(ws, message) {
    const { gameId, updates } = message;
    const game = games.get(gameId);
    
    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }
    
    // Apply updates to game state
    Object.assign(game, updates);
    
    // Broadcast to all players including sender
    broadcastToGame(gameId, {
        type: 'game_updated',
        game
    });
    
    // Also send to sender
    ws.send(JSON.stringify({
        type: 'game_updated',
        game
    }));
}

function handleGetGame(ws, message) {
    const { gameId } = message;
    const game = games.get(gameId);
    
    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }
    
    ws.gameId = gameId;
    ws.send(JSON.stringify({
        type: 'game_state',
        game
    }));
}

function handleChatMessage(ws, message) {
    console.log('Handling chat message:', message);
    
    const { gameId, playerName, text } = message;
    
    if (!gameId || !playerName || !text) {
        console.log('Invalid chat message data:', { gameId, playerName, text: !!text });
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid chat message data' }));
        return;
    }
    
    const game = games.get(gameId);
    if (!game) {
        console.log('Game not found for chat:', gameId);
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }
    
    // Sanitize message
    const sanitizedText = text.trim().substring(0, 200);
    if (!sanitizedText) {
        console.log('Empty sanitized text');
        return;
    }
    
    const chatMessage = {
        type: 'chat_message',
        playerName: playerName.substring(0, 50), // Limit name length
        text: sanitizedText,
        timestamp: Date.now()
    };
    
    console.log('Broadcasting chat message to game:', gameId);
    // Broadcast to all players in the game
    broadcastToGame(gameId, chatMessage);
}

function handleListGames(ws, message) {
    const publicGames = [];
    
    for (const [gameId, game] of games.entries()) {
        if (!game.private && game.state === 'lobby') {
            publicGames.push({
                gameId,
                hostName: game.players[0]?.name || 'Unknown',
                playerCount: game.players.length,
                maxPlayers: game.settings?.maxPlayers || 4,
                map: game.settings?.map || 'classic'
            });
        }
    }
    
    ws.send(JSON.stringify({
        type: 'games_list',
        games: publicGames
    }));
}

function handleDeclareBankruptcy(ws, message) {
    const { playerId } = message;
    const gameId = ws.gameId;
    
    if (!gameId || !games.has(gameId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }
    
    const game = games.get(gameId);
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
        ws.send(JSON.stringify({ type: 'error', message: 'Player not found' }));
        return;
    }
    
    const player = game.players[playerIndex];
    
    // Mark player as bankrupt
    player.isBankrupt = true;
    
    // Free up all properties owned by this player
    if (game.properties) {
        game.properties.forEach((prop, index) => {
            if (prop.ownerId === playerId) {
                // Reset property ownership
                prop.ownerId = null;
                prop.houses = 0;
                prop.mortgaged = false;
                // Reset ownership shares if they exist
                if (prop.owners) {
                    delete prop.owners[playerId];
                }
            }
        });
    }
    
    // Add to game log
    game.gameLog = game.gameLog || [];
    game.gameLog.push(`💥 ${player.name} declared bankruptcy and left the game!`);
    
    // Check if game should end (only one player left)
    const activePlayers = game.players.filter(p => !p.isBankrupt);
    if (activePlayers.length === 1) {
        game.state = 'finished';
        game.winner = activePlayers[0];
        game.gameLog.push(`🏆 ${activePlayers[0].name} wins the game!`);
    }
    
    // Broadcast updated game state
    broadcastToGame(gameId, {
        type: 'game_updated',
        game: game
    });
    
    console.log(`💥 Player ${player.name} declared bankruptcy in game ${gameId}`);
}

function handleAddBot(ws, message) {
    const gameId = ws.gameId;
    
    if (!gameId || !games.has(gameId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }
    
    const game = games.get(gameId);
    
    // Check if game is in lobby state
    if (game.state !== 'lobby') {
        ws.send(JSON.stringify({ type: 'error', message: 'Cannot add bot after game has started' }));
        return;
    }
    
    // Check if there's room for another player
    if (game.players.length >= game.settings.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game is full' }));
        return;
    }
    
    // Create bot player
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const botNames = ['Bot Flo', 'Bot Kiwi', 'Bot Escanor', 'Bot Vallhol', 'Bot Shan', 'Bot Frank'];
    // Mevcut oyuncuların isimlerini al
    const existingBotNames = game.players.filter(p => p.isBot).map(p => p.name);
    // Kullanılmamış bot ismini seç
    const availableBotNames = botNames.filter(name => !existingBotNames.includes(name));
    if (availableBotNames.length === 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'No more bots available' }));
        return;
    }
    const botName = availableBotNames[Math.floor(Math.random() * availableBotNames.length)];
    const botCharacters = ['dog', 'car', 'ship', 'hat', 'thimble', 'boot', 'wheelbarrow', 'iron'];
    let botCharacter, botEmoji;
    
    // Bot karakterini seç
    if (botName === 'Bot Shan') {
        botCharacter = 'shan';
        botEmoji = '💩';
    } else if(botName == 'Bot Kiwi'){
        botCharacter = 'bot kiwi';
        botEmoji = '🥝'; 
    }
    else if(botName == 'Bot Flo'){
        botCharacter = 'bot flo';
        botEmoji = '⚓'; 
    }
    else {
        botCharacter = botCharacters[Math.floor(Math.random() * botCharacters.length)];
        botEmoji = undefined;
    }
    
    const botPlayer = {
        id: botId,
        name: botName,
        color: '', // Benzersiz renk atanacak
        character: botCharacter,
        emoji: botEmoji,
        money: game.settings.startingMoney || 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        isBot: true,
        connected: true
    };
    
    // Bot'a benzersiz renk ata
    botPlayer.color = assignUniqueColor(game);
    console.log(`🎨 Assigned color ${botPlayer.color} to ${botName}`);
    
    game.players.push(botPlayer);
    game.gameLog = game.gameLog || [];
    game.gameLog.push(`🤖 Bot ${botName} joined the game!`);
    
    // Broadcast updated game state
    broadcastToGame(gameId, {
        type: 'game_updated',
        game: game
    });
    
    console.log(`🤖 Bot ${botName} added to game ${gameId}`);
}

// Bot ve oyuncu için zar atma, mülk alma ve turu bitirme işlemlerini loglamak için temel handler fonksiyonları
// Güvenli rastgele sayı üretici (Node.js crypto modülü ile)
function secureRandomInt(min, max) {
    const range = max - min + 1;
    const maxValid = Math.floor(256 / range) * range - 1;
    let randomValue;
    do {
        const randomArray = crypto.randomBytes(1);
        randomValue = randomArray[0];
    } while (randomValue > maxValid);
    return min + (randomValue % range);
}

function handleRollDice(ws, message) {
    const gameId = ws.gameId;
    if (!gameId || !games.has(gameId)) {
        console.log('⚠️ handleRollDice: No gameId or game not found');
        return;
    }
    const game = games.get(gameId);
    const player = game.players[game.currentPlayerIndex];
    if (!player || player.isBankrupt) {
        console.log('⚠️ handleRollDice: No player or player bankrupt');
        return;
    }
    console.log(`🎲 ${player.name} rolling dice...`);
    // Zar at - Güvenli rastgele sayı ile
    const die1 = secureRandomInt(1, 6);
    const die2 = secureRandomInt(1, 6);
    const total = die1 + die2;
    player.position = (player.position + total) % game.settings.board.length;
    
    // Kare ziyaret istatistiklerini güncelle
    if (!game.spaceVisits) {
        game.spaceVisits = new Array(game.settings.board.length).fill(0);
    }
    game.spaceVisits[player.position] = (game.spaceVisits[player.position] || 0) + 1;
    
    game.lastDiceRoll = [die1, die2];
    game.turnState = 'rolled';
    game.gameLog = game.gameLog || [];
    game.gameLog.push(`🎲 ${player.name} rolled ${die1} + ${die2} = ${total}`);
    
    // Şans veya Kamu Sandığı kartına geldiyse kart çek
    const landedSpace = game.settings.board[player.position];
    
    if (landedSpace.type === 'chance' || landedSpace.type === 'community_chest') {
        const deck = landedSpace.type === 'chance' ? defaultCards.chance : defaultCards.community_chest;
        const card = deck[Math.floor(Math.random() * deck.length)];
        game.gameLog.push(`🃏 ${player.name} drew a card: ${card.text}`);
        // Basit kart efektleri
        if (card.action === 'add_money') {
            player.money += card.amount;
        } else if (card.action === 'remove_money') {
            player.money -= card.amount;
        } else if (card.action === 'move_to') {
            player.position = card.space;
            if (card.collect) player.money += 200;
        } else if (card.action === 'move_back') {
            player.position = (player.position - card.amount + game.settings.board.length) % game.settings.board.length;
        } else if (card.action === 'go_to_jail') {
            player.position = 10; // Jail
            player.inJail = true;
        }
    }
    
    // Tax kontrolü (Income Tax, Luxury Tax)
    if (landedSpace.type === 'tax') {
        const taxAmount = landedSpace.price;
        player.money -= taxAmount;
        game.gameLog.push(`💰 ${player.name} paid $${taxAmount} in ${landedSpace.name}`);
        console.log(`💰 ${player.name} paid tax: $${taxAmount}`);
    }
    
    // Kira kontrolü - başka oyuncunun mülküne geldiyse
    if (landedSpace.type === 'property') {
        const prop = game.properties[player.position];
        if (prop && prop.ownerId && prop.ownerId !== player.id) {
            const owner = game.players.find(p => p.id === prop.ownerId);
            if (owner && !owner.isBankrupt) {
                // rent is an array: [base, 1 house, 2 houses, 3 houses, 4 houses, hotel]
                const houses = prop.houses || 0;
                const rent = landedSpace.rent ? landedSpace.rent[houses] : landedSpace.price * 0.1;
                
                player.money -= rent;
                owner.money += rent;
                game.gameLog.push(`💵 ${player.name} paid $${rent} rent to ${owner.name} for ${landedSpace.name}`);
                console.log(`💵 ${player.name} paid rent: $${rent} to ${owner.name}`);
            }
        }
    }
    
    // Broadcast
    broadcastToGame(gameId, { type: 'game_updated', game });
    // Ayrıca sender'a da gönder
    ws.send(JSON.stringify({ type: 'game_updated', game }));
}

function handleBuyProperty(ws, message) {
    const gameId = ws.gameId;
    if (!gameId || !games.has(gameId)) {
        console.log('⚠️ handleBuyProperty: No gameId or game not found');
        return;
    }
    const game = games.get(gameId);
    const player = game.players[game.currentPlayerIndex];
    if (!player || player.isBankrupt) {
        console.log('⚠️ handleBuyProperty: No player or player bankrupt');
        return;
    }
    const position = player.position;
    const prop = game.properties[position];
    const space = game.settings.board[position];
    
    console.log(`🏠 ${player.name} trying to buy property at position ${position}`);
    console.log(`   Space: ${space ? space.name : 'N/A'} (type: ${space ? space.type : 'N/A'})`);
    console.log(`   Property ownerId: ${prop ? prop.ownerId : 'N/A'}`);
    console.log(`   Player money: $${player.money}, Price: $${space ? space.price : 'N/A'}`);
    
    if (space && space.type === 'property' && prop && !prop.ownerId && player.money >= space.price) {
        prop.ownerId = player.id;
        player.money -= space.price;
        game.gameLog = game.gameLog || [];
        game.gameLog.push(`🏠 ${player.name} bought ${space.name} for $${space.price}`);
        console.log(`✅ ${player.name} successfully bought ${space.name}!`);
        broadcastToGame(gameId, { type: 'game_updated', game });
        ws.send(JSON.stringify({ type: 'game_updated', game }));
    } else {
        const reasons = [];
        if (!space || space.type !== 'property') reasons.push('not a property');
        if (!prop) reasons.push('property data missing');
        if (prop && prop.ownerId) reasons.push('already owned');
        if (space && player.money < space.price) reasons.push('insufficient funds');
        console.log(`⚠️ Cannot buy: ${reasons.join(', ')}`);
    }
}

function handleEndTurn(ws, message) {
    const gameId = ws.gameId;
    if (!gameId || !games.has(gameId)) {
        console.log('⚠️ handleEndTurn: No gameId or game not found');
        return;
    }
    const game = games.get(gameId);
    console.log(`⏭️ ${game.players[game.currentPlayerIndex].name} ending turn...`);
    // Sıradaki oyuncuya geç
    let nextPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    // Bankrupt olanları atla
    while (game.players[nextPlayerIndex].isBankrupt) {
        nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextPlayerIndex;
    game.turnState = 'start';
    game.lastDiceRoll = [0, 0];
    game.gameLog = game.gameLog || [];
    game.gameLog.push(`⏭️ Turn ended. It's now ${game.players[nextPlayerIndex].name}'s turn.`);
    broadcastToGame(gameId, { type: 'game_updated', game });
    ws.send(JSON.stringify({ type: 'game_updated', game }));
}

// 🎤 Voice Chat Handlers
function handleVoiceJoin(ws, message) {
    const gameId = ws.gameId;
    if (!gameId || !games.has(gameId)) {
        return;
    }
    
    const game = games.get(gameId);
    
    // Add to voice chat list if not already there
    if (!game.voiceChat) game.voiceChat = [];
    if (!game.voiceChat.includes(message.playerId)) {
        game.voiceChat.push(message.playerId);
    }
    
    console.log(`🎤 Player ${message.playerId} joined voice chat in game ${gameId}`);
    console.log(`Voice chat participants:`, game.voiceChat);
    
    // First, send list of already connected voice users to the new joiner
    ws.send(JSON.stringify({
        type: 'voice_users',
        users: game.voiceChat.filter(id => id !== message.playerId)
    }));
    
    // Then broadcast to all other players that someone joined
    broadcastToGame(gameId, {
        type: 'voice_join',
        playerId: message.playerId,
        playerName: message.playerName
    }, ws);
}

function handleVoiceLeave(ws, message) {
    const gameId = ws.gameId;
    if (!gameId || !games.has(gameId)) {
        return;
    }
    
    const game = games.get(gameId);
    
    // Remove from voice chat list
    if (game.voiceChat) {
        game.voiceChat = game.voiceChat.filter(id => id !== message.playerId);
    }
    
    console.log(`🔇 Player ${message.playerId} left voice chat in game ${gameId}`);
    console.log(`Voice chat participants:`, game.voiceChat);
    
    // Broadcast to all other players in the game
    broadcastToGame(gameId, {
        type: 'voice_leave',
        playerId: message.playerId
    }, ws);
}

function handleVoiceSignal(ws, message) {
    const gameId = ws.gameId;
    if (!gameId || !games.has(gameId)) {
        return;
    }
    
    console.log(`📡 Relaying voice signal from ${message.from} to ${message.to}`);
    
    // Find the target player's WebSocket and send them the signal
    const game = games.get(gameId);
    const targetPlayer = game.players.find(p => p.id === message.to);
    
    if (targetPlayer) {
        // Broadcast only to the target player
        wss.clients.forEach(client => {
            if (client.gameId === gameId && client.playerId === message.to && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'voice_signal',
                    from: message.from,
                    to: message.to,
                    signal: message.signal
                }));
            }
        });
    }
}

// 🔄 Periodic game state synchronization
setInterval(() => {
    for (const [gameId, game] of games.entries()) {
        if (game.state === 'playing') {
            // Send periodic updates to keep clients in sync
            broadcastToGame(gameId, {
                type: 'game_updated',
                game: game
            });
        }
    }
}, 30000); // Every 30 seconds

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`🔌 WebSocket server ready`);
});
