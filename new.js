const peer = new Peer();
let host = 0;
let conn, roomid;

let timer = 60;

let currentcard = -1, action = () => { };

let GAME = {
    players: {
        player1: {
            id: 1,
            uname: '',
            characters: [],
            characters_to_select: [],
            cards: [],
            ready: false,
            max_cards: () => {
                let res = 1 + GAME.players.player1.characters.reduce((sum, char) => sum + char.cardDraw, 0);
                return res ? res : 5;
            },
        },
        player2: {
            id: 2,
            uname: '',
            characters: [],
            characters_to_select: [],
            cards: [],
            ready: false,
            max_cards: () => {
                let res = 1 + GAME.players.player2.characters.reduce((sum, char) => sum + char.cardDraw, 0);
                return res ? res : 5;
            },
        },
    },
    stage: 'pre',
    turn: 0,
    cards: [...Array(150).keys()],
    discard: [],
}

const characterPool = [
    { id: 1, side: 0, alive: 1, name: 'Arghena', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2, equip: [], mod: -1, heal: (h) => { }, damage: (h) => { }, getstamina: (h) => { } },
    { id: 2, side: 0, alive: 1, name: 'GTD', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2, equip: [], mod: -1, heal: (h) => { }, damage: (h) => { }, getstamina: (h) => { } },
    { id: 3, side: 0, alive: 1, name: 'Tizago', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2, equip: [], mod: -1, heal: (h) => { }, damage: (h) => { }, getstamina: (h) => { } },
    { id: 4, side: 0, alive: 1, name: 'Lavender', baseHealth: 6, health: 6, cardDraw: 1, stamina: 0, staminaCap: 2, equip: [], mod: -1, heal: (h) => { }, damage: (h) => { }, getstamina: (h) => { } },
    { id: 5, side: 0, alive: 1, name: 'MrZ', baseHealth: 6, health: 6, cardDraw: 3, stamina: 0, staminaCap: 2, equip: [], mod: -1, heal: (h) => { }, damage: (h) => { }, getstamina: (h) => { } },
    { id: 6, side: 0, alive: 1, name: 'TheBestNoob', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2, equip: [], mod: -1, heal: (h) => { }, damage: (h) => { }, getstamina: (h) => { } }
];


const statusDiv = document.getElementById('status');

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
        GAME.players.player1.uname = document.getElementById('nameInput').value.trim() || "Player 1";

        // Wait for incoming connection
        peer.on('connection', (connection) => {
            conn = connection;
            setupConnectionEvents();
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
    GAME.players.player2.uname = document.getElementById('nameInput').value.trim() || "Player 2";
    setupConnectionEvents();
});

function setupConnectionEvents() {
    conn.on('open', () => {
        roomid = conn.peer;
        statusDiv.textContent = `Status: Connected to ${roomid}`;
        set(`GAME.players.player${2 - host}.uname = '${GAME.players[`player${2 - host}`].uname}';`);
        setTimeout(startSelection(), 1000);
    });

    conn.on('data', (data) => {
        const obj = JSON.parse(data);
        console.log('receive ' + data);
        if (obj.type === 'sync_set') {
            eval(obj.val);
            if (GAME.stage === 'main') updateGameState();
        }
        if (obj.type === 'declare') {
            let val = obj.val;
            console.log('declared ' + val);
            if (val === 'character_selection') setupCharacterSelection();
            if (val === '0_ready') if (GAME.players.player1.ready) startGame();
            if (val === 'game_start') {
                timer = -1000;
                handleGameStart();
            }
            if (val === 'end_turn') startTurn();
        }
    });

    conn.on('error', (err) => {
        console.error("Connection error:", err);
        statusDiv.textContent = `Error: ${err.message}`;
    });
}

const sendData = (type, val) => {
    if (conn && conn.open) {
        conn.send(JSON.stringify({ type, val }));
    }
}
const set = (val) => {
    console.log('sync_set ' + val);
    eval(val);
    if (GAME.stage === 'main') updateGameState();
    sendData('sync_set', val);
}
const declare = (val) => {
    console.log('declare ' + val);
    sendData('declare', val);
}
const swap = (o1, o2) => {
    const temp = { ...o1 };
    o1 = { ...o2 };
    o2 = { ...temp };
}

let sel = [];

function startSelection() {
    sel = [0, 1];
    if (host === 1) {
        const shuffledPool = [...characterPool].sort(() => Math.random() - 0.5);
        set(`GAME.players.player1.characters_to_select = JSON.parse('${JSON.stringify(shuffledPool.slice(0, 3))}');`);
        set(`GAME.players.player2.characters_to_select = JSON.parse('${JSON.stringify(shuffledPool.slice(3, 6))}');`);
    }
    declare('character_selection');
}

