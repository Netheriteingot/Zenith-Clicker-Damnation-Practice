// Game state and networking
const peer = new Peer();
let host = 0;
let conn, roomid;
let uname = "";
let game;
const statusDiv = document.getElementById('status');

// DOM elements
const connectionArea = document.getElementById('connectionArea');
const gameArea = document.getElementById('gameArea');
const characterSelection = document.getElementById('characterSelection');
const playerHand = document.getElementById('playerHand');
const timerDisplay = document.getElementById('timer');
const endTurnBtn = document.getElementById('endTurnBtn');
const confirmCharactersBtn = document.getElementById('confirmCharactersBtn');

const hostIdDisplay = document.getElementById('hostIdDisplay');
const hostIdText = document.getElementById('hostIdText');
const copyHostIdBtn = document.getElementById('copyHostIdBtn');

// Host Game (Player 1)
document.getElementById('hostBtn').addEventListener('click', () => {
    console.log("Hosting...")
    peer.on('open', (id) => {
        statusDiv.textContent = `Status: Hosting (ID: ${id})`;

        // Show host ID and copy button
        hostIdDisplay.style.display = 'block';
        hostIdText.textContent = `Your Host ID: ${id}`;

        host = 1;
        uname = document.getElementById('nameInput').value.trim() || "Player 1";

        // Initialize game
        game = new CardGame(host);

        // Wait for incoming connection
        peer.on('connection', (connection) => {
            conn = connection;
            game.connection = conn;
            setupConnectionEvents();
            game.startGame();
            showCharacterSelection();
        });
    });
});

// Add copy button functionality
copyHostIdBtn.addEventListener('click', () => {
    const hostId = hostIdText.textContent.replace('Your Host ID: ', '');

    // Create temporary input element to copy text
    const tempInput = document.createElement('input');
    tempInput.value = hostId;
    document.body.appendChild(tempInput);
    tempInput.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            copyHostIdBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyHostIdBtn.textContent = 'Copy ID';
            }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }

    document.body.removeChild(tempInput);
});

// Connect to Host (Player 2)
document.getElementById('connectBtn').addEventListener('click', () => {
    const hostId = document.getElementById('peerIdInput').value.trim();
    if (!hostId) return;

    host = 0;
    conn = peer.connect(hostId);
    uname = document.getElementById('nameInput').value.trim() || "Player 2";
    setupConnectionEvents();
});

function setupConnectionEvents() {
    conn.on('open', () => {
        roomid = conn.peer;
        statusDiv.textContent = `Status: Connected to ${roomid}`;
        sendData('name', uname);

        if (host === 0) {
            game = new CardGame(host, conn);
            showCharacterSelection();
        }
    });

    conn.on('data', (data) => {
        const obj = JSON.parse(data);
        handleNetworkData(obj);
    });

    conn.on('error', (err) => {
        console.error("Connection error:", err);
        statusDiv.textContent = `Error: ${err.message}`;
    });
}

