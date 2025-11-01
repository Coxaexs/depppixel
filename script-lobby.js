/**
 * LOBBY SYSTEM
 * Karakter seçimi, harita seçimi, oyun oluşturma/katılma, ayarlar
 */

// Oyun modu preset'leri
const gameModes = {
    classic: { startingMoney: 1500, passGoBonus: 200, multiplier: 1, noLuck: false, passGoAmount: 200 },
    fast: { startingMoney: 3000, passGoBonus: 400, multiplier: 2, noLuck: false, passGoAmount: 400 },
    hard: { startingMoney: 1000, passGoBonus: 100, multiplier: 0.5, noLuck: false, passGoAmount: 100 },
    noluck: { startingMoney: 1500, passGoBonus: 200, multiplier: 1, noLuck: true, passGoAmount: 200 },
    mega: { startingMoney: 5000, passGoBonus: 500, multiplier: 3, noLuck: false, passGoAmount: 500 },
    speed: { startingMoney: 2000, passGoBonus: 300, multiplier: 1.5, noLuck: false, passGoAmount: 300 }
};

// Harita seçenekleri
const mapOptions = ['classic', 'turkey', 'world', 'holland', 'megarich', 'custom'];

/**
 * Oyuncu adı validasyonu
 */
function validatePlayerName() {
    addDebugLog('🔍 Validating name...');
    const name = playerNameInput.value.trim();
    addDebugLog('📝 Name value: "' + name + '" (length: ' + name.length + ')');
    
    if (name.length < 2 || name.length > 15) {
        lobbyError.textContent = 'Ad 2-15 karakter arasında olmalıdır.';
        addDebugLog('❌ Name length invalid: ' + name.length);
        return false;
    }
    
    let playerId = localStorage.getItem('monopolyPlayerId');
    if (!playerId) {
        try {
            if (crypto && crypto.randomUUID) {
                playerId = crypto.randomUUID();
                addDebugLog('✅ UUID created (crypto)');
            } else {
                playerId = 'player-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                addDebugLog('✅ UUID created (fallback)');
            }
            localStorage.setItem('monopolyPlayerId', playerId);
            addDebugLog('✅ Player ID saved');
        } catch (error) {
            addDebugLog('❌ UUID ERROR: ' + error.message);
            playerId = 'player-' + Date.now();
            addDebugLog('⚠️ Using emergency ID');
        }
    } else {
        addDebugLog('✅ Existing player ID found');
    }
    
    localPlayer = { id: playerId, name: name };
    lobbyError.textContent = '';
    addDebugLog('✅ Name validated: ' + name);
    return true;
}

/**
 * Rastgele oyun ID'si oluştur
 */
function generateGameId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

/**
 * Oyun oluştur
 */
window.createGame = function() {
    if (!validatePlayerName()) return;
    if (!selectedCharacter) {
        alert('Lütfen bir karakter seçin!');
        return;
    }
    
    currentGameId = generateGameId();
    localStorage.setItem('monopolyCurrentGameId', currentGameId);
    
    console.log('🎮 Creating game:', currentGameId);
    
    sendMessage({
        type: 'create_game',
        gameId: currentGameId,
        player: {
            id: localPlayer.id,
            name: localPlayer.name,
            character: selectedCharacter,
            map: selectedMap || 'classic',
            money: 1500,
            position: 0,
            team: null,
            isBot: false
        },
        settings: {
            startingMoney: 1500,
            passGoBonus: 200,
            gameMode: selectedGameMode
        }
    });
};

/**
 * Oyuna katıl
 */
window.joinGame = function() {
    if (!validatePlayerName()) return;
    if (!selectedCharacter) {
        alert('Lütfen bir karakter seçin!');
        return;
    }
    
    const gameId = gameIdInput.value.trim().toUpperCase();
    if (!gameId) {
        lobbyError.textContent = 'Lütfen oyun ID\'si girin!';
        return;
    }
    
    currentGameId = gameId;
    localStorage.setItem('monopolyCurrentGameId', currentGameId);
    
    console.log('👥 Joining game:', gameId);
    
    sendMessage({
        type: 'join_game',
        gameId: gameId,
        player: {
            id: localPlayer.id,
            name: localPlayer.name,
            character: selectedCharacter,
            map: selectedMap || 'classic',
            money: 1500,
            position: 0,
            team: null,
            isBot: false
        }
    });
};

