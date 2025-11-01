/**
 * GAME LANDING & PROPERTY SYSTEM
 * Zar düştüğü yerlerde yapılan işlemler, kira, satın alma, müzayeda
 */

/**
 * Inen yerde ne olduğunu yönet
 */
window.handleLanding = async function(position) {
    const space = gameData.settings.board[position];
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    const propertyState = gameData.properties[position];
    
    console.log(`🏠 ${currentPlayer.name} ${space.name}'e indi`);
    
    await window.addLog(`${currentPlayer.name} ${space.name}'e indi.`);
    
    switch(space.type) {
        case 'property':
        case 'railroad':
        case 'utility':
            if (propertyState.ownerId === null || (propertyState.owners && Object.keys(propertyState.owners).length === 0)) {
                if (currentPlayer.isBot) {
                    if (window.botDecidePropertyPurchase) {
                        await window.botDecidePropertyPurchase(position);
                    }
                } else {
                    window.showPropertyBuyPanel(position);
                }
            } else if (propertyState.ownerId !== currentPlayer.id && !(propertyState.owners && propertyState.owners[currentPlayer.id])) {
                if (window.payRent) {
                    await window.payRent(position);
                }
            } else {
                await window.addLog('Kendi mülkünüzde oldunuz. Kira yok.');
                setTimeout(() => {
                    window.updateGame({ turnState: 'action_complete' });
                    window.endTurn();
                }, 1000);
            }
            break;
        case 'go_to_jail':
            if (window.goToJail) {
                await window.goToJail();
            }
            break;
        case 'chance':
        case 'community_chest':
            if (window.drawCard) {
                await window.drawCard(space.type);
            }
            break;
        case 'tax':
            if (window.payTax) {
                await window.payTax(space.amount || 200);
            }
            break;
        case 'free_parking':
            await window.addLog('🅿️ Serbest Parkta Dinlenme - Hiçbir şey olmaz!');
            setTimeout(() => window.endTurn(), 1000);
            break;
        default:
            // GO vb boş alanlar
            setTimeout(() => window.endTurn(), 1000);
    }
};

/**
 * Kira öde
 */
window.payRent = async function(position) {
    const space = gameData.settings.board[position];
    const propertyState = gameData.properties[position];
    const currentPlayerIndex = gameData.currentPlayerIndex;
    const currentPlayer = gameData.players[currentPlayerIndex];
    
    let baseRent = 0;
    if (space.type === 'property') {
        baseRent = space.rent[propertyState.houses];
    } else if (space.type === 'railroad') {
        const owner = gameData.players.find(p => p.id === propertyState.ownerId);
        if (owner) {
            const railCount = gameData.properties.filter(p => 
                p.ownerId === owner.id && gameData.settings.board[gameData.properties.indexOf(p)].type === 'railroad'
            ).length;
            baseRent = 25 * Math.pow(2, railCount - 1);
        }
    }
    
    const owners = propertyState.owners || { [propertyState.ownerId]: 100 };
    const playerShare = owners[currentPlayer.id] || 0;
    const rentToPay = Math.floor(baseRent * ((100 - playerShare) / 100));
    
    if (rentToPay === 0) {
        await window.addLog(`${currentPlayer.name} kendi mülkünde ve kira yok.`);
        window.endTurn();
        return;
    }
    
    if (currentPlayer.isBot) {
        const playersCopy = JSON.parse(JSON.stringify(gameData.players));
        playersCopy[currentPlayerIndex].money -= rentToPay;
        
        for (const [ownerId, sharePercentage] of Object.entries(owners)) {
            if (ownerId === currentPlayer.id) continue;
            
            const ownerShare = Math.floor(baseRent * (sharePercentage / 100));
            const ownerIndex = playersCopy.findIndex(p => p.id === ownerId);
            if (ownerIndex !== -1) {
                playersCopy[ownerIndex].money += ownerShare;
                const ownerName = playersCopy[ownerIndex].name;
                await window.addLog(`🤖 ${currentPlayer.name} $${ownerShare} kira ödedi ${ownerName}'e.`);
            }
        }
        
        await window.updateGame({ players: playersCopy });
        
        if (window.checkBankruptcy) {
            const isBankrupt = await window.checkBankruptcy(currentPlayerIndex);
            if (!isBankrupt) {
                window.endTurn();
            }
        }
        return;
    }
    
    window.showModal(
        'Kira Öde',
        `<p>Kira ödemek gerekiyor. <strong>$${rentToPay}</strong> ödeyin.</p>
         <p class="text-xs text-gray-600 mt-2">Bu mülkün %${playerShare}'sinine sahipsiniz.</p>`,
        [{ text: 'Kira Öde', class: 'bg-red-500', action: async () => {
            const playersCopy = JSON.parse(JSON.stringify(gameData.players));
            
            playersCopy[currentPlayerIndex].money -= rentToPay;
            
            for (const [ownerId, sharePercentage] of Object.entries(owners)) {
                if (ownerId === currentPlayer.id) continue;
                
                const ownerShare = Math.floor(baseRent * (sharePercentage / 100));
                const ownerIndex = playersCopy.findIndex(p => p.id === ownerId);
                if (ownerIndex !== -1) {
                    playersCopy[ownerIndex].money += ownerShare;
                    const ownerName = playersCopy[ownerIndex].name;
                    await window.addLog(`${currentPlayer.name} $${ownerShare} kira ödedi ${ownerName}'e.`);
                }
            }
            
            await window.updateGame({ players: playersCopy });
            window.hideModal();
            
            if (window.checkBankruptcy) {
                const isBankrupt = await window.checkBankruptcy(currentPlayerIndex);
                if (!isBankrupt) {
                    window.endTurn();
                }
            }
        }}]
    );
};

