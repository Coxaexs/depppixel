/**
 * UI & MODAL SYSTEM
 * Modal gösterme, butonlar, arayüz yönetimi
 */

// DOM Elements - Initialize when document is ready
let modal, modalContent, modalTitle, modalBody, modalButtons;
let propertyBuyPanel, propertyBuyTitle, propertyBuyName, propertyBuyDesc, propertyBuyOptions, propertyBuyClose;

/**
 * DOM Elements'i initialize et
 */
function initializeUIElements() {
    modal = document.getElementById('modal');
    modalContent = document.getElementById('modal-content');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.getElementById('modal-body');
    modalButtons = document.getElementById('modal-buttons');
    
    propertyBuyPanel = document.getElementById('property-buy-panel');
    propertyBuyTitle = document.getElementById('property-buy-title');
    propertyBuyName = document.getElementById('property-buy-name');
    propertyBuyDesc = document.getElementById('property-buy-desc');
    propertyBuyOptions = document.getElementById('property-buy-options');
    propertyBuyClose = document.getElementById('property-buy-close');
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUIElements);
} else {
    initializeUIElements();
}

/**
 * Modal göster
 */
function showModal(title, body, buttons = [], persistent = false) {
    if (!modal) return;
    
    modal.onclick = null;
    
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalButtons.innerHTML = '';
    
    buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.textContent = btnInfo.text;
        button.className = `text-white font-bold py-2 px-4 rounded ${btnInfo.class} disabled:bg-gray-400`;
        button.onclick = (e) => {
            e.stopPropagation();
            if (btnInfo.action) btnInfo.action();
        };
        if (btnInfo.disabled) button.disabled = true;
        modalButtons.appendChild(button);
    });
    
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('scale-95');
    }, 10);
    
    setTimeout(() => {
        if (!persistent) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    hideModal();
                }
            };
        } else {
            modal.onclick = null;
        }
    }, 300);
}
window.showModal = showModal;

/**
 * Modal gizle
 */
function hideModal() {
    if (!modal) return;
    
    modal.classList.add('opacity-0', 'pointer-events-none');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);
}
window.hideModal = hideModal;

/**
 * Property satın alma paneli göster
 */