/**
 * Karakter seçimi
 */
window.selectCharacter = function(character) {
    selectedCharacter = character;
    
    const characterBtns = document.querySelectorAll('.character-btn');
    characterBtns.forEach(btn => {
        btn.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
        if (btn.dataset.char === character) {
            btn.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
        }
    });
    
    console.log('🎭 Selected character:', character);
};

/**
 * Harita seçimi
 */
window.selectMap = function(map) {
    selectedMap = map;
    
    const mapBtns = document.querySelectorAll('.map-btn');
    mapBtns.forEach(btn => {
        btn.classList.remove('ring-2', 'ring-green-500', 'ring-offset-2');
        if (btn.dataset.map === map) {
            btn.classList.add('ring-2', 'ring-green-500', 'ring-offset-2');
        }
    });
    
    console.log('🗺️ Selected map:', map);
};

/**
 * Oyun modu seçimi
 */
window.selectGameMode = function(mode) {
    selectedGameMode = mode;
    
    const modeBtns = document.querySelectorAll('.game-mode-btn');
    modeBtns.forEach(btn => {
        btn.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2');
        if (btn.dataset.mode === mode) {
            btn.classList.add('ring-2', 'ring-purple-500', 'ring-offset-2');
        }
    });
    
    console.log('⚙️ Selected game mode:', mode);
};

/**
 * Lobby ekranını göster
 */
