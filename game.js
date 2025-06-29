class CardGame {
    constructor(host, connection) {
        this.host = host; // 1 = server, 0 = client
        this.connection = connection; // PeerJS connection object
        this.players = {
            player1: this.createPlayer(),
            player2: this.createPlayer()
        };
        
        // Character pool - in a real game this would have more properties
        this.characterPool = [
            { id: 1, name: 'Arghena', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2 },
            { id: 2, name: 'GTD', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2 },
            { id: 3, name: 'Tizago', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2 },
            { id: 4, name: 'Lavender', baseHealth: 6, health: 6, cardDraw: 1, stamina: 0, staminaCap: 2 },
            { id: 5, name: 'MrZ', baseHealth: 6, health: 6, cardDraw: 3, stamina: 0, staminaCap: 2 },
            { id: 6, name: 'TheBestNoob', baseHealth: 6, health: 6, cardDraw: 2, stamina: 0, staminaCap: 2 }
        ];
        
        this.currentPlayer = 'player1';
        this.turnTimer = null;
        this.turnTimeLimit = 60000; // 60 seconds in ms
        this.gameState = 'setup'; // setup, character_selection, playing, gameover
        
        // All cards in the game (1-100)
        this.allCards = Array.from({length: 100}, (_, i) => i + 1);
        // if (host === 1) {
        //     this.syncTimer = setInterval(() => {
        //         this.sendAction({
        //             type: 'state_sync'
        //         }, true); // Include full state
        //     }, 10000); // Sync every 10 seconds
        // }
    }
    
    createPlayer() {
        return {
            characters: [], // Will be populated during character selection
            hand: [],
            cardLimit: 5, // Default card limit, can be modified by effects
            discardPile: [],
            actionsThisTurn: 0,
            availableCharacters: [] // Characters that can be selected for reselection
        };
    }

    drawInitialCards(playerId) {
        const player = this.players[playerId];
        const cards = [];
        const availableCards = [...this.allCards];
        
        // Remove cards already in other player's hand or discard
        const otherPlayerId = playerId === 'player1' ? 'player2' : 'player1';
        const unavailableCards = [
            ...this.players[otherPlayerId].hand,
            ...this.players[otherPlayerId].discardPile
        ];
        
        // Filter out unavailable cards
        const drawPool = availableCards.filter(card => 
            !unavailableCards.includes(card) && 
            !player.discardPile.includes(card)
        );

        this.updateCardLimits();

        // Draw cards equal to the player's card limit
        for (let i = 0; i < player.cardLimit && drawPool.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * drawPool.length);
            cards.push(drawPool.splice(randomIndex, 1)[0]);
        }

        return cards;
    }
    
    // Initialize a new game
    startGame() {
        this.gameState = 'playing';
        
        // Only host distributes initial cards
        if (this.host === 1) {
            this.players.player1.hand = this.drawInitialCards('player1');
            this.players.player2.hand = this.drawInitialCards('player2');
            
            // Sync initial state
            this.sendAction({
                type: 'game_state',
                state: this.getGameState()
            }, true);

            this.setupCharacterSelection();
        }
        
        this.startTurn();
    }
    getGameState() {
        return {
            players: {
                player1: {
                    characters: this.players.player1.characters,
                    handSize: this.players.player1.hand.length,
                    cardLimit: this.players.player1.cardLimit,
                    hand: this.players.player1.hand,
                },
                player2: {
                    characters: this.players.player2.characters,
                    handSize: this.players.player2.hand.length,
                    cardLimit: this.players.player2.cardLimit,
                    hand: this.players.player2.hand,
                }
            },
            currentPlayer: this.currentPlayer
        };
    }
    
    setupCharacterSelection() {
        // Shuffle character pool
        const shuffledPool = [...this.characterPool].sort(() => Math.random() - 0.5);
        
        // Assign 3 available characters to each player (for selection/reselection)
        this.players.player1.availableCharacters = shuffledPool.slice(0, 3);
        this.players.player2.availableCharacters = shuffledPool.slice(3, 6);
        
        // Randomly select initial characters (2 per player)
        this.selectRandomCharacters('player1');
        this.selectRandomCharacters('player2');
    }
    
    selectRandomCharacters(playerId) {
        const player = this.players[playerId];
        
        // Clear current characters
        player.characters = [];
        
        // Select 2 unique characters from available ones
        const available = [...player.availableCharacters];
        for (let i = 0; i < 2 && available.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * available.length);
            player.characters.push(available.splice(randomIndex, 1)[0]);
        }
        
        // Set initial card limit based on characters
        this.updatePlayerCardLimit(playerId);
    }
    
    updatePlayerCardLimit(playerId) {
        const player = this.players[playerId];
        // Card limit is 1 + sum of all characters' cardDraw
        player.cardLimit = 1 + player.characters.reduce((sum, char) => sum + char.cardDraw, 0);
        console.log(playerId + player.cardLimit);
    }
    
    // Handle character selection actions
    handleCharacterSelection(playerId, action, data) {
        if (this.gameState !== 'character_selection') return;
        
        const player = this.players[playerId];
        
        switch (action) {
            case 'swap':
                this.swapCharacters(playerId, data.withPlayer);
                break;
                
            case 'reselect':
                this.reselectCharacter(playerId, data.characterId, data.newCharacterId);
                break;
                
            case 'confirm':
                this.confirmCharacters(playerId);
                break;
                
            default:
                console.warn(`Unknown character selection action: ${action}`);
        }
    }
    
    swapCharacters(playerId, withPlayerId) {
        const player = this.players[playerId];
        const otherPlayer = this.players[withPlayerId];
        
        if (!player || !otherPlayer) {
            console.warn("Invalid player for swap");
            return;
        }
        
        // Swap one random character from each player
        if (player.characters.length > 0 && otherPlayer.characters.length > 0) {
            const playerCharIndex = Math.floor(Math.random() * player.characters.length);
            const otherCharIndex = Math.floor(Math.random() * otherPlayer.characters.length);
            
            const temp = player.characters[playerCharIndex];
            player.characters[playerCharIndex] = otherPlayer.characters[otherCharIndex];
            otherPlayer.characters[otherCharIndex] = temp;
            
            // Update card limits
            this.updatePlayerCardLimit(playerId);
            this.updatePlayerCardLimit(withPlayerId);
            
            // Notify players
            this.sendAction({
                type: 'characters_swapped',
                player1: playerId,
                player2: withPlayerId,
                newCharacters: {
                    [playerId]: this.players[playerId].characters,
                    [withPlayerId]: this.players[withPlayerId].characters
                }
            }, true);
        }
    }
    
    reselectCharacter(playerId, characterId, newCharacterId) {
        const player = this.players[playerId];
        
        // Find the character to replace
        const charIndex = player.characters.findIndex(c => c.id === characterId);
        if (charIndex === -1) {
            console.warn("Character not found for reselection");
            return;
        }
        
        // Find the new character in available pool
        const newChar = player.availableCharacters.find(c => c.id === newCharacterId);
        if (!newChar) {
            console.warn("New character not available");
            return;
        }
        
        // Check if new character is already in use by opponent
        const otherPlayerId = playerId === 'player1' ? 'player2' : 'player1';
        const isUsedByOpponent = this.players[otherPlayerId].characters.some(c => c.id === newCharacterId);
        
        if (isUsedByOpponent) {
            console.warn("Character already in use by opponent");
            return;
        }
        
        // Replace the character
        player.characters[charIndex] = newChar;
        this.updatePlayerCardLimit(playerId);
        
        // Notify players
        this.sendAction({
            type: 'character_reselected',
            player: playerId,
            oldCharacterId: characterId,
            newCharacter: newChar,
            newCardLimit: player.cardLimit
        }, true);
    }
    
    confirmCharacters(playerId) {
        const player = this.players[playerId];
        
        if (player.characters.length !== 2) {
            console.warn("Player doesn't have 2 characters selected");
            return;
        }
        
        player.charactersConfirmed = true;
        
        this.sendAction({
            type: 'characters_confirmed',
            player: playerId
        }, false); // Don't send full state here
        
        // Host checks if both players are ready
        if (this.host === 1 && 
            this.players.player1.charactersConfirmed && 
            this.players.player2.charactersConfirmed) {
            
            // Initialize game state
            this.gameState = 'playing';
            this.players.player1.hand = this.drawInitialCards('player1');
            this.players.player2.hand = this.drawInitialCards('player2');
            
            // Send game start to both players with full state
            const startMessage = {
                type: 'game_start',
                state: this.getGameState()
            };
            this.connection.send(JSON.stringify(startMessage));
            
            // Start first turn
            this.startTurn();
        }
    }
    
    startMainGame() {
        console.log('Main game started!');
        this.gameState = 'playing';
        
        // Only host distributes initial cards
        if (this.host === 1) {
            // Draw cards for both players
            this.players.player1.hand = this.drawInitialCards('player1');
            this.players.player2.hand = this.drawInitialCards('player2');
            
            // Send full game state to both players
            this.sendAction({
                type: 'game_start',
                state: this.getGameState()
            }, true);
            
            // Start first turn
            this.startTurn();
        }
    }
    startTurn() {
        const player = this.players[this.currentPlayer];
        
        // Draw cards up to the card limit
        const cardsToDraw = player.cardLimit - player.hand.length;
        if (cardsToDraw > 0) {
            this.drawCards(this.currentPlayer, cardsToDraw);
        }
    
        // Reset turn-specific states
        player.actionsThisTurn = 0;
        
        // Host manages the timer and notifications
        if (this.host === 1) {
            this.turnTimer = setTimeout(() => {
                this.endTurn();
            }, this.turnTimeLimit);
            
            this.sendAction({
                type: 'turn_start',
                player: this.currentPlayer,
                timeLimit: this.turnTimeLimit
            }, true);
        }
        
        // Enable UI controls for current player
        this.sendAction({
            type: 'enable_turn',
            player: this.currentPlayer
        }, true);
    }

    endTurn() {
        console.log('turn ended!')
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }

        const player = this.players[this.currentPlayer];
        
        // 1. Discard down to card limit
        while (player.hand.length > player.cardLimit) {
            player.discardPile.push(player.hand.pop());
        }
        
        // 2. Switch players
        this.currentPlayer = this.currentPlayer === 'player1' ? 'player2' : 'player1';
        
        // 3. Notify players (host manages this)
        if (this.host === 1) {
            this.sendAction({
                type: 'turn_end',
                nextPlayer: this.currentPlayer
            }, true);
            
            // Start next turn
            this.startTurn();
        }
    }

    drawCards(playerId, count) {
        const player = this.players[playerId];
        const availableCards = [...this.allCards].filter(card => 
            !player.hand.includes(card) && 
            !player.discardPile.includes(card)
        );
        
        const drawn = [];
        for (let i = 0; i < Math.min(count, availableCards.length); i++) {
            const randomIndex = Math.floor(Math.random() * availableCards.length);
            drawn.push(availableCards.splice(randomIndex, 1)[0]);
        }
        
        player.hand.push(...drawn);
        
        // Notify about drawn cards
        if (drawn.length > 0) {
            this.sendAction({
                type: 'cards_drawn',
                player: playerId,
                cards: drawn,
                newHandSize: player.hand.length
            }, true);
        }
        
        return drawn;
    }
    
    // ... [Previous methods like drawInitialCards, startTurn, endTurn remain the same] ...
    
    // Modified parseData to handle character selection actions
    parseData(type, val) {
        // Handle network actions
        if (type === 'game_action') {
            const action = val.action;
            
            // Process attack from opponent
            if (action.type === 'attack' && action.attacker !== this.currentPlayer) {
                if (this.players[action.attacker]?.hand.includes(action.usingCard)) {
                    const defenderId = action.attacker === 'player1' ? 'player2' : 'player1';
                    this.players[defenderId].characters[action.targetCharacter - 1].health -= action.usingCard;
                    this.players[action.attacker].hand = this.players[action.attacker].hand.filter(c => c !== action.usingCard);
                    this.players[action.attacker].discardPile.push(action.usingCard);
                    this.players[action.attacker].characters.forEach(c => c.mods = null);
                    
                    // Check for defeat
                    if (this.players[defenderId].characters[action.targetCharacter - 1].health <= 0) {
                        const alive = this.players[defenderId].characters.filter(c => c.health > 0);
                        if (alive.length === 0) {
                            this.gameState = 'gameover';
                            this.sendAction({ type: 'game_over', winner: action.attacker }, true);
                        }
                    }
                }
                return;
            }
            
            // Process equip from opponent
            if (action.type === 'equip' && action.player !== this.currentPlayer) {
                const player = this.players[action.player];
                if (player?.hand.includes(action.card)) {
                    const char = player.characters[action.characterId - 1];
                    if (action.slotType === 'equipment') {
                        char.equipment.push(action.card);
                    } else if (action.slotType === 'mods') {
                        char.mods = action.card;
                    }
                    player.hand = player.hand.filter(c => c !== action.card);
                }
                return;
            }
            
            // Process card use from opponent
            if (action.type === 'use_card' && action.player !== this.currentPlayer) {
                const player = this.players[action.player];
                if (player?.hand.includes(action.card)) {
                    player.hand = player.hand.filter(c => c !== action.card);
                    player.discardPile.push(action.card);
                }
                return;
            }
            
            // Process character selection updates
            if (action.type === 'character_reselected') {
                const player = this.players[action.player];
                const charIndex = player.characters.findIndex(c => c.id === action.oldCharacterId);
                if (charIndex !== -1) {
                    player.characters[charIndex] = action.newCharacter;
                    player.cardLimit = Math.floor(
                        player.characters.reduce((sum, char) => sum + char.cardDraw, 0) / 
                        player.characters.length
                    );
                }
                return;
            }
            
            // Process turn management
            if (action.type === 'turn_start') {
                this.currentPlayer = action.player;
                const player = this.players[this.currentPlayer];
                
                // Draw cards
                const cardsToDraw = player.cardLimit - player.hand.length;
                if (cardsToDraw > 0) {
                    const availableCards = [...this.allCards].filter(card => 
                        !player.hand.includes(card) && 
                        !player.discardPile.includes(card)
                    );
                    
                    for (let i = 0; i < Math.min(cardsToDraw, availableCards.length); i++) {
                        const randomIndex = Math.floor(Math.random() * availableCards.length);
                        player.hand.push(availableCards.splice(randomIndex, 1)[0]);
                    }
                }
                
                // Reset turn state
                player.actionsThisTurn = 0;
                return;
            }
            
            if (action.type === 'turn_end') {
                const player = this.players[this.currentPlayer];
                while (player.hand.length > player.cardLimit) {
                    player.discardPile.push(player.hand.pop());
                }
                this.currentPlayer = this.currentPlayer === 'player1' ? 'player2' : 'player1';
                return;
            }
            
            if (action.type === 'game_over') {
                this.gameState = 'gameover';
                return;
            }
            
            // Full state sync
            if (action.fullState) {
                this.players.player1 = action.fullState.players.player1;
                this.players.player2 = action.fullState.players.player2;
                this.currentPlayer = action.fullState.currentPlayer;
                this.gameState = action.fullState.gameState;
                return;
            }
            
            console.warn('Unknown network action:', action.type);
            return;
        }
        
        // Handle local actions
        if (this.gameState === 'character_selection') {
            if (type === 'swap') {
                const otherPlayer = val.withPlayer;
                if (this.players[this.currentPlayer]?.characters.length > 0 && 
                    this.players[otherPlayer]?.characters.length > 0) {
                    const p1Index = Math.floor(Math.random() * this.players[this.currentPlayer].characters.length);
                    const p2Index = Math.floor(Math.random() * this.players[otherPlayer].characters.length);
                    
                    const temp = this.players[this.currentPlayer].characters[p1Index];
                    this.players[this.currentPlayer].characters[p1Index] = this.players[otherPlayer].characters[p2Index];
                    this.players[otherPlayer].characters[p2Index] = temp;
                    
                    this.updateCardLimits();
                    this.sendAction({
                        type: 'characters_swapped',
                        player1: this.currentPlayer,
                        player2: otherPlayer,
                        newCharacters: {
                            [this.currentPlayer]: this.players[this.currentPlayer].characters,
                            [otherPlayer]: this.players[otherPlayer].characters
                        }
                    }, true);
                }
                return;
            }
            
            if (type === 'reselect') {
                const player = this.players[this.currentPlayer];
                const charIndex = player.characters.findIndex(c => c.id === val.characterId);
                const newChar = player.availableCharacters.find(c => c.id === val.newCharacterId);
                
                if (charIndex !== -1 && newChar) {
                    player.characters[charIndex] = newChar;
                    player.cardLimit = Math.floor(
                        player.characters.reduce((sum, char) => sum + char.cardDraw, 0) / 
                        player.characters.length
                    );
                    this.sendAction({
                        type: 'character_reselected',
                        player: this.currentPlayer,
                        oldCharacterId: val.characterId,
                        newCharacter: newChar
                    }, true);
                }
                return;
            }
            
            if (type === 'confirm') {
                this.players[this.currentPlayer].charactersConfirmed = true;
                this.sendAction({
                    type: 'characters_confirmed',
                    player: this.currentPlayer,
                    characters: this.players[this.currentPlayer].characters
                }, true);
                return;
            }
        }
        
        // Handle game actions
        if (type === 'attack') {
            const player = this.players[this.currentPlayer];
            if (player?.hand.includes(val.usingCard)) {
                const defenderId = this.currentPlayer === 'player1' ? 'player2' : 'player1';
                this.players[defenderId].characters[val.targetCharacter - 1].health -= val.usingCard;
                player.hand = player.hand.filter(c => c !== val.usingCard);
                player.discardPile.push(val.usingCard);
                player.characters.forEach(c => c.mods = null);
                
                this.sendAction({
                    type: 'attack',
                    attacker: this.currentPlayer,
                    targetCharacter: val.targetCharacter,
                    usingCard: val.usingCard
                }, true);
                
                // Check defeat
                if (this.players[defenderId].characters[val.targetCharacter - 1].health <= 0) {
                    const alive = this.players[defenderId].characters.filter(c => c.health > 0);
                    if (alive.length === 0) {
                        this.gameState = 'gameover';
                        this.sendAction({ type: 'game_over', winner: this.currentPlayer }, true);
                    }
                }
            }
            return;
        }
        
        if (type === 'equip') {
            const player = this.players[this.currentPlayer];
            if (player?.hand.includes(val.card)) {
                const char = player.characters[val.characterId - 1];
                if (val.slotType === 'equipment') {
                    char.equipment.push(val.card);
                } else if (val.slotType === 'mods') {
                    char.mods = val.card;
                }
                player.hand = player.hand.filter(c => c !== val.card);
                
                this.sendAction({
                    type: 'equip',
                    player: this.currentPlayer,
                    characterId: val.characterId,
                    card: val.card,
                    slotType: val.slotType
                }, true);
            }
            return;
        }
        
        if (type === 'use_card') {
            const player = this.players[this.currentPlayer];
            if (player?.hand.includes(val.card)) {
                player.hand = player.hand.filter(c => c !== val.card);
                player.discardPile.push(val.card);
                
                // Handle special cards
                if (this.specialCards.health.includes(val.card)) {
                    player.characters[0].health += 1; // Default to first character
                } else if (this.specialCards.stamina.includes(val.card)) {
                    const char = player.characters[0]; // Default to first character
                    char.stamina = Math.min(char.stamina + 1, char.staminaCap);
                }
                
                this.sendAction({
                    type: 'use_card',
                    player: this.currentPlayer,
                    card: val.card,
                    target: val.target || { characterId: 1 } // Default target
                }, true);
            }
            return;
        }
        
        if (type === 'end_turn' && this.host === 1) {
            const player = this.players[this.currentPlayer];
            while (player.hand.length > player.cardLimit) {
                player.discardPile.push(player.hand.pop());
            }
            this.currentPlayer = this.currentPlayer === 'player1' ? 'player2' : 'player1';
            
            this.sendAction({
                type: 'turn_end',
                nextPlayer: this.currentPlayer
            }, true);
            
            // Start next turn
            this.currentPlayer = this.currentPlayer;
            const nextPlayer = this.players[this.currentPlayer];
            const cardsToDraw = nextPlayer.cardLimit - nextPlayer.hand.length;
            if (cardsToDraw > 0) {
                const availableCards = [...this.allCards].filter(card => 
                    !nextPlayer.hand.includes(card) && 
                    !nextPlayer.discardPile.includes(card)
                );
                
                for (let i = 0; i < Math.min(cardsToDraw, availableCards.length); i++) {
                    const randomIndex = Math.floor(Math.random() * availableCards.length);
                    nextPlayer.hand.push(availableCards.splice(randomIndex, 1)[0]);
                }
            }
            nextPlayer.actionsThisTurn = 0;
            
            this.sendAction({
                type: 'turn_start',
                player: this.currentPlayer,
                timeLimit: this.turnTimeLimit
            }, true);
            return;
        }
        
        console.warn(`Unknown action type: ${type}`);
    }
    
    // Helper function (still inside class)
    updateCardLimits() {
        for (const playerId of ['player1', 'player2']) this.updatePlayerCardLimit(playerId)
    }
    processAction(action) {
        // Only process actions that affect our game state
        const currentPlayerId = this.currentPlayer;
        
        switch (action.type) {
            case 'attack':
                if (action.attacker === currentPlayerId) return; // We already processed this
                this.handleAttack(action.attacker, action.targetCharacter, action.usingCard);
                break;
                
            case 'equip':
                if (action.player === currentPlayerId) return;
                this.handleEquip(action.player, action.characterId, action.card, action.slotType);
                break;
                
            // ... [handle other action types similarly] ...
                
            case 'turn_start':
                this.currentPlayer = action.player;
                this.startTurn();
                break;
                
            case 'turn_end':
                this.currentPlayer = action.nextPlayer;
                this.startTurn();
                break;
                
            case 'game_over':
                this.gameState = 'gameover';
                console.log(`Game over! Winner: ${action.winner}`);
                break;
        }
    }
    handleAttack(attackerId, targetCharacter, usingCard) {
        // Validate attack
        const attacker = this.players[attackerId];
        const defenderId = attackerId === 'player1' ? 'player2' : 'player1';
        const defender = this.players[defenderId];
        
        if (!attacker.hand.includes(usingCard)) {
            console.warn("Player doesn't have this card");
            return;
        }
        
        if (targetCharacter < 1 || targetCharacter > 2) {
            console.warn("Invalid target character");
            return;
        }
        
        // Perform attack
        const damage = usingCard; // For simplicity, card value = damage
        defender.characters[targetCharacter - 1].health -= damage;
        
        // Clear mods slot after attack
        attacker.characters.forEach(char => {
            char.mods = null;
        });
        
        // Remove card from hand
        attacker.hand = attacker.hand.filter(card => card !== usingCard);
        attacker.discardPile.push(usingCard);
        
        // Notify players
        this.sendAction({
            type: 'attack',
            attacker: attackerId,
            target: defenderId,
            targetCharacter,
            damage,
            cardUsed: usingCard
        }, true);
        
        // Check for character defeat
        this.checkCharacterDefeat(defenderId, targetCharacter);
    }
    
    handleEquip(playerId, characterId, card, slotType) {
        const player = this.players[playerId];
        
        if (!player.hand.includes(card)) {
            console.warn("Player doesn't have this card");
            return;
        }
        
        if (characterId < 1 || characterId > 2) {
            console.warn("Invalid character ID");
            return;
        }
        
        const character = player.characters[characterId - 1];
        
        if (slotType === 'equipment') {
            character.equipment.push(card);
        } else if (slotType === 'mods') {
            character.mods = card;
        } else {
            console.warn("Invalid slot type");
            return;
        }
        
        // Remove card from hand (but don't discard - equipment stays)
        player.hand = player.hand.filter(c => c !== card);
        
        // Notify players
        this.sendAction({
            type: 'equip',
            player: playerId,
            characterId,
            card,
            slotType
        }, true);
    }
    
    handleUseCard(playerId, card, target) {
        const player = this.players[playerId];
        
        if (!player.hand.includes(card)) {
            console.warn("Player doesn't have this card");
            return;
        }
        
        // In a real game, this would have card effects
        // For now, just discard the card
        player.hand = player.hand.filter(c => c !== card);
        player.discardPile.push(card);
        
        // Notify players
        this.sendAction({
            type: 'card_used',
            player: playerId,
            card,
            target
        }, true);
    }
    
    checkCharacterDefeat(playerId, characterId) {
        const player = this.players[playerId];
        const character = player.characters[characterId - 1];
        
        if (character.health <= 0) {
            // Character defeated
            this.sendAction({
                type: 'character_defeated',
                player: playerId,
                characterId
            }, true);
            
            // Check if player has any characters left
            const aliveCharacters = player.characters.filter(c => c.health > 0);
            if (aliveCharacters.length === 0) {
                this.endGame(playerId === 'player1' ? 'player2' : 'player1');
            }
        }
    }
    
    endGame(winner) {
        this.gameState = 'gameover';
        
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
        
        this.sendAction({
            type: 'game_over',
            winner
        }, true);
    }

    getFullState() {
        return {
            players: {
                player1: JSON.parse(JSON.stringify(this.players.player1)),
                player2: JSON.parse(JSON.stringify(this.players.player2))
            },
            currentPlayer: this.currentPlayer,
            gameState: this.gameState,
            turnTimer: this.turnTimer,
            turnTimeLimit: this.turnTimeLimit,
            characterPool: this.characterPool,
            allCards: this.allCards
        };
    }

    // Add this method to restore from full state
    restoreFromState(state) {
        console.log('restoring data...')
        this.players.player1 = state.players.player1;
        this.players.player2 = state.players.player2;
        this.currentPlayer = state.currentPlayer;
        this.gameState = state.gameState;
        this.turnTimer = state.turnTimer;
        this.turnTimeLimit = state.turnTimeLimit;
    }

    // Modify sendAction to include full state when needed
    sendAction(action, includeState = false) {
        // Don't send if we're not the host (except for certain actions)
        if (this.host !== 1 && !['confirm', 'reselect', 'swap'].includes(action.type)) {
            return;
        }
    
        const message = {
            type: 'game_action',
            action: action
        };
        
        if (includeState) {
            message.fullState = this.getFullState();
        }
        
        if (this.connection && this.connection.open) {
            console.log("Sending:", message.type, message.action.type);
            this.connection.send(JSON.stringify(message));
        }
    }
}