/**
 * WEBSOCKET & SERVER COMMUNICATION
 * WebSocket bağlantısı, mesaj gönderme/alma, bağlantı yönetimi
 */

let ws = null;
let connectionStatus = 'disconnected'; // connected, connecting, disconnected
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Global game state
let localPlayer = { id: null, name: '' };
let currentGameId = null;
let gameData = null;
let selectedCharacter = null;
let selectedMap = null;
let selectedGameMode = 'classic';

// Shared variables
let turnTimer = null;
let turnUpdateInterval = null;
let turnStartTime = null;
let auctionTimerInterval = null;
let shownTradeIds = new Set();
let decidedLaterTrades = [];

// UI elements cache (buttons only - modals are in script-ui.js)
let rollDiceBtn, endTurnBtn, managePropertiesBtn, jokerCardsBtn;
let dice1El, dice2El, gameLogEl, playersInfo;
let lobbyError, playerNameInput, gameIdInput;
let copyGameIdBtn, viewTradesBtn, takeCreditBtn, teamManagerBtn;

// Color & character systems
const playerColors = [
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#F97316'  // Orange
];

const characterIcons = {
    car: '🚗',
    hat: '🎩',
    dog: '🐕',
    shoe: '👞',
    iron: '🧲',
    ship: '🚢',
    cat: '🐈',
    money: '💰'
};

// Export to window scope
window.characterIcons = characterIcons;

/**
 * Initialize WebSocket connection
 */
function connectWebSocket() {
    if (connectionStatus === 'connecting') return;
    
    connectionStatus = 'connecting';
    updateConnectionIndicator();
    
    // Detect WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        connectionStatus = 'connected';
        reconnectAttempts = 0;
        updateConnectionIndicator();
    };
    
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
        } catch (error) {
            console.error('❌ Error parsing server message:', error);
        }
    };
    
    ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        connectionStatus = 'disconnected';
        updateConnectionIndicator();
        
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
            setTimeout(() => connectWebSocket(), 2000 * reconnectAttempts);
        } else {
            console.error('❌ Max reconnection attempts reached');
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        connectionStatus = 'disconnected';
        updateConnectionIndicator();
    };
}

/**
 * Send message to server
 */
function sendMessage(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ WebSocket not connected, cannot send message');
        return;
    }
    
    try {
        ws.send(JSON.stringify(message));
    } catch (error) {
        console.error('❌ Error sending message:', error);
    }
}

/**
 * Update game state on server
 */
window.updateGame = async function(updates) {
    if (!gameData) return;
    
    // Merge updates with current gameData
    const updatedGame = { ...gameData, ...updates };
    
    // Send to server
    sendMessage({
        type: 'update_game',
        gameId: currentGameId,
        game: updatedGame
    });
    
    // Update local copy
    gameData = updatedGame;
};

/**
 * Update connection indicator UI
 */
function updateConnectionIndicator() {
    const indicator = document.getElementById('connection-indicator');
    if (!indicator) return;
    
    const statusMap = {
        'connected': { text: '🟢 Connected', color: '#10B981' },
        'connecting': { text: '🟡 Connecting', color: '#F59E0B' },
        'disconnected': { text: '🔴 Disconnected', color: '#EF4444' }
    };
    
    const status = statusMap[connectionStatus] || statusMap['disconnected'];
    indicator.textContent = status.text;
    indicator.style.color = status.color;
}

/**
 * Handle incoming server messages
 */
function handleServerMessage(message) {
    console.log('📨 Server message:', message.type);
    
    switch (message.type) {
        case 'game_created':
            handleGameCreated(message);
            break;
        case 'game_joined':
            handleGameJoined(message);
            break;
        case 'game_updated':
            handleGameUpdated(message);
            break;
        case 'game_started':
            handleGameStarted(message);
            break;
        case 'chat_message':
            handleChatMessage(message);
            break;
        case 'voice_join':
            handleVoiceJoin(message);
            break;
        case 'voice_leave':
            handleVoiceLeave(message);
            break;
        case 'voice_signal':
            handleVoiceSignal(message);
            break;
        case 'games_list':
            handleGamesList(message);
            break;
        case 'player_reconnected':
            handlePlayerReconnected(message);
            break;
        case 'error':
            handleServerError(message);
            break;
        default:
            console.warn('⚠️ Unknown message type:', message.type);
    }
}

/**
 * Game created handler
 */
function handleGameCreated(message) {
    console.log('🎮 Game created:', message.gameId);
    currentGameId = message.gameId;
    gameData = message.game || message.gameData;
    localStorage.setItem('monopolyCurrentGameId', currentGameId);
    localStorage.setItem('monopolyPlayerId', localPlayer.id);
    
    // Show game settings screen for host
    if (window.showGameSettings) {
        window.showGameSettings();
    }
}

/**
 * Game joined handler
 */
function handleGameJoined(message) {
    console.log('👥 Joined game:', message.gameId);
    currentGameId = message.gameId;
    gameData = message.game || message.gameData;
    localStorage.setItem('monopolyCurrentGameId', currentGameId);
    localStorage.setItem('monopolyPlayerId', localPlayer.id);
    
    // Show game settings screen (player joined, waiting for host to start)
    if (window.showGameSettings) {
        window.showGameSettings();
    }
}