function setupCharacterSelection() {
    connectionArea.style.display = 'none';
    gameArea.style.display = 'none';
    characterSelection.style.display = 'block';
    const playerCharsDiv = document.getElementById('playerCharacters');
    playerCharsDiv.innerHTML = '<h3>Your Characters</h3>';

    let availableCharacters = GAME.players[`player${2 - host}`].characters_to_select;
    let characters = [availableCharacters[sel[0]], availableCharacters[sel[1]]];

    characters.forEach((char, index) => {
        const charDiv = document.createElement('div');
        charDiv.className = 'character';
        charDiv.innerHTML = `
            <strong>${char.name}</strong><br>
            Health: ${char.health}<br>
            Max Stamina: ${char.staminaCap}<br>
            Card Draw: ${char.cardDraw}<br>
            <button class="reselect-btn" data-char-id="${index}">Reselect</button>
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
        `;
        availableDiv.appendChild(charDiv);
    });

    document.querySelectorAll('.reselect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            let id = btn.dataset.charId;
            sel[id] = 3 - sel[0] - sel[1];
            setupCharacterSelection();
        });
    });
}

confirmCharactersBtn.addEventListener('click', () => {
    confirmCharactersBtn.style.display = 'none';
    document.getElementById('availableCharacters').innerHTML = 'Waiting for other player to select characters...';

    let availableCharacters = GAME.players[`player${2 - host}`].characters_to_select;
    let characters = [availableCharacters[sel[0]], availableCharacters[sel[1]]];
    characters[0].side = 2 - host;
    characters[0].slot = 0;
    characters[1].side = 2 - host;
    characters[1].slot = 1;
    set(`GAME.players['player${2 - host}'].characters = JSON.parse('${JSON.stringify(characters)}');`);
    set(`GAME.players['player${2 - host}'].ready = true;`);
    declare(`${host}_ready`);

    if (host === 1 && GAME.players.player2.ready) startGame();
});

function startGame() {
    if (host !== 1) return;
    set(`GAME.stage = 'main';`);
    declare(`game_start`);
    handleGameStart();
    startTurn();
}

setInterval(() => {
    if (GAME.stage !== 'main') return;
    if (timer <= 0) {
        timerDisplay.textContent = 'Opponent\'s turn';
        return;
    }
    timerDisplay.textContent = `Time left: ${timer} seconds`;
    timer--;
    if (timer == 0) endTurn();
}, 1000);

function handleGameStart() {
    connectionArea.style.display = 'none';
    characterSelection.style.display = 'none';
    gameArea.style.display = 'block';
    for (const ch of [...GAME.players.player1.characters, ...GAME.players.player2.characters]) setupCharacter(ch);
    updateGameState();
    statusDiv.textContent = 'Status: Game started!';
}

function setupCharacter(ch) {
    ch.alive = true;
    ch.heal = (h) => {
        if (ch.health >= ch.baseHealth);
        else if (ch.health <= ch.baseHealth - h) ch.health += h;
        else ch.health = ch.baseHealth;
    }
    ch.damage = (h) => {
        if (ch.health <= h) ch.health = 0, ch.alive = false;
        else ch.health -= h;
    }
    ch.getstamina = (h) => {
        if (ch.stamina >= ch.staminaCap);
        if (ch.stamina + h <= ch.staminaCap) ch.stamina += h;
        else ch.stamina = ch.staminaCap;
    }
}
function restoreGame() {
    for (const ch of [...GAME.players.player1.characters, ...GAME.players.player2.characters]) setupCharacter(ch);
    GAME.players.player1.max_cards = () => {
        let res = 1 + GAME.players.player1.characters.reduce((sum, char) => sum + char.cardDraw, 0);
        return res ? res : 5;
    };
    GAME.players.player2.max_cards = () => {
        let res = 1 + GAME.players.player2.characters.reduce((sum, char) => sum + char.cardDraw, 0);
        return res ? res : 5;
    };
}

function startTurn() {
    if (GAME.stage !== 'main') return;
    timer = 60;
    set(`GAME.turn = (GAME.turn + 1) % 2;`);
    gameArea.disabled = false;
    const currentPlayer = GAME.players[`player${2 - GAME.turn}`];
    drawToMax(currentPlayer);
    endTurnBtn.style.display = 'block';
    updateGameState();
}

endTurnBtn.addEventListener('click', () => {
    endTurn();
    endTurnBtn.style.display = 'none';
});

function endTurn() {
    declare('end_turn');
    timer = -1000;
    gameArea.disabled = true;
}

