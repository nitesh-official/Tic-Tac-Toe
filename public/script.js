/* ========================================
   TIC-TAC-TOE MULTIPLAYER CLIENT
   Socket.io Client Logic
   ======================================== */

// ==========================================
// 1. SOCKET CONNECTION
// ==========================================
const socket = io();

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
// Screens
const lobbyScreen = document.getElementById('lobbyScreen');
const waitingScreen = document.getElementById('waitingScreen');
const gameScreen = document.getElementById('gameScreen');

// Lobby
const playerNameInput = document.getElementById('playerName');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const lobbyMessage = document.getElementById('lobbyMessage');

// Waiting
const waitingRoomId = document.getElementById('waitingRoomId');
const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');
const shareLink = document.getElementById('shareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const cancelWaitBtn = document.getElementById('cancelWaitBtn');

// Game
const gameRoomId = document.getElementById('gameRoomId');
const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('statusText');
const statusContainer = document.getElementById('statusContainer');
const resetBtn = document.getElementById('resetBtn');
const newSeriesBtn = document.getElementById('newSeriesBtn');
const leaveBtn = document.getElementById('leaveBtn');

// Player Info
const playerXName = document.getElementById('playerXName');
const playerOName = document.getElementById('playerOName');
const scoreXDisplay = document.getElementById('scoreX');
const scoreODisplay = document.getElementById('scoreO');
const scoreDrawDisplay = document.getElementById('scoreDraw');
const playerXCard = document.getElementById('playerXCard');
const playerOCard = document.getElementById('playerOCard');
const youBadgeX = document.getElementById('youBadgeX');
const youBadgeO = document.getElementById('youBadgeO');

// Chat
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

// Celebration
const celebrationOverlay = document.getElementById('celebrationOverlay');
const celebrationText = document.getElementById('celebrationText');
const celebrationEmoji = document.getElementById('celebrationEmoji');
const celebrationSub = document.getElementById('celebrationSub');
const playAgainBtn = document.getElementById('playAgainBtn');

// Toast
const toastContainer = document.getElementById('toastContainer');

// ==========================================
// 3. GAME STATE (Client Side)
// ==========================================
let myMarker = '';       // 'X' ya 'O' (mera marker)
let myName = '';         // Mera naam
let currentRoomId = '';  // Current room ID
let isMyTurn = false;    // Kya meri bari hai?
let gameActive = false;  // Game chal rahi hai?

// ==========================================
// 4. UTILITY FUNCTIONS
// ==========================================

// Screen switch karna
function showScreen(screen) {
    [lobbyScreen, waitingScreen, gameScreen].forEach(s => {
        s.classList.remove('active-screen');
    });
    screen.classList.add('active-screen');
}

// Toast notification dikhana
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Lobby message dikhana
function showLobbyMsg(message, type = 'info') {
    lobbyMessage.textContent = message;
    lobbyMessage.className = `lobby-message ${type}`;
}

// Clipboard copy
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied! 📋', 'success');
    }).catch(() => {
        // Fallback method
        const temp = document.createElement('input');
        document.body.appendChild(temp);
        temp.value = text;
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showToast('Copied! 📋', 'success');
    });
}