/**
 * Mülk satın al (hisse sistemiyle)
 */
window.buyPropertyWithShare = async function(position, sharePercentage) {
    const space = gameData.settings.board[position];
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    const cost = Math.floor(space.price * (sharePercentage / 100));
    
    if (currentPlayer.isBot) {
        sharePercentage = 100;
    }
    
    if (sharePercentage < 100 && !currentPlayer.isBot) {
        if (window.showPartnerSelectionModal) {
            window.showPartnerSelectionModal(position, sharePercentage, cost);
        }
        return;
    }
    
    const playersCopy = JSON.parse(JSON.stringify(gameData.players));
    const propertiesCopy = JSON.parse(JSON.stringify(gameData.properties));
    
    const currentPlayerIndex = gameData.currentPlayerIndex;
    playersCopy[currentPlayerIndex].money -= cost;
    
    if (!propertiesCopy[position].owners) {
        propertiesCopy[position].owners = {};
    }
    propertiesCopy[position].owners[playersCopy[currentPlayerIndex].id] = sharePercentage;
    propertiesCopy[position].ownerId = playersCopy[currentPlayerIndex].id;
    
    playSound('purchase');
    animatePropertyPurchase(position, currentPlayer.color);
    
    await window.updateGame({
        players: playersCopy,
        properties: propertiesCopy,
        turnState: 'action_complete',
        gameLog: [...gameData.gameLog, `${playersCopy[currentPlayerIndex].name} ${sharePercentage}% ${space.name} satın aldı $${cost}'e.`] 
    });
};

/**
 * Müzayeda başlat
 */
window.startAuction = async function(position) {
    window.hideModal();
    window.hidePropertyBuyPanel();
    
    const space = gameData.settings.board[position];
    const auctionTimer = gameData.settings.auctionTimer || 10;
    
    const activePlayers = gameData.players.filter(p => !p.isBankrupt).map(p => p.id);
    
    const auction = {
        position: position,
        propertyName: space.name,
        currentBid: 10,
        currentBidder: null,
        lastBidder: null,
        playersInAuction: activePlayers,
        timeRemaining: auctionTimer,
        timerDuration: auctionTimer,
        active: true,
        roundsWithoutBid: 0
    };
    
    await window.updateGame({
        auction: auction,
        gameLog: [...gameData.gameLog, `🔨 ${space.name} için müzayeda başladı! Başlangıç fiyatı: $10`]
    });
};

/**
 * Müzayeda modal'ını göster
 */
