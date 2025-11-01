/**
 * GAME CORE MECHANICS
 * Zar atma, turn yönetimi, landing, turn timer
 */

/**
 * Tahtayı render et - Board space'lerini oluştur
 */
window.renderBoard = function() {
    if (!gameData || !gameData.settings || !gameData.settings.board || !gameData.players) {
        console.error('❌ renderBoard: gameData, board veya players eksik');
        return;
    }
    
    // Initialize properties if not exists
    if (!gameData.properties) {
        gameData.properties = gameData.settings.board.map((p, i) => ({ 
            spaceIndex: i, 
            ownerId: null, 
            houses: 0 
        }));
    }
    
    console.log('🎨 Board render ediliyor... Toplam spaces:', gameData.settings.board.length);
    
    const board = document.getElementById('board');
    if (!board) {
        console.error('❌ Board element bulunamadı');
        return;
    }
    
    // Tüm mevcut space'leri sil
    board.querySelectorAll('.space').forEach(el => el.remove());
    
    const spacesContainer = document.createDocumentFragment();
    
    // Her space için div oluştur
    gameData.settings.board.forEach((spaceData, i) => {
        const spaceEl = document.createElement('div');
        spaceEl.id = `space-${i}`;
        spaceEl.className = 'space';
        
        // Corner space'ler için özel class
        if ([0, 10, 20, 30].includes(i)) {
            spaceEl.classList.add('corner');
        }
        
        let content = `<div class="font-bold uppercase">${spaceData.name}</div>`;
        
        // Space tipine göre content oluştur
        if (spaceData.type === 'property') {
            const property = gameData.properties[i];
            const ownerColor = property && property.ownerId ? (gameData.players.find(p => p.id === property.ownerId)?.color || '#ffffff') : '#ffffff';
            
            // Safe adjustColor call
            let darkerColor = spaceData.color;
            if (window.adjustColor && typeof window.adjustColor === 'function') {
                darkerColor = window.adjustColor(spaceData.color, -20);
            }
            
            content = `
                <div class="houses-container"></div>
                <div class="color-bar" style="background: linear-gradient(135deg, ${spaceData.color} 0%, ${darkerColor} 100%);"></div>
                <div class="p-1 flex-grow flex flex-col justify-center" style="background: ${ownerColor ? `linear-gradient(135deg, ${ownerColor}20 0%, ${ownerColor}40 100%)` : 'transparent'}; border: ${ownerColor ? `2px solid ${ownerColor}` : 'none'}; border-radius: 4px;">
                    <div class="text-center text-[10px]">${spaceData.name.substring(0, 8)}</div>
                    <div class="text-center font-bold text-[9px]">💰$${spaceData.price}</div>
                </div>
            `;
        } else if (spaceData.type === 'railroad') {
            content = `<div class="text-center p-2"><div class="text-xl">🚂</div><div class="font-bold text-[10px]">${spaceData.name}</div><div class="text-[9px]">$${spaceData.price}</div></div>`;
        } else if (spaceData.type === 'utility') {
            content = `<div class="text-center p-2"><div class="text-xl">⚡</div><div class="font-bold text-[10px]">${spaceData.name}</div><div class="text-[9px]">$${spaceData.price}</div></div>`;
        } else if (spaceData.type === 'go') {
            content = `<div class="text-center p-2"><div class="text-2xl">GO</div><div class="font-bold text-[11px]">Collect $200</div></div>`;
        } else if (spaceData.type === 'jail') {
            content = `<div class="text-center p-2"><div class="text-2xl">🔒</div><div class="font-bold text-[11px]">Go To Jail</div></div>`;
        } else if (spaceData.type === 'free_parking') {
            content = `<div class="text-center p-2"><div class="text-2xl">🅿️</div><div class="font-bold text-[11px]">Free Parking</div></div>`;
        } else if (spaceData.type === 'tax') {
            content = `<div class="text-center p-2"><div class="text-2xl">💸</div><div class="font-bold text-[11px]">${spaceData.name}</div><div class="text-[10px]">Pay $${spaceData.amount}</div></div>`;
        } else if (spaceData.type === 'chance') {
            content = `<div class="text-center p-2"><div class="text-2xl">❓</div><div class="font-bold text-[11px]">${spaceData.name}</div></div>`;
        } else if (spaceData.type === 'community_chest') {
            content = `<div class="text-center p-2"><div class="text-2xl">🎁</div><div class="font-bold text-[11px]">${spaceData.name}</div></div>`;
        }
        
        spaceEl.innerHTML = content;
        
        // Property space'ine click event ekle
        if (spaceData.type === 'property' || spaceData.type === 'railroad' || spaceData.type === 'utility') {
            spaceEl.style.cursor = 'pointer';
            spaceEl.addEventListener('click', () => {
                if (window.showPropertyDetails) {
                    window.showPropertyDetails(i, spaceData);
                }
            });
        }
        
        spacesContainer.appendChild(spaceEl);
    });
    
    // Pieces container oluştur (player pieces için)
    const piecesContainer = document.createElement('div');
    piecesContainer.id = "pieces-container";
    piecesContainer.style.position = 'relative';
    piecesContainer.style.gridColumn = '1 / -1';
    piecesContainer.style.gridRow = '1 / -1';
    piecesContainer.style.pointerEvents = 'none';
    
    // Mevcut space'leri ve pieces container'ı board'a ekle
    const existingPieces = board.querySelector('#pieces-container');
    if (existingPieces) existingPieces.remove();
    
    board.appendChild(spacesContainer);
    board.appendChild(piecesContainer);
    
    console.log('✅ Board render tamamlandı');
};