/**
 * Game updated handler
 */
function handleGameUpdated(message) {
    const oldGameData = gameData;
    gameData = message.game || message.gameData;
    
    // Update UI with new game state
    if (window.updateGameUI) {
        window.updateGameUI();
    }
    
    // Check for pending trades
    if (window.checkPendingTrades) {
        window.checkPendingTrades();
    }
    
    // Check for declined partnerships
    if (window.checkDeclinedPartnerships) {
        window.checkDeclinedPartnerships(oldGameData);
    }
    
    // Update partnership requests
    if (window.checkPartnershipRequests) {
        window.checkPartnershipRequests();
    }
    
    // Check auction timer
    if (gameData.auction && gameData.auction.active) {
        if (window.updateAuctionTimer && !auctionTimerInterval) {
            auctionTimerInterval = setInterval(() => {
                window.updateAuctionTimer();
            }, 1000);
        }
    }
    
    // Show auction modal if active
    if (gameData.auction && gameData.auction.active && window.showAuctionModal) {
        window.showAuctionModal();
    }
    
    // Handle bot turns
    if (window.botTurn && gameData.players) {
        const currentPlayer = gameData.players[gameData.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isBot && gameData.turnState === 'start') {
            if (!window.isBotTurnInProgress) {
                window.isBotTurnInProgress = true;
                window.botTurn();
            }
        }
    }
}

/**
 * Game started handler
 */
function handleGameStarted(message) {
    console.log('🎮 Game started');
    gameData = message.game || message.gameData;
    if (window.showGame) {
        window.showGame();
    }
}

/**
 * Chat message handler
 */
function handleChatMessage(message) {
    console.log('💬 Chat message:', message.playerName, message.text);
    if (window.addChatMessage) {
        window.addChatMessage(message.playerName, message.text);
    }
}

/**
 * Voice join handler
 */
function handleVoiceJoin(message) {
    console.log('🎤 Player joined voice:', message.playerName);
    if (window.addChatMessage) {
        window.addChatMessage('SYSTEM', `🎤 ${message.playerName} joined voice chat`);
    }
}

/**
 * Voice leave handler
 */
function handleVoiceLeave(message) {
    console.log('🔇 Player left voice:', message.playerName);
    if (window.addChatMessage) {
        window.addChatMessage('SYSTEM', `🔇 ${message.playerName} left voice chat`);
    }
}

/**
 * Voice signal handler
 */
function handleVoiceSignal(message) {
    console.log('📡 Received voice signal from:', message.from);
    if (window.peers && window.peers[message.from]) {
        window.peers[message.from].signal(message.signal);
    }
}

/**
 * Games list handler
 */
function handleGamesList(message) {
    console.log('📊 Received games list:', message.games.length, 'games');
    if (window.displayPublicGames) {
        window.displayPublicGames(message.games);
    }
}

/**
 * Player reconnected handler
 */
function handlePlayerReconnected(message) {
    console.log('🔄 Player reconnected:', message.playerName);
    if (window.addChatMessage) {
        window.addChatMessage('SYSTEM', `🔄 ${message.playerName} reconnected`);
    }
}

/**
 * Server error handler
 */
function handleServerError(message) {
    console.error('❌ Server error:', message.error);
    if (window.showModal) {
        window.showModal('Hata', message.error, [{text: 'Tamam', class: 'bg-red-500', action: window.hideModal}]);
    }
}

/**
 * Cache UI elements on load
 */
function cacheUIElements() {
    modal = document.getElementById('generic-modal');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.getElementById('modal-body');
    modalButtons = document.getElementById('modal-buttons');
    modalContent = document.getElementById('modal-content');
    
    rollDiceBtn = document.getElementById('rollDiceBtn');
    endTurnBtn = document.getElementById('endTurnBtn');
    managePropertiesBtn = document.getElementById('managePropertiesBtn');
    jokerCardsBtn = document.getElementById('jokerCardsBtn');
    
    dice1El = document.getElementById('dice1');
    dice2El = document.getElementById('dice2');
    gameLogEl = document.getElementById('game-log');
    playersInfo = document.getElementById('players-info');
    
    propertyBuyPanel = document.getElementById('property-buy-panel');
    propertyBuyTitle = document.getElementById('property-buy-title');
    propertyBuyName = document.getElementById('property-buy-name');
    propertyBuyDesc = document.getElementById('property-buy-desc');
    propertyBuyOptions = document.getElementById('property-buy-options');
    propertyBuyClose = document.getElementById('property-buy-close');
    
    lobbyError = document.getElementById('lobby-error');
    playerNameInput = document.getElementById('playerNameInput');
    gameIdInput = document.getElementById('gameIdInput');
    
    copyGameIdBtn = document.getElementById('copyGameIdBtn');
    viewTradesBtn = document.getElementById('viewTradesBtn');
    takeCreditBtn = document.getElementById('takeCreditBtn');
    teamManagerBtn = document.getElementById('teamManagerBtn');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cacheUIElements();
        connectWebSocket();
        // Show lobby on startup
        if (window.showLobby) window.showLobby();
    });
} else {
    cacheUIElements();
    connectWebSocket();
    // Show lobby on startup
    if (window.showLobby) window.showLobby();
}