function handleNetworkData(obj) {
    console.log("Received:", obj.type, obj);

    // Handle full state syncs first
    if (obj.fullState) {
        game.restoreFromState(obj.fullState);
    }

    switch (obj.type) {
        case 'game_start':
            // Update game state from host
            if (obj.state) {
                game.restoreFromState(obj.state);
            }

            // Update UI
            connectionArea.style.display = 'none';
            characterSelection.style.display = 'none';
            gameArea.style.display = 'block';

            // Force update all UI elements
            updateGameState(game.getGameState());
            break;
        case 'name':
            statusDiv.textContent = `Status: Connected to ${obj.val}`;
            break;

        case 'character_selection':
            if (host === 0) { // Client receives host's characters
                game.players.player1.characters = obj.val.characters;
                game.players.player1.availableCharacters = obj.val.availableCharacters;
            } else { // Host receives client's characters
                game.players.player2.characters = obj.val.characters;
                game.players.player2.availableCharacters = obj.val.availableCharacters;
            }
            renderCharacterSelection(game.players[host === 1 ? 'player1' : 'player2'].characters,
                game.players[host === 1 ? 'player1' : 'player2'].availableCharacters);
            break;

        case 'characters_confirmed':
            // This is the ONLY place where we transition to game view
            game.players.player2.characters = obj.val.characters;
            game.players.player2.availableCharacters = obj.val.availableCharacters;
            connectionArea.style.display = 'none';
            characterSelection.style.display = 'none';
            gameArea.style.display = 'block';
            updateGameState(obj.state || game.getGameState());
            sendData('game_start', {});
            game.sendAction('state_sync', true);
            break;

        case 'game_action':
            // Process game actions but don't update UI here
            game.processAction(obj.action);
            break;

        case 'turn_start':
            startTurn(obj.timeLimit);
            break;

        case 'turn_end':
            endTurn();
            break;

        default:
            console.warn('Unknown message type:', obj.type);
    }

    // Only update UI if we have a full state or it's a game start
    if (obj.fullState || obj.type === 'game_start') {
        updateGameState(game.getGameState());
    }
}

function sendData(type, val) {
    if (conn && conn.open) {
        conn.send(JSON.stringify({ type, val }));
    }
}

// Game UI Functions
function showCharacterSelection() {
    connectionArea.style.display = 'none';
    gameArea.style.display = 'none';
    characterSelection.style.display = 'block';

    if (host === 1) {
        renderCharacterSelection(game.players.player1.characters, game.players.player1.availableCharacters);
        // Notify client to wait
        sendData('waiting_for_player', { player: 'player1' });
    }
}
function updateCharacterSelection(data) {
    if (host === 0) { // Only client needs to update from host's data
        game.players.player2.characters = data.characters;
        game.players.player2.availableCharacters = data.availableCharacters;
        renderCharacterSelection(game.players.player2.characters, game.players.player2.availableCharacters);
    }
}

function renderCharacterSelection(characters, availableCharacters) {
    console.log(characters)
    const playerCharsDiv = document.getElementById('playerCharacters');
    playerCharsDiv.innerHTML = '<h3>Your Characters</h3>';

    characters.forEach((char, index) => {
        const charDiv = document.createElement('div');
        charDiv.className = 'character';
        charDiv.innerHTML = `
            <strong>${char.name}</strong><br>
            Health: ${char.health}<br>
            Max Stamina: ${char.staminaCap}<br>
            Card Draw: ${char.cardDraw}<br>
            <button class="reselect-btn" data-char-id="${char.id}">Reselect</button>
        `;
        playerCharsDiv.appendChild(charDiv);
    });

    const availableDiv = document.getElementById('availableCharacters');
    availableDiv.innerHTML = '<h3>Available Characters</h3>';

    availableCharacters.forEach(char => {
        const charDiv = document.createElement('div');
        charDiv.className = 'character';
        charDiv.innerHTML = `
            <strong>${char.name}</strong><br>
            Health: ${char.health}<br>
            Max Stamina: ${char.staminaCap}<br>
            Card Draw: ${char.cardDraw}<br>
            <button class="select-btn" data-char-id="${char.id}">Select</button>
        `;
        availableDiv.appendChild(charDiv);
    });

    // Add event listeners
    document.querySelectorAll('.reselect-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReselect(btn.dataset.charId));
    });

    document.querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => handleSelect(btn.dataset.charId));
    });
}

function handleReselect(charId) {
    // Find a random available character to replace with
    const player = host === 1 ? 'player1' : 'player2';
    const availableChars = game.players[player].availableCharacters.filter(c =>
        !game.players[player].characters.some(pc => pc.id === c.id)
    );

    if (availableChars.length > 0) {
        const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];
        game.reselectCharacter(player, parseInt(charId), randomChar.id);
        renderCharacterSelection(game.players[player].characters, game.players[player].availableCharacters);
    }
}