window.showAuctionModal = function() {
    if (!gameData.auction || !gameData.auction.active) return;
    
    const space = gameData.settings.board[gameData.auction.position];
    const currentPlayer = gameData.players.find(p => p.id === localPlayer.id);
    const amIInAuction = gameData.auction.playersInAuction.includes(localPlayer.id);
    
    const iAmLastBidder = gameData.auction.lastBidder === localPlayer.id;
    const canBidAtAll = currentPlayer && !currentPlayer.isBankrupt && 
                       amIInAuction && !iAmLastBidder;
    
    const bidderName = gameData.auction.currentBidder 
        ? gameData.players.find(p => p.id === gameData.auction.currentBidder)?.name 
        : 'Yok';
    
    const canAfford10 = currentPlayer && currentPlayer.money >= (gameData.auction.currentBid + 10);
    const canAfford50 = currentPlayer && currentPlayer.money >= (gameData.auction.currentBid + 50);
    const canAfford100 = currentPlayer && currentPlayer.money >= (gameData.auction.currentBid + 100);
    
    let statusMessage = '';
    if (iAmLastBidder) {
        statusMessage = '⏳ Başkaları teklif verene kadar bekleyin...';
    } else if (canBidAtAll) {
        statusMessage = '✅ Şimdi teklif verebilirsiniz!';
    } else if (!amIInAuction) {
        statusMessage = '❌ Teklif vermeyi bıraktınız';
    } else {
        statusMessage = '⏳ Bekleniyor...';
    }
    
    window.showModal(
        `🔨 Müzayeda: ${gameData.auction.propertyName}`,
        `
            <div class="text-center">
                <p class="text-lg mb-2">Şimdiki Teklif: <span class="font-bold text-green-600">$${gameData.auction.currentBid}</span></p>
                <p class="text-sm mb-2">En Yüksek Teklifçi: <span class="font-bold">${bidderName}</span></p>
                <p class="text-sm text-gray-600">Paranız: $${currentPlayer?.money || 0}</p>
                <div class="mt-3 p-2 ${iAmLastBidder ? 'bg-yellow-50' : 'bg-blue-50'} rounded">
                    <p class="text-sm font-bold ${iAmLastBidder ? 'text-yellow-600' : 'text-blue-600'}>
                        ${statusMessage}
                    </p>
                    <p class="text-xl font-bold ${gameData.auction.timeRemaining <= 3 ? 'text-red-600' : 'text-blue-600'} mt-1">
                        ⏱️ ${gameData.auction.timeRemaining}s
                    </p>
                </div>
                <p class="text-xs text-gray-500 mt-2">Kalan oyuncu: ${gameData.auction.playersInAuction.length}</p>
            </div>
        `,
        [
            { 
                text: `+$10 (Toplam: $${gameData.auction.currentBid + 10})`, 
                class: 'bg-green-500', 
                action: () => window.placeBid(gameData.auction.currentBid + 10),
                disabled: !canBidAtAll || !canAfford10
            },
            { 
                text: `+$50 (Toplam: $${gameData.auction.currentBid + 50})`, 
                class: 'bg-green-600', 
                action: () => window.placeBid(gameData.auction.currentBid + 50),
                disabled: !canBidAtAll || !canAfford50
            },
            { 
                text: `+$100 (Toplam: $${gameData.auction.currentBid + 100})`, 
                class: 'bg-green-700', 
                action: () => window.placeBid(gameData.auction.currentBid + 100),
                disabled: !canBidAtAll || !canAfford100
            },
            { 
                text: 'Pas Geç', 
                class: 'bg-red-500', 
                action: () => window.passAuction(),
                disabled: !amIInAuction
            }
        ]
    );
};

/**
 * Müzayedada teklif ver
 */
window.placeBid = async function(amount) {
    const currentPlayer = gameData.players.find(p => p.id === localPlayer.id);
    
    if (amount > currentPlayer.money) {
        alert('Yeterli paranız yok!');
        return;
    }
    
    if (gameData.auction.lastBidder === localPlayer.id) {
        alert('Başkası teklif verene kadar beklemek zorundasınız!');
        return;
    }
    
    const auctionCopy = JSON.parse(JSON.stringify(gameData.auction));
    auctionCopy.currentBid = amount;
    auctionCopy.currentBidder = localPlayer.id;
    auctionCopy.lastBidder = localPlayer.id;
    auctionCopy.roundsWithoutBid = 0;
    auctionCopy.timeRemaining = auctionCopy.timerDuration;
    
    await window.updateGame({
        auction: auctionCopy,
        gameLog: [...gameData.gameLog, `${currentPlayer.name} $${amount} teklif etti!`]
    });
};

/**
 * Müzayedadan çıkış
 */