/**
 * Oyun UI'ı güncelle
 */
window.updateGameUI = function() {
    if (!gameData || !gameData.players) {
        console.warn('⚠️ gameData or players missing');
        return;
    }
    
    if (window.updatePlayersInfo) window.updatePlayersInfo();
    if (window.updateBoardPiecesAndHouses) window.updateBoardPiecesAndHouses();
    if (window.updateControls) window.updateControls();
    if (window.updateGameLog) window.updateGameLog();
    if (window.updateBoardTitle) window.updateBoardTitle();
    
    if (gameData.lastDiceRoll && gameData.lastDiceRoll.length === 2) {
        if (window.updateDiceDisplay) window.updateDiceDisplay(gameData.lastDiceRoll[0], gameData.lastDiceRoll[1]);
    }
    
    if (window.handleTurnTimer) window.handleTurnTimer();
};

/**
 * Board başlığını güncelle (kalan süre göster)
 */
window.updateBoardTitle = function() {
    const boardTitle = document.getElementById('board-title');
    if (!boardTitle || !gameData || !gameData.players) {
        if (boardTitle) boardTitle.textContent = 'BUSINESS';
        return;
    }
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isBot) {
        boardTitle.textContent = 'BUSINESS';
        return;
    }
    
    const elapsed = Math.floor((Date.now() - turnStartTime) / 1000);
    const remaining = Math.max(0, 90 - elapsed);
    
    boardTitle.textContent = `${currentPlayer.name} - ${remaining}s`;
};

/**
 * Turn timer'ı yönet (otomatik tur bitirme)
 */
window.handleTurnTimer = function() {
    if (!gameData || !gameData.players) return;
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    const isMyTurn = currentPlayer && currentPlayer.id === localPlayer.id;
    
    if (turnTimer) {
        clearTimeout(turnTimer);
        turnTimer = null;
    }
    if (turnUpdateInterval) {
        clearInterval(turnUpdateInterval);
        turnUpdateInterval = null;
    }
    turnStartTime = null;
    
    if (isMyTurn && !currentPlayer.isBot) {
        console.log('⏰ Tur timer başlatıldı (90 saniye)');
        turnStartTime = Date.now();
        turnTimer = setTimeout(() => {
            console.log('⏰ Tur timer sona erdi, tur otomatik bitiriliyor');
            if (turnUpdateInterval) {
                clearInterval(turnUpdateInterval);
                turnUpdateInterval = null;
            }
            turnStartTime = null;
            
            const boardTitle = document.getElementById('board-title');
            if (boardTitle) boardTitle.textContent = 'BUSINESS';
            
            sendMessage({
                type: 'end_turn',
                gameId: currentGameId
            });
        }, 90000);
        
        turnUpdateInterval = setInterval(() => {
            window.updateBoardTitle();
        }, 1000);
    } else {
        const boardTitle = document.getElementById('board-title');
        if (boardTitle) boardTitle.textContent = 'BUSINESS';
    }
};