// Chat mein system message add karna
function addSystemMessage(msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg system-msg';
    div.textContent = msg;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Chat mein player message add karna
function addChatMessage(name, message, marker) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const nameClass = marker === 'X' ? 'x-name' : 'o-name';
    div.innerHTML = `<span class="chat-name ${nameClass}">${name}:</span> ${message}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// 5. URL PARAMETER CHECK (Direct Join via Link)
// ==========================================
function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const roomFromURL = params.get('room');
    if (roomFromURL) {
        roomIdInput.value = roomFromURL.toUpperCase();
        showToast('Room ID auto-filled from link!', 'info');
    }
}

// ==========================================
// 6. LOBBY EVENT LISTENERS
// ==========================================

// Create Room Button
createRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        showLobbyMsg('Please enter your name!', 'error');
        playerNameInput.focus();
        return;
    }

    myName = name;
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = '⏳ Creating...';

    socket.emit('create-room', name, (response) => {
        createRoomBtn.disabled = false;
        createRoomBtn.textContent = '🏠 Create Room';

        if (response.success) {
            currentRoomId = response.roomId;
            myMarker = response.marker;

            // Waiting screen par jao
            waitingRoomId.textContent = response.roomId;
            const link = `${window.location.origin}${window.location.pathname}?room=${response.roomId}`;
            shareLink.value = link;

            showScreen(waitingScreen);
            showToast(response.message, 'success');
        } else {
            showLobbyMsg(response.message, 'error');
        }
    });
});

// Join Room Button
joinRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const roomId = roomIdInput.value.trim().toUpperCase();

    if (!name) {
        showLobbyMsg('Please enter your name!', 'error');
        playerNameInput.focus();
        return;
    }

    if (!roomId) {
        showLobbyMsg('Please enter Room ID!', 'error');
        roomIdInput.focus();
        return;
    }

    myName = name;
    joinRoomBtn.disabled = true;
    joinRoomBtn.textContent = '⏳ Joining...';

    socket.emit('join-room', { roomId, playerName: name }, (response) => {
        joinRoomBtn.disabled = false;
        joinRoomBtn.textContent = '🤝 Join Room';

        if (response.success) {
            currentRoomId = response.roomId;
            myMarker = response.marker;
            showToast(`Joined! You are ${myMarker}`, 'success');
            // game-start event ka wait karo
        } else {
            showLobbyMsg(response.message, 'error');
        }
    });
});

// Enter key se bhi kaam kare
playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createRoomBtn.click();
});

roomIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoomBtn.click();
});

// Copy buttons
copyRoomIdBtn.addEventListener('click', () => {
    copyToClipboard(currentRoomId);
});

copyLinkBtn.addEventListener('click', () => {
    copyToClipboard(shareLink.value);
});

// Cancel wait
cancelWaitBtn.addEventListener('click', () => {
    showScreen(lobbyScreen);
    // TODO: Room cleanup on server
    location.reload();
});

// ==========================================
// 7. GAME EVENT LISTENERS
// ==========================================

// Cell click
cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const cellIndex = parseInt(cell.getAttribute('data-index'));

        // Validations
        if (!gameActive) return;
        if (!isMyTurn) {
            showToast("Wait! It's opponent's turn", 'warning');
            return;
        }
        if (cell.classList.contains('taken')) return;

        // Server ko move bhejo
        socket.emit('make-move', {
            roomId: currentRoomId,
            cellIndex: cellIndex
        });
    });
});

// Reset (Rematch)
resetBtn.addEventListener('click', () => {
    socket.emit('reset-game', currentRoomId);
});

// New Series
newSeriesBtn.addEventListener('click', () => {
    socket.emit('new-series', currentRoomId);
});

// Leave
leaveBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave?')) {
        location.reload();
    }
});

// Play Again (from celebration)
playAgainBtn.addEventListener('click', () => {
    celebrationOverlay.classList.remove('show');
    socket.emit('reset-game', currentRoomId);
});

// Chat
sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
});

function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    socket.emit('chat-message', {
        roomId: currentRoomId,
        message: msg,
        playerName: myName
    });

    addChatMessage(myName, msg, myMarker);
    chatInput.value = '';
}

// ==========================================
// 8. SOCKET EVENT HANDLERS (Server se data aana)
// ==========================================

// 8A. Opponent joined (for room creator)
socket.on('opponent-joined', (data) => {
    showToast(`${data.opponentName} joined! 🎮`, 'success');
});

// 8B. Game Start - Dono players ko
socket.on('game-start', (data) => {
    console.log('🎮 Game Start!', data);

    gameActive = true;
    currentRoomId = currentRoomId; // already set

    // Screen switch
    showScreen(gameScreen);
    gameRoomId.textContent = currentRoomId;

    // Player names set karo
    data.players.forEach(player => {
        if (player.marker === 'X') {
            playerXName.textContent = player.name;
        } else {
            playerOName.textContent = player.name;
        }
    });

    // "YOU" badge dikhao
    youBadgeX.classList.remove('show');
    youBadgeO.classList.remove('show');
    if (myMarker === 'X') {
        youBadgeX.classList.add('show');
    } else {
        youBadgeO.classList.add('show');
    }

    // Scores update
    updateScores(data.scores);

    // Board render
    renderBoard(data.board);

    // Turn set
    updateTurn(data.currentTurn);

    addSystemMessage('Game started! Good luck! 🎮');
});

// 8C. Move Made
socket.on('move-made', (data) => {
    const { cellIndex, marker, board, currentTurn } = data;

    // Cell update
    const cell = cells[cellIndex];
    cell.textContent = marker;
    cell.classList.add('taken');
    cell.classList.add(marker === 'X' ? 'x-marker' : 'o-marker');

    // Turn update (agar game khatam nahi hua)
    if (currentTurn) {
        updateTurn(currentTurn);
    }
});

// 8D. Game Over
socket.on('game-over', (data) => {
    gameActive = false;
    isMyTurn = false;

    if (data.result === 'win') {
        const { winner, winnerName, winningCombo, scores } = data;

        // Winning cells highlight
        winningCombo.forEach((index, i) => {
            setTimeout(() => {
                cells[index].classList.add('winning-cell');
            }, i * 150);
        });

        // Sab cells disable
        cells.forEach(c => c.classList.add('game-over-cell'));

        // Status update
        const colorClass = winner === 'X' ? 'x-color' : 'o-color';
        statusText.innerHTML = `🎉 <span class="${colorClass}">${winnerName}</span> Wins!`;
        statusContainer.classList.add('status-win');

        // Scores
        updateScores(scores);

        // Celebration
        setTimeout(() => {
            if (winner === myMarker) {
                celebrationEmoji.textContent = '🏆';
                celebrationText.textContent = 'You Win!';
                celebrationText.style.color = winner === 'X' ? 'var(--x-color)' : 'var(--o-color)';
                celebrationSub.textContent = 'Great game! 🎉';
            } else {
                celebrationEmoji.textContent = '😔';
                celebrationText.textContent = 'You Lost!';
                celebrationText.style.color = 'var(--text-secondary)';
                celebrationSub.textContent = `${winnerName} won this round`;
            }
            celebrationOverlay.classList.add('show');
        }, 800);

        addSystemMessage(`${winnerName} (${winner}) wins! 🏆`);

    } else if (data.result === 'draw') {
        cells.forEach(c => c.classList.add('game-over-cell'));
        statusText.innerHTML = `🤝 It's a Draw!`;
        statusContainer.classList.add('status-draw');

        updateScores(data.scores);

        setTimeout(() => {
            celebrationEmoji.textContent = '🤝';
            celebrationText.textContent = "It's a Draw!";
            celebrationText.style.color = 'var(--draw-color)';
            celebrationSub.textContent = 'Well played by both!';
            celebrationOverlay.classList.add('show');
        }, 600);

        addSystemMessage('Game is a draw! 🤝');
    }
});