window.passAuction = async function() {
    if (!gameData.auction.playersInAuction.includes(localPlayer.id)) {
        alert('Zaten teklif vermeyi bıraktınız!');
        return;
    }
    
    window.hideModal();
    
    const currentPlayer = gameData.players.find(p => p.id === localPlayer.id);
    const auctionCopy = JSON.parse(JSON.stringify(gameData.auction));
    
    auctionCopy.playersInAuction = auctionCopy.playersInAuction.filter(id => id !== localPlayer.id);
    
    if (auctionCopy.playersInAuction.length === 0) {
        await window.updateGame({
            auction: auctionCopy,
            gameLog: [...gameData.gameLog, `${currentPlayer.name} pas geçti. Herkez pas geçti!`]
        });
        setTimeout(() => window.endAuction(), 500);
        return;
    }
    
    if (auctionCopy.playersInAuction.length === 1 && auctionCopy.currentBidder && 
        auctionCopy.playersInAuction[0] === auctionCopy.currentBidder) {
        await window.updateGame({
            auction: auctionCopy,
            gameLog: [...gameData.gameLog, `${currentPlayer.name} pas geçti. Yalnız bir teklifçi kaldı!`]
        });
        setTimeout(() => window.endAuction(), 500);
        return;
    }
    
    auctionCopy.timeRemaining = auctionCopy.timerDuration;
    
    await window.updateGame({
        auction: auctionCopy,
        gameLog: [...gameData.gameLog, `${currentPlayer.name} pas geçti.`]
    });
};

/**
 * Müzayeda bitir
 */
window.endAuction = async function() {
    if (!gameData.auction) return;
    
    if (auctionTimerInterval) {
        clearInterval(auctionTimerInterval);
        auctionTimerInterval = null;
    }
    
    window.hideModal();
    
    if (gameData.auction.currentBidder) {
        const winner = gameData.players.find(p => p.id === gameData.auction.currentBidder);
        const winnerIndex = gameData.players.findIndex(p => p.id === gameData.auction.currentBidder);
        
        const playersCopy = JSON.parse(JSON.stringify(gameData.players));
        const propertiesCopy = JSON.parse(JSON.stringify(gameData.properties));
        
        playersCopy[winnerIndex].money -= gameData.auction.currentBid;
        propertiesCopy[gameData.auction.position].ownerId = gameData.auction.currentBidder;
        
        await window.updateGame({
            players: playersCopy,
            properties: propertiesCopy,
            auction: { active: false },
            gameLog: [...gameData.gameLog, `🔨 ${winner.name} ${gameData.auction.propertyName}'ı $${gameData.auction.currentBid}'e aldı!`]
        });
        
        window.showModal('🎉 Müzayeda Kazanıldı!', `${winner.name} ${gameData.auction.propertyName}'ı $${gameData.auction.currentBid}'e kazandı!`, [
            { text: 'Devam Et', class: 'bg-blue-500', action: hideModal }
        ]);
        
        setTimeout(() => window.hideModal(), 2000);
    } else {
        await window.updateGame({
            auction: { active: false },
            gameLog: [...gameData.gameLog, `🔨 Müzayeda sona erdi. ${gameData.auction.propertyName} için teklif yoktu.`]
        });
        window.hideModal();
    }
    
    window.endTurn();
};

/**
 * Müzayeda timer'ını güncelle
 */
window.updateAuctionTimer = async function() {
    if (!gameData.auction || !gameData.auction.active) {
        if (auctionTimerInterval) {
            clearInterval(auctionTimerInterval);
            auctionTimerInterval = null;
        }
        return;
    }
    
    const auctionCopy = JSON.parse(JSON.stringify(gameData.auction));
    auctionCopy.timeRemaining--;
    
    if (auctionCopy.timeRemaining <= 0) {
        if (auctionCopy.currentBidder) {
            await window.updateGame({
                auction: auctionCopy,
                gameLog: [...gameData.gameLog, `⏰ Zaman doldu! Müzayeda bitiliyor...`]
            });
            setTimeout(() => window.endAuction(), 500);
        } else {
            auctionCopy.playersInAuction = [];
            await window.updateGame({
                auction: auctionCopy,
                gameLog: [...gameData.gameLog, `⏰ Zaman doldu! Teklif yapılmadı.`]
            });
            setTimeout(() => window.endAuction(), 500);
        }
    } else {
        await window.updateGame({
            auction: auctionCopy
        });
    }
};

// Add log helper
window.addLog = async function(message) {
    await window.updateGame({ gameLog: [...gameData.gameLog, message] });
};

/**
 * Joker Cards Modal - Oyuncuyu hapisten çıkarmak, mütemmadi para ver, vb.
 */