window.showLobby = function() {
    const lobby = document.getElementById('lobby');
    const gameSettings = document.getElementById('game-settings');
    const gameContainer = document.getElementById('game-container');
    
    if (lobby) lobby.classList.remove('hidden');
    if (gameSettings) gameSettings.classList.add('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
    
    // Mobil oyun kontrollerini gizle
    document.body.classList.remove('in-game');
};

/**
 * Ayarlar ekranını göster
 */
window.showGameSettings = function() {
    const lobby = document.getElementById('lobby');
    const gameSettings = document.getElementById('game-settings');
    const gameContainer = document.getElementById('game-container');
    
    if (lobby) lobby.classList.add('hidden');
    if (gameSettings) gameSettings.classList.remove('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
    
    // Mobil oyun kontrollerini gizle
    document.body.classList.remove('in-game');
    
    // Populate board properties editor if needed
    if (gameData && gameData.settings && gameData.settings.board) {
        populateBoardEditor();
    }
};

/**
 * Oyun ekranını göster
 */
window.showGame = function() {
    const lobby = document.getElementById('lobby');
    const gameSettings = document.getElementById('game-settings');
    const gameContainer = document.getElementById('game-container');
    
    if (lobby) lobby.classList.add('hidden');
    if (gameSettings) gameSettings.classList.add('hidden');
    if (gameContainer) gameContainer.classList.remove('hidden');
    
    // Mobile kontrolleri göster
    document.body.classList.add('in-game');
    
    // Board'u render et
    if (window.renderBoard) {
        console.log('📋 showGame() tarafından renderBoard() çağrılıyor...');
        window.renderBoard();
    }
    
    // Initialize game UI
    if (window.updateGameUI) {
        window.updateGameUI();
    }
};

/**
 * Board özelliklerini düzenle (host only)
 */
function populateBoardEditor() {
    const propertiesEditor = document.getElementById('properties-editor');
    if (!propertiesEditor) return;
    
    propertiesEditor.innerHTML = '';
    
    gameData.settings.board.forEach((space, idx) => {
        if (space.type !== 'property') return;
        
        const propertyDiv = document.createElement('div');
        propertyDiv.className = 'p-3 border rounded-lg mb-2 bg-gray-50';
        propertyDiv.innerHTML = `
            <div class="font-bold mb-2">${space.name}</div>
            <div class="space-y-2">
                <div>
                    <label class="text-sm">Fiyat: $</label>
                    <input type="number" value="${space.price}" onchange="updateBoardProperty(${idx}, 'price', this.value)" class="w-full border px-2 py-1 rounded">
                </div>
                <div>
                    <label class="text-sm">Bina Maliyeti: $</label>
                    <input type="number" value="${space.houseCost || 50}" onchange="updateBoardProperty(${idx}, 'houseCost', this.value)" class="w-full border px-2 py-1 rounded">
                </div>
            </div>
        `;
        propertiesEditor.appendChild(propertyDiv);
    });
}

/**
 * Board özelliği güncelle
 */
window.updateBoardProperty = function(index, property, value) {
    if (!gameData || !gameData.settings.board[index]) return;
    
    gameData.settings.board[index][property] = parseInt(value);
    
    updateGame({ settings: gameData.settings });
};

/**
 * Oyun başlat (host only)
 */
window.startGame = function() {
    if (!gameData) return;
    
    // Host kontrolü
    if (gameData.hostId !== localPlayer.id) {
        alert('Sadece host oyunu başlatabilir!');
        return;
    }
    
    // En az 2 oyuncu gerekli
    if (gameData.players.length < 2) {
        alert('En az 2 oyuncu gerekli!');
        return;
    }
    
    console.log('🎮 Starting game with', gameData.players.length, 'players');
    
    sendMessage({
        type: 'start_game',
        gameId: currentGameId
    });
};

/**
 * Bot ekle
 */
window.addBot = function() {
    console.log('🤖 Add Bot clicked');
    console.log('gameData:', gameData);
    console.log('localPlayer:', localPlayer);
    
    if (!gameData) {
        console.error('❌ gameData is null');
        alert('Oyun verisi yüklenemedi!');
        return;
    }
    
    // Host kontrolü
    if (gameData.hostId !== localPlayer.id) {
        console.error('❌ Not host. hostId:', gameData.hostId, 'localPlayer.id:', localPlayer.id);
        alert('Sadece host bot ekleyebilir!');
        return;
    }
    
    // Max oyuncu kontrolü
    if (gameData.players.length >= gameData.settings.maxPlayers) {
        alert('Maksimum oyuncu sayısına ulaşıldı!');
        return;
    }
    
    console.log('🤖 Adding bot...');
    
    sendMessage({
        type: 'add_bot',
        gameId: currentGameId
    });
};

/**
 * DEBUG: Debug log göster
 */
window.toggleDebugLog = function() {
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        debugLog.classList.toggle('hidden');
    }
};

/**
 * Debug log'a mesaj ekle
 */
function addDebugLog(message) {
    const debugLog = document.getElementById('debug-log-content');
    if (!debugLog) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timestamp}] ${message}`;
    logEntry.className = 'text-xs font-mono text-gray-600 border-b border-gray-200 p-1';
    
    debugLog.insertBefore(logEntry, debugLog.firstChild);
    
    // Maksimum 100 satır tut
    while (debugLog.children.length > 100) {
        debugLog.removeChild(debugLog.lastChild);
    }
}

// Initialize lobby event listeners
function initLobbyEvents() {
    const playerNameInput = document.getElementById('playerNameInput');
    const createGameBtn = document.getElementById('createGameBtn');
    const joinGameBtn = document.getElementById('joinGameBtn');
    
    if (playerNameInput) {
        playerNameInput.addEventListener('change', () => {
            localStorage.setItem('monopolyPlayerName', playerNameInput.value);
        });
    }
    
    if (createGameBtn) {
        createGameBtn.addEventListener('click', window.createGame);
    }
    
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', window.joinGame);
    }
    
    // Character buttons - both main menu and game settings
    document.querySelectorAll('.character-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            window.selectCharacter(this.dataset.char);
        });
    });
    
    // Map buttons - both main menu and game settings
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            window.selectMap(this.dataset.map);
        });
    });
    
    // Game mode buttons
    document.querySelectorAll('.game-mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            window.selectGameMode(this.dataset.mode);
        });
    });
    
    // Event delegation for dynamic buttons
    document.addEventListener('click', function(e) {
        if (e.target.id === 'startGameBtn' || e.target.closest('#startGameBtn')) {
            window.startGame();
        }
        if (e.target.id === 'addBotBtn' || e.target.closest('#addBotBtn')) {
            window.addBot();
        }
    });
}

// DOM ready check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLobbyEvents);
} else {
    initLobbyEvents();
}