const drawCard = () => {
    if (GAME.cards.length === 0) GAME.cards = [...GAME.discard], GAME.discard = [];
    if (GAME.cards.length === 0) return -1;
    const idx = Math.floor(Math.random() * GAME.cards.length);
    return GAME.cards.splice(idx, 1)[0];
}
function drawToMax(player) {
    while (player.cards.length < player.max_cards()) {
        const card = drawCard();
        if (card === -1) break;
        player.cards.push(card);
    }
    set(`GAME.players['player${player.id}'].cards = JSON.parse('${JSON.stringify(player.cards)}');`);
    set(`GAME.cards = JSON.parse('${JSON.stringify(GAME.cards)}');`);
}

function updateGameState() {
    const player = host === 1 ? 'player1' : 'player2';
    const opponent = host === 1 ? 'player2' : 'player1';

    cardmap = {};

    // Update player characters
    const playerCharsDiv = document.getElementById('playerCharacters2');
    playerCharsDiv.innerHTML = '<h3>Your Characters</h3>';

    if (GAME.players[player]?.characters) {
        GAME.players[player].characters.forEach((char, idx) => {
            const charDiv = document.createElement('div');
            charDiv.className = 'character';
            charDiv.innerHTML = `
                <strong>${char.name}</strong><br>
                Health: ${char.health}<br>
                Card Draw: ${char.cardDraw}<br>
                Stamina: ${char.stamina !== undefined ? char.stamina : 0}/${char.staminaCap !== undefined ? char.staminaCap : 0}
            `;
            charDiv.dataset.char = char;
            charDiv.addEventListener('click', () => {
                targetCharacter(char);
            });
            // if (selectedCharacterIndex && selectedCharacterIndex.side === "player" && selectedCharacterIndex.idx === idx) {
            //     charDiv.style.border = "2px solid green";
            // }
            playerCharsDiv.appendChild(charDiv);
            const attackBtn = document.createElement('button');
            attackBtn.textContent = 'Attack';
            attackBtn.style.marginTop = '5px';
            attackBtn.style.zIndex = '10';
            attackBtn.disabled = canAttack(char) ? false : true;
            attackBtn.onclick = canAttack(char) ? (e) => {
                e.stopPropagation();
                if (typeof cardmap === 'object') {
                    Object.values(cardmap).forEach(cardDiv => {
                        if (cardDiv && cardDiv.style) cardDiv.style.border = '2px solid black';
                    });
                }
                currentcard = -(10 * char.side + char.slot);
                cardmap['' + (-(10 * char.side + char.slot))] = attackBtn;
                attackBtn.style.border = "2px solid green";
                action = charAttackEffect(char);
            } : () => {};
            charDiv.appendChild(document.createElement('br'));
            charDiv.appendChild(attackBtn);
        });
    }

    // Update opponent characters
    const opponentCharsDiv = document.getElementById('opponentCharacters');
    opponentCharsDiv.innerHTML = '<h3>Opponent</h3>';

    if (GAME.players[opponent]?.characters) {
        GAME.players[opponent].characters.forEach((char, idx) => {
            const charDiv = document.createElement('div');
            charDiv.className = 'character';
            charDiv.innerHTML = `
                <strong>${char.name}</strong><br>
                Health: ${char.health}<br>
                Card Draw: ${char.cardDraw}
            `;
            charDiv.dataset.char = char;
            charDiv.addEventListener('click', () => {
                targetCharacter(char);
            });
            // if (selectedCharacterIndex && selectedCharacterIndex.side === "opponent" && selectedCharacterIndex.idx === idx) {
            //     charDiv.style.border = "2px solid green";
            // }
            opponentCharsDiv.appendChild(charDiv);
        });
    }

    // Update hand
    const playerHandDiv = document.getElementById('playerHand');
    playerHandDiv.innerHTML = '';

    if (GAME.players[player]?.cards) {
        GAME.players[player].cards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            cardDiv.style.display = 'flex';
            cardDiv.style.flexDirection = 'row';
            cardDiv.style.alignItems = 'center';
            cardDiv.style.justifyContent = 'center';
            cardDiv.style.border = '2px solid black';
            cardDiv.innerHTML = cardname(card);
            cardDiv.addEventListener('click', () => {
                if (currentcard == card) {
                    cardDiv.style.border = '2px solid black';
                    currentcard = -1;
                    action = (char) => false;
                    return;
                }
                try { cardmap['' + currentcard].style.border = '2px solid black'; } catch { }
                cardDiv.style.border = "2px solid green";
                useCard(card);
            });
            playerHandDiv.appendChild(cardDiv);
            cardmap['' + card] = cardDiv;
        });
        const deleteBtn = document.createElement('div');
        deleteBtn.textContent = 'Delete Card';
        deleteBtn.className = 'card';
        deleteBtn.style.border = '2px solid black';
        deleteBtn.style.backgroundColor = '#ddd';
        deleteBtn.style.textAlign = 'center';
        deleteBtn.style.fontSize = '14px';
        deleteBtn.onclick = function () {
            if (currentcard === -1) return;
            targetCharacter({ id: -1 });
        };
        playerHandDiv.appendChild(deleteBtn);
    }

}