window.showJokerModal = function() {
    if (!gameData || gameData.currentPlayerIndex === null) return;
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== localPlayer.id) {
        if (window.showModal) {
            window.showModal('Uyarı', 'Şu anda sıra değil!', [
                { text: 'Kapat', class: 'bg-gray-500', action: window.hideModal }
            ]);
        }
        return;
    }
    
    const jokerHTML = `
        <div class="space-y-3 text-left">
            <div class="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                <div class="font-bold text-yellow-800">🃏 Hapisten Çık</div>
                <div class="text-sm text-gray-600">Hapishaneden çıkmak için kullanılır</div>
                <div class="text-xs text-gray-500 mt-1">El: ${currentPlayer.getOutOfJailCards || 0}</div>
            </div>
        </div>
    `;
    
    if (window.showModal) {
        window.showModal('🃏 Joker Cards', jokerHTML, [
            {
                text: '❌ Kapat',
                class: 'bg-gray-500',
                action: window.hideModal,
                disabled: false
            }
        ]);
    }
};

/**
 * Take Credit Modal - Kredi Al
 */
window.showCreditModal = function() {
    if (!gameData || gameData.currentPlayerIndex === null) return;
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== localPlayer.id) {
        if (window.showModal) {
            window.showModal('Uyarı', 'Şu anda sıra değil!', [
                { text: 'Kapat', class: 'bg-gray-500', action: window.hideModal }
            ]);
        }
        return;
    }
    
    const creditHTML = `
        <div class="space-y-3 text-left">
            <div class="bg-orange-50 p-3 rounded border-l-4 border-orange-400">
                <div class="font-bold text-orange-800">💳 Kredi Seçenekleri</div>
                <div class="text-sm text-gray-600 mt-2">Şu anda kredisi bulunmamaktadır</div>
            </div>
        </div>
    `;
    
    if (window.showModal) {
        window.showModal('💳 Kredi Al', creditHTML, [
            {
                text: '❌ Kapat',
                class: 'bg-gray-500',
                action: window.hideModal,
                disabled: false
            }
        ]);
    }
};

/**
 * Team Manager Modal - Takım Üyeleri
 */
