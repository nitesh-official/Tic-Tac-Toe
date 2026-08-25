/* ========================================
   TIC-TAC-TOE MULTIPLAYER SERVER
   Node.js + Express + Socket.io
   ======================================== */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// ==========================================
// 1. SERVER INITIALIZATION
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Static files serve karo (public folder se)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 2. GAME ROOMS STORAGE
// ==========================================
// Har room ka data store karne ke liye
const rooms = new Map();

/*
   Room Structure:
   {
       roomId: 'abc123',
       players: [
           { id: socketId, name: 'Player 1', marker: 'X' },
           { id: socketId, name: 'Player 2', marker: 'O' }
       ],
       board: ['', '', '', '', '', '', '', '', ''],
       currentTurn: 'X',
       isGameActive: true,
       scores: { X: 0, O: 0, draw: 0 }
   }
*/

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================

// Random Room ID generate karna (6 characters)
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Agar yeh ID pehle se exist karti hai toh naya banao
    if (rooms.has(roomId)) {
        return generateRoomId();
    }
    return roomId;
}

// Winning combinations check karna
const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],  // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],  // Columns
    [0, 4, 8], [2, 4, 6]               // Diagonals
];

function checkWinner(board) {
    for (const combo of WINNING_COMBOS) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return {
                winner: board[a],
                winningCombo: combo
            };
        }
    }
    return null;
}

function checkDraw(board) {
    return board.every(cell => cell !== '');
}

// Room mein opponent dhoondhna
function getOpponent(room, socketId) {
    return room.players.find(p => p.id !== socketId);
}

// Player ko room mein dhoondhna
function getPlayer(room, socketId) {
    return room.players.find(p => p.id === socketId);
}

// Player kis room mein hai dhoondhna
function findPlayerRoom(socketId) {
    for (const [roomId, room] of rooms) {
        if (room.players.some(p => p.id === socketId)) {
            return roomId;
        }
    }
    return null;
}