function showPropertyBuyPanel(position) {
    const space = gameData.settings.board[position];
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    
    if (currentPlayer.isBot) {
        console.warn('⚠️ Bot cannot show property buy panel!');
        return;
    }
    
    propertyBuyTitle.textContent = `🏡 ${space.name} Satın Al?`;
    propertyBuyName.textContent = space.name;
    propertyBuyDesc.innerHTML = `
        <p class="text-sm text-gray-600">Bu mülk sahibi yok. Mülkiyet payını seçin:</p>
        <p class="text-xs text-gray-500 mt-2">💡 İpucu: Daha düşük paylar daha ucuz ama kira gelirini paylaşırsınız.</p>
    `;
    
    propertyBuyOptions.innerHTML = '';
    
    const shareOptions = [
        { percentage: 100, label: '100% Tam Mülkiyet', class: 'bg-green-600 hover:bg-green-700' },
        { percentage: 75, label: '75% Çoğunluk', class: 'bg-green-500 hover:bg-green-600' },
        { percentage: 50, label: '50% Yarı', class: 'bg-green-400 hover:bg-green-500' },
        { percentage: 25, label: '25% Çeyrek', class: 'bg-green-300 hover:bg-green-400 text-gray-800' }
    ];
    
    shareOptions.forEach(option => {
        const cost = Math.floor(space.price * (option.percentage / 100));
        const canAfford = currentPlayer.money >= cost;
        
        const button = document.createElement('button');
        button.className = `w-full ${option.class} text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-400`;
        button.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${option.label}</span>
                <span class="text-lg">$${cost}</span>
            </div>
        `;
        button.disabled = !canAfford;
        button.onclick = () => {
            if (window.buyPropertyWithShare) {
                window.buyPropertyWithShare(position, option.percentage);
                hidePropertyBuyPanel();
            }
        };
        
        propertyBuyOptions.appendChild(button);
    });
    
    const auctionButton = document.createElement('button');
    auctionButton.className = 'w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200';
    auctionButton.innerHTML = '🔨 Red Et & Müzayedaya Başla';
    auctionButton.onclick = () => {
        if (window.startAuction) {
            window.startAuction(position);
            hidePropertyBuyPanel();
        }
    };
    propertyBuyOptions.appendChild(auctionButton);
    
    propertyBuyPanel.classList.remove('hidden');
    setTimeout(() => {
        propertyBuyPanel.style.opacity = '0';
        propertyBuyPanel.style.transform = 'translate(-50%, -50%) scale(0.8)';
        propertyBuyPanel.style.transition = 'all 0.3s ease-out';
        setTimeout(() => {
            propertyBuyPanel.style.opacity = '1';
            propertyBuyPanel.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
    }, 10);
}
window.showPropertyBuyPanel = showPropertyBuyPanel;

/**
 * Property satın alma paneli gizle
 */
function hidePropertyBuyPanel() {
    if (!propertyBuyPanel) return;
    
    propertyBuyPanel.style.opacity = '0';
    propertyBuyPanel.style.transform = 'translate(-50%, -50%) scale(0.8)';
    setTimeout(() => {
        propertyBuyPanel.classList.add('hidden');
    }, 300);
}
window.hidePropertyBuyPanel = hidePropertyBuyPanel;

/**
 * Property detaylarını göster (bilgi modal'ı)
 */
window.showPropertyDetails = function(position, spaceData) {
    const property = gameData.properties[position];
    let detailsHTML = `
        <div class="text-center mb-4">
            <div class="text-3xl mb-2">${spaceData.type === 'property' ? '🏠' : spaceData.type === 'railroad' ? '🚂' : '⚡'}</div>
            <div class="text-2xl font-bold">${spaceData.name}</div>
            ${spaceData.color ? `<div class="w-full h-3 rounded-full mt-2" style="background: ${spaceData.color};"></div>` : ''}
        </div>
    `;
    
    if (spaceData.type === 'property') {
        detailsHTML += `
            <div class="space-y-3">
                <div class="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                    <div class="text-sm text-gray-600">💰 Satın Alma Fiyatı</div>
                    <div class="text-2xl font-bold text-green-700">$${spaceData.price}</div>
                </div>
                <div class="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                    <div class="text-sm text-gray-600 mb-2">💵 Kira Detayları</div>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between"><span>Taban Kira:</span><span class="font-bold">$${spaceData.rent[0]}</span></div>
                        <div class="flex justify-between"><span>1 Ev ile:</span><span class="font-bold">$${spaceData.rent[1]}</span></div>
                        <div class="flex justify-between"><span>2 Ev ile:</span><span class="font-bold">$${spaceData.rent[2]}</span></div>
                        <div class="flex justify-between"><span>3 Ev ile:</span><span class="font-bold">$${spaceData.rent[3]}</span></div>
                        <div class="flex justify-between"><span>4 Ev ile:</span><span class="font-bold">$${spaceData.rent[4]}</span></div>
                        <div class="flex justify-between border-t-2 pt-1 mt-1"><span class="font-bold">Otel ile:</span><span class="font-bold text-purple-700">$${spaceData.rent[5]}</span></div>
                    </div>
                </div>
                <div class="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-500">
                    <div class="text-sm text-gray-600">🏗️ Bina Maliyeti</div>
                    <div class="text-xl font-bold text-orange-700">$${spaceData.houseCost || 50} her biri</div>
                </div>
            </div>
        `;
    }
    
    showModal(`🏠 Mülk Detayları`, detailsHTML, [
        { text: 'Kapat', class: 'bg-blue-500', action: hideModal }
    ]);
};

/**
 * Oyuncu profili göster
 */
window.showPlayerProfile = function(player) {
    const emoji = player.isBot ? '🤖' : (characterIcons[player.character] || '❓');
    
    const profileHTML = `
        <div class="text-center mb-4">
            <div class="text-6xl mb-2">${emoji}</div>
            <div class="text-2xl font-bold" style="color: ${player.color}">${player.name}</div>
            <div class="text-sm text-gray-600">${player.isBot ? '🤖 Bot' : '👤 Gerçek Oyuncu'}</div>
        </div>
        <div class="space-y-3">
            <div class="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                <div class="text-sm text-gray-600">💰 Para</div>
                <div class="text-2xl font-bold text-green-700">$${player.money}</div>
            </div>
            <div class="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                <div class="text-sm text-gray-600">📍 Pozisyon</div>
                <div class="text-xl font-bold text-blue-700">${gameData.settings.board[player.position].name}</div>
            </div>
            <div class="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                <div class="text-sm text-gray-600">🏠 Sahip Olduğu Mülkler</div>
                <div class="text-xl font-bold text-purple-700">${gameData.properties.filter(p => p.ownerId === player.id).length}</div>
            </div>
        </div>
    `;
    
    showModal(`👤 Oyuncu Profili`, profileHTML, [
        { text: 'Kapat', class: 'bg-gray-500', action: hideModal }
    ]);
};

/**
 * Renkler sağlaştır (parlaklık ayarla)
 */
function adjustColor(color, amount) {
    // Safely handle undefined or invalid color
    if (!color || typeof color !== 'string') return '#000000';
    
    const clamp = (num) => Math.min(Math.max(num, 0), 255);
    const num = parseInt(color.replace("#", ""), 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00FF) + amount);
    const b = clamp((num & 0x0000FF) + amount);
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
window.adjustColor = adjustColor;

/**
 * Ses çal
 */
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    switch(type) {
        case 'dice':
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        case 'purchase':
            osc.frequency.value = 1200;
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        case 'error':
            osc.frequency.value = 200;
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
    }
}
window.playSound = playSound;

/**
 * Harita kaydırma animasyonu
 */
function animatePropertyPurchase(position, playerColor) {
    const spaceEl = document.getElementById(`space-${position}`);
    if (!spaceEl) return;
    
    const pulse = document.createElement('div');
    pulse.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid ${playerColor};
        animation: pulse 0.6s ease-out forwards;
    `;
    
    spaceEl.style.position = 'relative';
    spaceEl.appendChild(pulse);
    
    setTimeout(() => pulse.remove(), 600);
}
window.animatePropertyPurchase = animatePropertyPurchase;

/**
 * Zar animasyonu
 */
function animateDiceRoll() {
    if (!dice1El || !dice2El) return;
    
    dice1El.classList.add('dice-rolling');
    dice2El.classList.add('dice-rolling');
    
    let rolls = 0;
    const rollInterval = setInterval(() => {
        const randomDie1 = Math.floor(Math.random() * 6) + 1;
        const randomDie2 = Math.floor(Math.random() * 6) + 1;
        if (window.updateDiceDisplay) {
            window.updateDiceDisplay(randomDie1, randomDie2);
        }
        rolls++;
        if (rolls >= 10) {
            clearInterval(rollInterval);
        }
    }, 100);
}
window.animateDiceRoll = animateDiceRoll;

/**
 * Zar göster
 */
function updateDiceDisplay(die1, die2) {
    if (dice1El) dice1El.textContent = die1;
    if (dice2El) dice2El.textContent = die2;
}
window.updateDiceDisplay = updateDiceDisplay;

/**
 * Chat mesajı ekle
 */
function addChatMessage(playerName, text, isOwn = false) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'bg-blue-50 border-blue-400' : ''}`;
    messageDiv.innerHTML = `
        <div class="sender">${playerName}</div>
        <div class="text">${text}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
window.addChatMessage = addChatMessage;

/**
 * Chat mesajı gönder
 */
function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const text = chatInput.value.trim();
    
    if (!text || !currentGameId || !localPlayer || !ws || ws.readyState !== WebSocket.OPEN) {
        return;
    }
    
    const message = {
        type: 'chat_message',
        gameId: currentGameId,
        playerName: localPlayer.name,
        text: text
    };
    
    sendMessage(message);
    addChatMessage(localPlayer.name, text, true);
    chatInput.value = '';
}
window.sendChatMessage = sendChatMessage;

// Initialize chat event listeners
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('chat-send-btn');
        
        if (chatInput && chatSendBtn) {
            chatSendBtn.addEventListener('click', sendChatMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendChatMessage();
                }
            });
        }
    });
} else {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (chatInput && chatSendBtn) {
        chatSendBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
}