window.showTeamManager = function() {
    if (!gameData) return;
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    
    const teamHTML = `
        <div class="space-y-3 text-left max-h-96 overflow-y-auto">
            ${gameData.players.map((player, i) => {
                const emoji = player.isBot ? '🤖' : (window.characterIcons && window.characterIcons[player.character] || '❓');
                const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
                return `
                    <div class="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-bold text-blue-800">${emoji} ${player.name}</div>
                                <div class="text-sm text-gray-600">💰 $${player.money}</div>
                                <div class="text-xs text-gray-500">📍 ${gameData.settings.board[player.position].name}</div>
                            </div>
                            ${isCurrentPlayer ? '<div class="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">Sırada</div>' : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    if (window.showModal) {
        window.showModal('👥 Takım Yöneticisi', teamHTML, [
            {
                text: '❌ Kapat',
                class: 'bg-gray-500',
                action: window.hideModal,
                disabled: false
            }
        ]);
    }
};

/**
 * View Pending Trades Modal - Ticari İşlemler
 */
window.viewPendingTrades = function() {
    if (!gameData || !gameData.trades) return;
    
    const pendingTrades = gameData.trades.filter(trade => trade.status === 'pending');
    
    if (pendingTrades.length === 0) {
        if (window.showModal) {
            window.showModal('🤝 Ticari İşlemler', '<div class="text-gray-600">Bekleyen ticari işlem bulunmamaktadır</div>', [
                {
                    text: '❌ Kapat',
                    class: 'bg-gray-500',
                    action: window.hideModal,
                    disabled: false
                }
            ]);
        }
        return;
    }
    
    const tradesHTML = `
        <div class="space-y-3 text-left max-h-96 overflow-y-auto">
            ${pendingTrades.map((trade, i) => {
                const fromPlayer = gameData.players.find(p => p.id === trade.from);
                const toPlayer = gameData.players.find(p => p.id === trade.to);
                const fromEmoji = fromPlayer && (fromPlayer.isBot ? '🤖' : (window.characterIcons && window.characterIcons[fromPlayer.character] || '❓'));
                const toEmoji = toPlayer && (toPlayer.isBot ? '🤖' : (window.characterIcons && window.characterIcons[toPlayer.character] || '❓'));
                
                return `
                    <div class="bg-purple-50 p-3 rounded border-l-4 border-purple-400">
                        <div class="font-bold text-purple-800 mb-2">${fromEmoji} ${fromPlayer?.name || 'Unknown'} → ${toEmoji} ${toPlayer?.name || 'Unknown'}</div>
                        <div class="text-sm text-gray-600">
                            <div>Gönderen: ${trade.fromOffer?.money || 0} $ + ${trade.fromOffer?.properties?.length || 0} mülk</div>
                            <div>İstenen: ${trade.toOffer?.money || 0} $ + ${trade.toOffer?.properties?.length || 0} mülk</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    if (window.showModal) {
        window.showModal('🤝 Ticari İşlemler', tradesHTML, [
            {
                text: '❌ Kapat',
                class: 'bg-gray-500',
                action: window.hideModal,
                disabled: false
            }
        ]);
    }
};

/**
 * Manage Properties Modal - Mülk Yönetimi
 */
window.showManagePropertiesModal = function() {
    if (!gameData || gameData.currentPlayerIndex === null) return;
    
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    const myProperties = gameData.properties.filter(p => p.ownerId === currentPlayer.id && !p.isBankrupt);
    
    if (myProperties.length === 0) {
        if (window.showModal) {
            window.showModal('🏠 Mülk Yönetimi', '<div class="text-gray-600">Sahibi olduğunuz mülk bulunmamaktadır</div>', [
                {
                    text: '❌ Kapat',
                    class: 'bg-gray-500',
                    action: window.hideModal,
                    disabled: false
                }
            ]);
        }
        return;
    }
    
    const propertiesHTML = `
        <div class="space-y-3 text-left max-h-96 overflow-y-auto">
            ${myProperties.map((prop, i) => {
                const space = gameData.settings.board[prop.position];
                return `
                    <div class="p-3 rounded border-l-4" style="background-color: ${prop.color}20; border-color: ${prop.color};">
                        <div class="font-bold" style="color: ${prop.color};">${space.name}</div>
                        <div class="text-sm text-gray-600">
                            <div>🏠 Evler: ${prop.houses}</div>
                            <div>🏨 Otel: ${prop.hotel ? 'Var' : 'Yok'}</div>
                            <div>💰 Değer: $${space.price}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    if (window.showModal) {
        window.showModal('🏠 Mülk Yönetimi', propertiesHTML, [
            {
                text: '❌ Kapat',
                class: 'bg-gray-500',
                action: window.hideModal,
                disabled: false
            }
        ]);
    }
};

/**
 * Game Control Buttons Event Listeners
 */
function initializeGameControlButtons() {
    // Joker Cards Button
    const jokerCardsBtn = document.getElementById('jokerCardsBtn');
    if (jokerCardsBtn) {
        jokerCardsBtn.addEventListener('click', () => {
            console.log('🃏 Joker Cards button clicked');
            if (window.showJokerModal) {
                window.showJokerModal();
            }
        });
    }
    
    // Take Credit Button
    const takeCreditBtn = document.getElementById('takeCreditBtn');
    if (takeCreditBtn) {
        takeCreditBtn.addEventListener('click', () => {
            console.log('💳 Take Credit button clicked');
            if (window.showCreditModal) {
                window.showCreditModal();
            }
        });
    }
    
    // Team Manager Button
    const teamManagerBtn = document.getElementById('teamManagerBtn');
    if (teamManagerBtn) {
        teamManagerBtn.addEventListener('click', () => {
            console.log('👥 Team Manager button clicked');
            if (window.showTeamManager) {
                window.showTeamManager();
            }
        });
    }
    
    // View Trades Button
    const viewTradesBtn = document.getElementById('viewTradesBtn');
    if (viewTradesBtn) {
        viewTradesBtn.addEventListener('click', () => {
            console.log('🤝 View Trades button clicked');
            if (window.viewPendingTrades) {
                window.viewPendingTrades();
            }
        });
    }
    
    // Manage Properties Button
    const managePropertiesBtn = document.getElementById('managePropertiesBtn');
    if (managePropertiesBtn) {
        managePropertiesBtn.addEventListener('click', () => {
            console.log('🏠 Manage Properties button clicked');
            if (window.showManagePropertiesModal) {
                window.showManagePropertiesModal();
            }
        });
    }
}

// Initialize button listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGameControlButtons);
} else {
    initializeGameControlButtons();
}