function handleSelect(charId) {
    // In a full implementation, this would handle manual selection
}

// In app.js, modify the character confirmation handler
confirmCharactersBtn.addEventListener('click', () => {
    const player = host === 1 ? 'player1' : 'player2';
    game.confirmCharacters(player);

    if (host === 1) {
        // Host confirms first
        characterSelection.style.display = 'none';
        statusDiv.textContent = 'Status: Waiting for opponent to select characters';

        // Send character data to client (with their available characters)
        sendData('character_selection', {
            characters: game.players.player2.characters,
            availableCharacters: game.players.player2.availableCharacters
        });
    } else {
        // Client confirms - send the actual selected characters to host
        sendData('characters_confirmed', {
            characters: game.players.player2.characters,
            availableCharacters: game.players.player2.availableCharacters
        });

        statusDiv.textContent = 'Status: Characters confirmed, waiting for game to start';
    }
});

// Add this new handler for when the main game starts
function handleGameStart(state) {
    // Hide all other UI sections
    connectionArea.style.display = 'none';
    characterSelection.style.display = 'none';

    // Show game area
    gameArea.style.display = 'block';

    // Update UI with initial game state
    updateGameState(state || game.getGameState());

    statusDiv.textContent = 'Status: Game started!';
}
function updateGameState(state) {
    const player = host === 1 ? 'player1' : 'player2';
    const opponent = host === 1 ? 'player2' : 'player1';

    // Update player characters
    const playerCharsDiv = document.getElementById('playerCharacters2');
    playerCharsDiv.innerHTML = '<h3>Your Characters</h3>';

    if (state.players[player]?.characters) {
        state.players[player].characters.forEach(char => {
            const charDiv = document.createElement('div');
            charDiv.className = 'character';
            charDiv.innerHTML = `
                <strong>${char.name}</strong><br>
                Health: ${char.health}<br>
                Card Draw: ${char.cardDraw}<br>
                Stamina: ${char.stamina}/${char.staminaCap}
            `;
            playerCharsDiv.appendChild(charDiv);
        });
    }

    // Update opponent characters
    const opponentCharsDiv = document.getElementById('opponentCharacters');
    opponentCharsDiv.innerHTML = '<h3>Opponent</h3>';

    if (state.players[opponent]?.characters) {
        state.players[opponent].characters.forEach(char => {
            const charDiv = document.createElement('div');
            charDiv.className = 'character';
            charDiv.innerHTML = `
                <strong>${char.name}</strong><br>
                Health: ${char.health}<br>
                Card Draw: ${char.cardDraw}
            `;
            opponentCharsDiv.appendChild(charDiv);
        });
    }

    // Update hand
    const playerHandDiv = document.getElementById('playerHand');
    playerHandDiv.innerHTML = '';

    if (state.players[player]?.hand) {
        state.players[player].hand.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            cardDiv.textContent = card;
            cardDiv.addEventListener('click', () => useCard(card));
            playerHandDiv.appendChild(cardDiv);
        });
    }
}

function useCard(card) {
    const player = host === 1 ? 'player1' : 'player2';

    // In a full implementation, this would handle card targeting
    game.handlUseCard(player, card, {});
}

function startTurn(timeLimit) {
    let timeLeft = timeLimit / 1000;
    timerDisplay.textContent = timeLeft;

    const timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timer);
            endTurn();
        }
    }, 1000);

    endTurnBtn.addEventListener('click', () => {
        clearInterval(timer);
        game.endTurn();
    });
}

function endTurn() {
    timerDisplay.textContent = "Opponent's turn";
    endTurnBtn.disabled = true;
}

// Error handling
peer.on('error', (err) => {
    console.error("PeerJS error:", err);
    statusDiv.textContent = `Error: ${err.message}`;
});

// CardGame class implementation would go here
// (Copy the entire CardGame class from previous implementation)