// 8E. Game Reset
socket.on('game-reset', (data) => {
    celebrationOverlay.classList.remove('show');
    clearBoard();
    updateTurn(data.currentTurn);
    updateScores(data.scores);
    gameActive = true;
    addSystemMessage('Rematch started! 🔄');
    showToast('Rematch! 🎮', 'info');
});

// 8F. Series Reset
socket.on('series-reset', (data) => {
    celebrationOverlay.classList.remove('show');
    clearBoard();
    updateTurn(data.currentTurn);
    updateScores(data.scores);
    gameActive = true;
    addSystemMessage('New series started! ✨');
    showToast('New Series! ✨', 'info');
});

// 8G. Opponent Disconnected
socket.on('opponent-disconnected', (data) => {
    gameActive = false;
    isMyTurn = false;
    statusText.innerHTML = `⚠️ ${data.playerName} disconnected!`;
    statusContainer.classList.add('status-draw');
    showToast(`${data.playerName} left the game! 😢`, 'error');
    addSystemMessage(`${data.playerName} disconnected`);

    // Sab cells disable
    cells.forEach(c => c.classList.add('game-over-cell'));
});

// 8H. Chat receive
socket.on('chat-message', (data) => {
    const marker = data.playerName === playerXName.textContent ? 'X' : 'O';
    addChatMessage(data.playerName, data.message, marker);
});

// 8I. Error messages
socket.on('error-message', (msg) => {
    showToast(msg, 'error');
});

// 8J. Connection events
socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('disconnect', () => {
    showToast('Disconnected from server! Reconnecting...', 'error');
});

socket.on('reconnect', () => {
    showToast('Reconnected! ✅', 'success');
});

// ==========================================
// 9. HELPER FUNCTIONS
// ==========================================

// Board render karna (existing state se)
function renderBoard(board) {
    cells.forEach((cell, index) => {
        cell.textContent = '';
        cell.className = 'cell';

        if (board[index]) {
            cell.textContent = board[index];
            cell.classList.add('taken');
            cell.classList.add(board[index] === 'X' ? 'x-marker' : 'o-marker');
        }
    });
}

// Board saaf karna
function clearBoard() {
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
    statusContainer.classList.remove('status-win', 'status-draw', 'status-waiting');
}

// Turn update karna
function updateTurn(currentTurn) {
    isMyTurn = (currentTurn === myMarker);

    const colorClass = currentTurn === 'X' ? 'x-color' : 'o-color';
    const turnPlayerName = currentTurn === 'X' ? playerXName.textContent : playerOName.textContent;

    if (isMyTurn) {
        statusText.innerHTML = `Your Turn! <span class="${colorClass}">(${myMarker})</span>`;
    } else {
        statusText.innerHTML = `<span class="${colorClass}">${turnPlayerName}</span>'s Turn`;
    }

    statusContainer.classList.remove('status-win', 'status-draw');

    // Player card highlight
    playerXCard.classList.remove('active-turn');
    playerOCard.classList.remove('active-turn');

    if (currentTurn === 'X') {
        playerXCard.classList.add('active-turn');
    } else {
        playerOCard.classList.add('active-turn');
    }

    // Cursor update
    cells.forEach(cell => {
        cell.classList.remove('not-your-turn');
        if (!isMyTurn) {
            cell.classList.add('not-your-turn');
        }
    });
}

// Scores update
function updateScores(scores) {
    animateScore(scoreXDisplay, scores.X);
    animateScore(scoreODisplay, scores.O);
    animateScore(scoreDrawDisplay, scores.draw);
}

function animateScore(element, newVal) {
    element.style.transform = 'scale(1.4)';
    element.textContent = newVal;
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 300);
}

// ==========================================
// 10. INITIALIZE
// ==========================================
checkURLParams();

console.log('🎮 Tic-Tac-Toe Multiplayer Client Loaded!');
console.log('🌐 Socket.io Connected');