/**
 * Oyuncu bilgisini güncelle
 */
window.updatePlayersInfo = function() {
    if (!gameData || !gameData.players) {
        if (window.showModal) window.showModal('Hata', 'Oyuncu verisi eksik. Lütfen tekrar bağlanın.', [{text:'Tamam', class:'bg-red-500', action: window.hideModal || (() => {})}]);
        return;
    }
    
    if (!playersInfo) return;
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (!currentPlayer) return;
    
    playersInfo.innerHTML = gameData.players.map((p) => {
        if (p.isBankrupt) return '';
        
        const isCurrent = p.id === currentPlayer.id;
        const teamBadges = { red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡' };
        const teamBadge = p.team ? teamBadges[p.team] || '' : '';
        
        // Safe adjustColor call
        let darkerColor = p.color;
        if (window.adjustColor && typeof window.adjustColor === 'function') {
            darkerColor = window.adjustColor(p.color, -30);
        }
        
        return `
            <div class="player-card border rounded-xl p-3 ${isCurrent ? 'border-blue-500 border-2 shadow-xl bg-gradient-to-r from-blue-50 to-white' : 'border-gray-200 bg-white'} transition-all duration-300 cursor-pointer hover:shadow-lg" data-player-id="${p.id}">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full shadow-md" style="background: linear-gradient(135deg, ${p.color} 0%, ${darkerColor} 100%); border: 2px solid white;"></div>
                        <span class="font-bold text-lg">${teamBadge} ${p.name} ${p.id === localPlayer.id ? '(Siz)' : ''}</span>
                    </div>
                    <span class="font-semibold text-green-600 text-xl">💰 $${p.money}</span>
                </div>
                ${p.creditAmount > 0 ? `
                <div class="mt-2 bg-red-50 border border-red-300 rounded-lg p-2">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-red-600 font-semibold">💳 Kredi: $${p.creditAmount}</span>
                        <span class="text-red-500 text-xs">⏰ ${p.creditTurnsLeft} tur kaldı</span>
                    </div>
                </div>
                ` : ''}
                <div class="flex justify-between items-center mt-2">
                    ${p.inJail ? `<div class="text-red-500 font-bold text-sm flex items-center gap-1">🔒 Hapishanede</div>` : '<div></div>'}
                </div>
            </div>
        `;
    }).join('');
};

/**
 * Board parçalarını ve evleri güncelle
 */
window.updateBoardPiecesAndHouses = function() {
    const piecesContainer = document.getElementById('pieces-container');
    if (!piecesContainer) return;
    piecesContainer.innerHTML = '';
    
    gameData.players.forEach((p) => {
        if (p.isBankrupt) return;
        
        const pieceEl = document.createElement('div');
        pieceEl.className = 'player-piece';
        pieceEl.id = `piece-${p.id}`;
        
        const emoji = p.isBot ? '🤖' : (window.characterIcons && window.characterIcons[p.character] || '❓');
        pieceEl.textContent = emoji;
        
        const targetSpace = document.getElementById(`space-${p.position}`);
        if (targetSpace) {
            const playersOnSameSpace = gameData.players.filter(
                player => player.position === p.position && !player.isBankrupt
            );
            const positionIndex = playersOnSameSpace.findIndex(player => player.id === p.id);
            
            const offsetX = (positionIndex % 2) * 18;
            const offsetY = Math.floor(positionIndex / 2) * 18;
            
            pieceEl.style.left = `${targetSpace.offsetLeft + 8 + offsetX}px`;
            pieceEl.style.top = `${targetSpace.offsetTop + 8 + offsetY}px`;
        }
        piecesContainer.appendChild(pieceEl);
    });
    
    // Mülk mülkiyeti ve evleri güncelle
    const board = document.getElementById('board');
    if (board) {
        board.querySelectorAll('.owner-indicator, .houses-container > *').forEach(el => el.remove());
    }
    
    gameData.properties.forEach((prop, i) => {
        const spaceEl = document.getElementById(`space-${i}`);
        if (!spaceEl) return;
        
        if (prop.ownerId) {
            const owner = gameData.players.find(p => p.id === prop.ownerId);
            if (owner) {
                const indicator = document.createElement('div');
                indicator.className = 'owner-indicator';
                indicator.style.backgroundColor = owner.color;
                spaceEl.appendChild(indicator);
            }
        }
        
        if (prop.houses > 0) {
            const housesContainer = spaceEl.querySelector('.houses-container');
            if (housesContainer) {
                if (prop.houses === 5) {
                    const hotelEl = document.createElement('div');
                    hotelEl.className = 'hotel';
                    housesContainer.appendChild(hotelEl);
                } else {
                    for (let j = 0; j < prop.houses; j++) {
                        const houseEl = document.createElement('div');
                        houseEl.className = 'house';
                        housesContainer.appendChild(houseEl);
                    }
                }
            }
        }
    });
};

/**
 * Kontrolleri güncelle
 */
window.updateControls = function() {
    if (!gameData || !gameData.players || gameData.currentPlayerIndex === undefined) return;
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (!currentPlayer) return;
    
    const isMyTurn = currentPlayer.id === localPlayer.id;
    
    if (dice1El) dice1El.textContent = gameData.lastDiceRoll[0] || '🎲';
    if (dice2El) dice2El.textContent = gameData.lastDiceRoll[1] || '🎲';
    
    const canAct = isMyTurn && !currentPlayer.isBankrupt;
    
    if (rollDiceBtn) {
        rollDiceBtn.disabled = !canAct || gameData.turnState !== 'start';
    }
    
    if (endTurnBtn) {
        endTurnBtn.classList.remove('hidden');
        endTurnBtn.disabled = !canAct || gameData.turnState !== 'action_complete';
        endTurnBtn.style.opacity = canAct && gameData.turnState === 'action_complete' ? '1' : '0.6';
        endTurnBtn.style.cursor = canAct && gameData.turnState === 'action_complete' ? 'pointer' : 'not-allowed';
    }
    
    if (managePropertiesBtn) {
        managePropertiesBtn.classList.toggle('hidden', !canAct || (gameData.turnState !== 'start' && gameData.turnState !== 'action_complete'));
    }
    
    if (takeCreditBtn) {
        takeCreditBtn.classList.toggle('hidden', !canAct || (gameData.turnState !== 'start' && gameData.turnState !== 'action_complete'));
    }
};

/**
 * Game log'u güncelle
 */
window.updateGameLog = function() {
    if (!gameLogEl || !gameData) return;
    gameLogEl.innerHTML = gameData.gameLog.map(msg => `<div>${msg}</div>`).join('');
    gameLogEl.scrollTop = gameLogEl.scrollHeight;
};

/**
 * Zar at
 */
window.rollDice = async function() {
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    
    if (currentPlayer.id !== localPlayer.id) {
        console.warn('⚠️ Sadece mevcut oyuncu zar atabilir!');
        return;
    }
    
    if (currentPlayer.inJail) {
        if (window.handleJailTurn) window.handleJailTurn();
        return;
    }
    
    if (rollDiceBtn) rollDiceBtn.disabled = true;
    if (window.animateDiceRoll) window.animateDiceRoll();
    if (window.playSound) window.playSound('dice');
    
    let logMessages = [];
    
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    
    console.log('🎲 Zar atıldı:', die1, '+', die2, '=', total);
    
    setTimeout(() => {
        if (window.updateDiceDisplay) window.updateDiceDisplay(die1, die2);
        if (dice1El) dice1El.classList.remove('dice-rolling');
        if (dice2El) dice2El.classList.remove('dice-rolling');
    }, 500);
    
    const oldPosition = currentPlayer.position;
    const newPosition = (currentPlayer.position + total) % 40;
    
    const isDouble = (die1 === die2);
    const playersCopy = JSON.parse(JSON.stringify(gameData.players));
    
    let passGoBonus = 0;
    if (newPosition < oldPosition) {
        passGoBonus = gameData.settings.passGoBonus || 200;
        playersCopy[gameData.currentPlayerIndex].money += passGoBonus;
        logMessages.push(`💰 ${currentPlayer.name} GO'yu geçti! +$${passGoBonus}`);
    } else if (newPosition === 0) {
        passGoBonus = (gameData.settings.passGoBonus || 200) + 100;
        playersCopy[gameData.currentPlayerIndex].money += passGoBonus;
        logMessages.push(`🎯 ${currentPlayer.name} GO'da indi! +$${passGoBonus}`);
    }
    
    playersCopy[gameData.currentPlayerIndex].position = newPosition;
    
    if (isDouble) {
        playersCopy[gameData.currentPlayerIndex].doublesCount = (currentPlayer.doublesCount || 0) + 1;
        logMessages.push(`🎲 ${currentPlayer.name} ${die1} + ${die2} = ${total} attı (ÇIFT!)`);
    } else {
        logMessages.push(`🎲 ${currentPlayer.name} ${die1} + ${die2} = ${total} attı`);
    }
    
    await window.updateGame({
        lastDiceRoll: [die1, die2],
        players: playersCopy,
        turnState: 'rolled',
        gameLog: [...gameData.gameLog, ...logMessages]
    });
    
    setTimeout(() => {
        if (window.handleLanding) window.handleLanding(newPosition);
    }, 2000);
    
    setTimeout(() => {
        if (rollDiceBtn) rollDiceBtn.disabled = false;
    }, 2500);
};

/**
 * Tur sonlandır
 */
window.endTurn = async function() {
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    const isDouble = gameData.lastDiceRoll && gameData.lastDiceRoll[0] === gameData.lastDiceRoll[1];
    const doublesCount = currentPlayer.doublesCount || 0;
    
    if (window.checkCreditPayment) {
        await window.checkCreditPayment(gameData.currentPlayerIndex);
    }
    
    if (isDouble && doublesCount >= 3) {
        if (window.showModal) {
            window.showModal('⚠️ Çok Fazla Çift!', 'Ard arda 3 kez çift attınız! Doğrudan hapishanelere gidin!', [
                {text: 'Hapishanelere Gir', class: 'bg-red-600', action: () => {
                    if (window.hideModal) window.hideModal();
                    if (window.goToJail) window.goToJail();
                }}
            ]);
        }
        return;
    }
    
    if (isDouble && doublesCount > 0 && doublesCount < 3 && gameData.settings.allowDoubles) {
        await window.updateGame({ 
            turnState: 'start',
            gameLog: [...gameData.gameLog, `🎲 ${currentPlayer.name} ÇIFT atti! Yeniden atıyor...`]
        });
        
        setTimeout(() => {
            if (window.showModal) {
                window.showModal('🎲 ÇIFT!', `Çift attınız (${gameData.lastDiceRoll[0]} + ${gameData.lastDiceRoll[1]})! Yeniden atabilirsiniz!`, [
                    {text: '🎲 Tamam', class: 'bg-green-600', action: () => {
                        if (window.hideModal) window.hideModal();
                    }}
                ]);
            }
        }, 500);
        return;
    }
    
    await window.updateGame({ turnState: 'action_complete' });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        rollDiceBtn = document.getElementById('rollDiceBtn');
        endTurnBtn = document.getElementById('endTurnBtn');
        
        if (rollDiceBtn) rollDiceBtn.addEventListener('click', window.rollDice);
        if (endTurnBtn) endTurnBtn.addEventListener('click', window.endTurn);
    });
} else {
    rollDiceBtn = document.getElementById('rollDiceBtn');
    endTurnBtn = document.getElementById('endTurnBtn');
    
    if (rollDiceBtn) rollDiceBtn.addEventListener('click', window.rollDice);
    if (endTurnBtn) endTurnBtn.addEventListener('click', window.endTurn);
}