function cardToAction(card) {
    let cardside = 0;
    if (GAME.players.player1.cards.includes(card)) cardside = 1;
    if (GAME.players.player2.cards.includes(card)) cardside = 2;
    if (0 <= card && card < 30) return (char) => {
        action = (char) => false;
        if (cardside == char.side) { char.heal(1); return true; }
        else {
            let q = confirm('Are you sure to heal an enemy?');
            if (q) { char.heal(1); return true; }
            return false;
        }
    }
    if (30 <= card && card < 35) return (char) => {
        action = (char) => false;
        if (cardside == char.side) { char.heal(2); return true; }
        else {
            let q = confirm('Are you sure to heal an enemy?');
            if (q) { char.heal(2); return true; }
            return false;
        }
    }
    if (35 <= card && card < 65) return (char) => {
        action = (char) => false;
        if (cardside == char.side) { char.getstamina(1); return true; }
        else {
            let q = confirm('Are you sure to give stamina to an enemy?');
            if (q) { char.getstamina(1); return true; }
            return false;
        }
    }
    if (65 <= card && card < 70) return (char) => {
        action = (char) => false;
        if (cardside == char.side) { char.getstamina(2); return true; }
        else {
            let q = confirm('Are you sure to give stamina to an enemy?');
            if (q) { char.getstamina(2); return true; }
            return false;
        }
    }
    if (70 <= card && card < 150) return (firstChar) => {
        action = (secondChar) => {
            if (firstChar.side === secondChar.side && firstChar.side !== cardside) {
                alert('You cannot swap both of your opponent\'s characters!');
                return false;
            }

            if (firstChar.side === secondChar.side && firstChar.slot === secondChar.slot) {
                alert('You cannot swap the same character!');
                return false;
            }

            const newFirstChar = {
                ...firstChar, // keep slot-local (health, stamina, equip, mod, etc)
                id: secondChar.id,
                name: secondChar.name,
                alive: secondChar.alive,
                baseHealth: secondChar.baseHealth,
                cardDraw: secondChar.cardDraw,
                staminaCap: secondChar.staminaCap,
                heal: secondChar.heal,
                damage: secondChar.damage,
                getstamina: secondChar.getstamina
            };
            const newSecondChar = {
                ...secondChar,
                id: firstChar.id,
                name: firstChar.name,
                alive: secondChar.alive,
                baseHealth: firstChar.baseHealth,
                cardDraw: firstChar.cardDraw,
                staminaCap: firstChar.staminaCap,
                heal: firstChar.heal,
                damage: firstChar.damage,
                getstamina: firstChar.getstamina
            };

            console.log(firstChar);
            console.log(secondChar);
            console.log(newFirstChar);
            console.log(newSecondChar);

            GAME.players[`player${firstChar.side}`].characters[firstChar.slot] = newFirstChar;
            GAME.players[`player${secondChar.side}`].characters[secondChar.slot] = newSecondChar;

            action = (char) => false;

            return true;
        };
        return null;
    };
    return (char) => false;
}

function cardname(card) {
    if (0 <= card && card < 30) return `❤`;
    if (30 <= card && card < 35) return `❤❤`
    if (35 <= card && card < 65) return `♦`;
    if (65 <= card && card < 70) return `♦♦`;
    if (70 <= card && card < 150) return `🗘`;
    return card;
}

function charAttackEffect(char) {
    let p, s;
    if (currentcard < -1) {
        p = Math.floor(-currentcard / 10);
        s = -currentcard % 10;
    }
    if (char.id === 1 || true) return (targetChar) => {
        if (canAttack(char)) {
            targetChar.damage(1);
            char.stamina = 0;
            return true;
        } else {
            alert('Character cannot attack!');
            return false;
        }
    }
    return (char) => false;
}

function useCard(card) {
    if (GAME.stage !== 'main') return;
    currentcard = card;
    action = cardToAction(card);
    // console.log(action);
}

function targetCharacter(char) {
    let q;
    if (char.id === -1) {
        q = true;
        action = () => false;
    }
    else q = action(char);
    if (q === true) {
        GAME.players.player1.cards = GAME.players.player1.cards.filter(c => c !== currentcard);
        GAME.players.player2.cards = GAME.players.player2.cards.filter(c => c !== currentcard);
        if (currentcard >= 0) GAME.discard.push(currentcard);
    }
    if (q !== null) currentcard = -1;
    set(`GAME = JSON.parse('${JSON.stringify(GAME)}'); restoreGame();`);
    updateGameState();
}

function canAttack(char) {
    if (char.stamina >= char.staminaCap) return true;
    return false;
}