// ==========================================
// 4. SOCKET.IO CONNECTION HANDLING
// ==========================================
io.on('connection', (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);

    // ------------------------------------------
    // 4A. CREATE ROOM - Naya room banana
    // ------------------------------------------
    socket.on('create-room', (playerName, callback) => {
        const roomId = generateRoomId();

        // Room data structure banao
        const roomData = {
            roomId: roomId,
            players: [
                {
                    id: socket.id,
                    name: playerName || 'Player 1',
                    marker: 'X'
                }
            ],
            board: ['', '', '', '', '', '', '', '', ''],
            currentTurn: 'X',
            isGameActive: false,  // Dusra player aane tak wait
            scores: { X: 0, O: 0, draw: 0 }
        };

        // Room store karo
        rooms.set(roomId, roomData);

        // Socket ko room mein daalo
        socket.join(roomId);

        console.log(`🏠 Room created: ${roomId} by ${playerName}`);

        // Client ko Room ID bhejo
        callback({
            success: true,
            roomId: roomId,
            marker: 'X',
            message: `Room ${roomId} created! Waiting for opponent...`
        });
    });

    // ------------------------------------------
    // 4B. JOIN ROOM - Room mein shamil hona
    // ------------------------------------------
    socket.on('join-room', (data, callback) => {
        const { roomId, playerName } = data;
        const upperRoomId = roomId.toUpperCase();

        // Room exist karti hai?
        if (!rooms.has(upperRoomId)) {
            callback({
                success: false,
                message: 'Room not found! Check Room ID again.'
            });
            return;
        }

        const room = rooms.get(upperRoomId);

        // Room full toh nahi?
        if (room.players.length >= 2) {
            callback({
                success: false,
                message: 'Room is full! Create a new room.'
            });
            return;
        }

        // Apne aap se toh nahi khel raha?
        if (room.players[0].id === socket.id) {
            callback({
                success: false,
                message: 'You cannot join your own room!'
            });
            return;
        }

        // Player 2 ko room mein daalo
        room.players.push({
            id: socket.id,
            name: playerName || 'Player 2',
            marker: 'O'
        });

        room.isGameActive = true;

        // Socket ko room mein join karao
        socket.join(upperRoomId);

        console.log(`🤝 ${playerName} joined room: ${upperRoomId}`);

        // Joiner ko confirm karo
        callback({
            success: true,
            roomId: upperRoomId,
            marker: 'O',
            opponentName: room.players[0].name,
            message: 'Joined successfully!'
        });

        // Room creator (Player 1) ko batao ki opponent aa gaya
        socket.to(upperRoomId).emit('opponent-joined', {
            opponentName: playerName || 'Player 2',
            message: 'Opponent joined! Game starting...'
        });

        // Dono ko game start ka signal bhejo
        io.to(upperRoomId).emit('game-start', {
            board: room.board,
            currentTurn: room.currentTurn,
            players: room.players.map(p => ({
                name: p.name,
                marker: p.marker
            })),
            scores: room.scores
        });
    });

    // ------------------------------------------
    // 4C. MAKE MOVE - Move khelna
    // ------------------------------------------
    socket.on('make-move', (data) => {
        const { roomId, cellIndex } = data;

        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);
        const player = getPlayer(room, socket.id);

        // Validate the move
        if (!player) {
            socket.emit('error-message', 'You are not in this room!');
            return;
        }

        if (!room.isGameActive) {
            socket.emit('error-message', 'Game is not active!');
            return;
        }

        if (room.currentTurn !== player.marker) {
            socket.emit('error-message', 'It\'s not your turn!');
            return;
        }

        if (room.board[cellIndex] !== '') {
            socket.emit('error-message', 'Cell already taken!');
            return;
        }

        // ✅ Valid move - Board update karo
        room.board[cellIndex] = player.marker;

        console.log(`🎮 Room ${roomId}: ${player.name} (${player.marker}) → Cell ${cellIndex}`);

        // Win check karo
        const winResult = checkWinner(room.board);

        if (winResult) {
            // JEET!
            room.isGameActive = false;
            room.scores[winResult.winner]++;

            io.to(roomId).emit('move-made', {
                cellIndex: cellIndex,
                marker: player.marker,
                board: room.board
            });

            io.to(roomId).emit('game-over', {
                result: 'win',
                winner: winResult.winner,
                winnerName: player.name,
                winningCombo: winResult.winningCombo,
                scores: room.scores
            });

            console.log(`🏆 Room ${roomId}: ${player.name} (${player.marker}) WINS!`);
            return;
        }

        if (checkDraw(room.board)) {
            // DRAW!
            room.isGameActive = false;
            room.scores.draw++;

            io.to(roomId).emit('move-made', {
                cellIndex: cellIndex,
                marker: player.marker,
                board: room.board
            });

            io.to(roomId).emit('game-over', {
                result: 'draw',
                scores: room.scores
            });

            console.log(`🤝 Room ${roomId}: DRAW!`);
            return;
        }

        // Turn switch karo
        room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';

        // Dono players ko move update bhejo
        io.to(roomId).emit('move-made', {
            cellIndex: cellIndex,
            marker: player.marker,
            board: room.board,
            currentTurn: room.currentTurn
        });
    });

    // ------------------------------------------
    // 4D. RESET GAME - Game restart karna
    // ------------------------------------------
    socket.on('reset-game', (roomId) => {
        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);

        // Board saaf karo
        room.board = ['', '', '', '', '', '', '', '', ''];
        room.currentTurn = 'X';
        room.isGameActive = true;

        console.log(`🔄 Room ${roomId}: Game reset!`);

        // Dono players ko reset signal bhejo
        io.to(roomId).emit('game-reset', {
            board: room.board,
            currentTurn: room.currentTurn,
            scores: room.scores
        });
    });

    // ------------------------------------------
    // 4E. NEW SERIES - Score bhi reset
    // ------------------------------------------
    socket.on('new-series', (roomId) => {
        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);

        room.board = ['', '', '', '', '', '', '', '', ''];
        room.currentTurn = 'X';
        room.isGameActive = true;
        room.scores = { X: 0, O: 0, draw: 0 };

        console.log(`✨ Room ${roomId}: New series started!`);

        io.to(roomId).emit('series-reset', {
            board: room.board,
            currentTurn: room.currentTurn,
            scores: room.scores
        });
    });

    // ------------------------------------------
    // 4F. CHAT MESSAGE (Bonus Feature!)
    // ------------------------------------------
    socket.on('chat-message', (data) => {
        const { roomId, message, playerName } = data;
        if (!rooms.has(roomId)) return;

        socket.to(roomId).emit('chat-message', {
            message: message,
            playerName: playerName,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    // ------------------------------------------
    // 4G. DISCONNECT - Player disconnect hona
    // ------------------------------------------
    socket.on('disconnect', () => {
        console.log(`❌ Player disconnected: ${socket.id}`);

        const roomId = findPlayerRoom(socket.id);

        if (roomId) {
            const room = rooms.get(roomId);
            const disconnectedPlayer = getPlayer(room, socket.id);

            if (disconnectedPlayer) {
                // Opponent ko batao
                socket.to(roomId).emit('opponent-disconnected', {
                    message: `${disconnectedPlayer.name} has disconnected!`,
                    playerName: disconnectedPlayer.name
                });

                // Player ko room se hatao
                room.players = room.players.filter(p => p.id !== socket.id);
                room.isGameActive = false;

                // Agar room khaali hai toh delete karo
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`🗑️ Room ${roomId} deleted (empty)`);
                }
            }
        }
    });

    // ------------------------------------------
    // 4H. RECONNECT ATTEMPT
    // ------------------------------------------
    socket.on('rejoin-room', (data, callback) => {
        const { roomId, playerName } = data;

        if (!rooms.has(roomId)) {
            callback({ success: false, message: 'Room no longer exists' });
            return;
        }

        const room = rooms.get(roomId);

        if (room.players.length >= 2) {
            callback({ success: false, message: 'Room is full' });
            return;
        }

        // Determine marker
        const takenMarker = room.players[0]?.marker;
        const availableMarker = takenMarker === 'X' ? 'O' : 'X';

        room.players.push({
            id: socket.id,
            name: playerName,
            marker: availableMarker
        });

        room.isGameActive = true;
        socket.join(roomId);

        callback({
            success: true,
            marker: availableMarker,
            board: room.board,
            scores: room.scores,
            currentTurn: room.currentTurn
        });

        socket.to(roomId).emit('opponent-joined', {
            opponentName: playerName,
            message: `${playerName} reconnected!`
        });

        io.to(roomId).emit('game-start', {
            board: room.board,
            currentTurn: room.currentTurn,
            players: room.players.map(p => ({
                name: p.name,
                marker: p.marker
            })),
            scores: room.scores
        });
    });
});

// ==========================================
// 5. ADMIN ROUTES (Optional)
// ==========================================
app.get('/api/rooms', (req, res) => {
    const roomList = [];
    for (const [id, room] of rooms) {
        roomList.push({
            roomId: id,
            playerCount: room.players.length,
            isActive: room.isGameActive
        });
    }
    res.json({
        totalRooms: rooms.size,
        rooms: roomList
    });
});

// ==========================================
// 6. START SERVER
// ==========================================
server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║   🎮 Tic-Tac-Toe Multiplayer Server  ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║   🌐 Running on port: ${PORT}            ║`);
    console.log(`║   📡 URL: http://localhost:${PORT}       ║`);
    console.log('║   ✅ Socket.io: Ready                 ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
});