// ============================================
// Vitalis — Turn-Based Battle System (BoF Style)
// ============================================

// --- Battle State ---
let battleActive = false;
let battleEnemy = null;
let battlePhase = 'player-menu';  // player-menu, player-anim, enemy-turn, enemy-anim, victory, defeat
let battleMenuIndex = 0;
let battleMagicMenuOpen = false;
let battleMagicIndex = 0;
let battleItemMenuOpen = false;
let battleItemIndex = 0;
let battleLog = [];
let battleAnimTimer = 0;
let battleAnimType = '';  // 'attack', 'fireball', 'lightning', 'heal', 'enemy-attack', 'victory', 'defeat'
let battlePlayerHP = 0;
let battlePlayerMaxHP = 0;
let battleEnemyHP = 0;
let battleEnemyMaxHP = 0;
let battleShakeTimer = 0;
let battleShakeTarget = ''; // 'player' or 'enemy'
let battleFlashTimer = 0;
let battleFlashTarget = '';
let battleRewards = { xp: 0, coins: 0, items: [] };
let battleDefending = false;

// Menu options
const BATTLE_MENU = ['Attack', 'Magic', 'Item', 'Defend', 'Run'];

// --- Start Battle ---
function startBattle(enemy) {
    if (battleActive) return;
    
    const p = getActivePlayer();
    battleActive = true;
    battleEnemy = enemy;
    battlePhase = 'player-menu';
    battleMenuIndex = 0;
    battleMagicMenuOpen = false;
    battleMagicIndex = 0;
    battleItemMenuOpen = false;
    battleItemIndex = 0;
    battleLog = ['A wild ' + enemy.type.charAt(0).toUpperCase() + enemy.type.slice(1) + ' appears!'];
    battleAnimTimer = 0;
    battleAnimType = '';
    battleDefending = false;
    
    // Snapshot HP
    battlePlayerHP = p.hp;
    battlePlayerMaxHP = p.maxHp;
    battleEnemyHP = enemy.hp;
    battleEnemyMaxHP = enemy.maxHp;
    
    // Pause the overworld
    window._preBattleGameStarted = window.gameStarted;
    
    console.log('[Battle] Started vs ' + enemy.type);
}

// --- End Battle ---
function endBattle() {
    battleActive = false;
    battleEnemy = null;
    battleMagicMenuOpen = false;
    battleItemMenuOpen = false;
    console.log('[Battle] Ended');
}

// --- Get Player Attack Damage ---
function getBattlePlayerAtk() {
    const p = getActivePlayer();
    let weaponAtk = 1;
    if (p.equipment && p.equipment.weapon) {
        const item = (typeof ITEMS !== 'undefined') ? ITEMS.find(i => i.id === p.equipment.weapon || i.name === p.equipment.weapon) : null;
        const baseAtk = item && typeof item.atk === 'number' ? item.atk : 1;
        const bonus = (typeof getEquippedBonus === 'function') ? getEquippedBonus(p, 'weapon') : 0;
        weaponAtk = baseAtk + bonus;
    }
    // Add STR bonus
    weaponAtk += Math.floor((p.stats?.str || 0) / 2);
    return weaponAtk;
}

// --- Get Player Defense ---
function getBattlePlayerDef() {
    const p = getActivePlayer();
    let def = 0;
    if (p.equipment && p.equipment.armor) {
        const item = (typeof ITEMS !== 'undefined') ? ITEMS.find(i => i.id === p.equipment.armor || i.name === p.equipment.armor) : null;
        def += item && typeof item.def === 'number' ? item.def : 1;
    }
    if (p.equipment && p.equipment.shield) {
        const item = (typeof ITEMS !== 'undefined') ? ITEMS.find(i => i.id === p.equipment.shield || i.name === p.equipment.shield) : null;
        def += item && typeof item.def === 'number' ? item.def : 1;
    }
    // Add DEX bonus for dodge-like mitigation
    def += Math.floor((p.stats?.dex || 0) / 3);
    return def;
}

// --- Player Actions ---
function battlePlayerAttack() {
    const atk = getBattlePlayerAtk();
    // Small random variance
    const damage = Math.max(1, atk + Math.floor(Math.random() * 3) - 1);
    battleEnemyHP = Math.max(0, battleEnemyHP - damage);
    battleLog.push('You attack for ' + damage + ' damage!');
    battleAnimType = 'attack';
    battleAnimTimer = 600;
    battleShakeTarget = 'enemy';
    battleShakeTimer = 300;
    battleFlashTarget = 'enemy';
    battleFlashTimer = 200;
    battlePhase = 'player-anim';
    
    if (typeof playSound === 'function') playSound('hit', 0.3);
}

function battlePlayerFireball() {
    const p = getActivePlayer();
    const damage = 4 + Math.floor((p.stats?.int || 0) / 2);
    battleEnemyHP = Math.max(0, battleEnemyHP - damage);
    battleLog.push('Fireball deals ' + damage + ' damage!');
    battleAnimType = 'fireball';
    battleAnimTimer = 800;
    battleShakeTarget = 'enemy';
    battleShakeTimer = 400;
    battleFlashTarget = 'enemy';
    battleFlashTimer = 300;
    battlePhase = 'player-anim';
    battleMagicMenuOpen = false;
}

function battlePlayerLightning() {
    const p = getActivePlayer();
    const damage = 6 + Math.floor((p.stats?.int || 0));
    battleEnemyHP = Math.max(0, battleEnemyHP - damage);
    battleLog.push('Lightning strikes for ' + damage + ' damage!');
    battleAnimType = 'lightning';
    battleAnimTimer = 800;
    battleShakeTarget = 'enemy';
    battleShakeTimer = 500;
    battleFlashTarget = 'enemy';
    battleFlashTimer = 400;
    battlePhase = 'player-anim';
    battleMagicMenuOpen = false;
}

function battlePlayerHeal() {
    const p = getActivePlayer();
    const healAmt = 10 + (p.stats?.int || 0);
    battlePlayerHP = Math.min(battlePlayerMaxHP, battlePlayerHP + healAmt);
    battleLog.push('You heal for ' + healAmt + ' HP!');
    battleAnimType = 'heal';
    battleAnimTimer = 600;
    battlePhase = 'player-anim';
    battleMagicMenuOpen = false;
}

function battlePlayerDefend() {
    battleDefending = true;
    battleLog.push('You brace for the attack!');
    battleAnimTimer = 400;
    battleAnimType = 'defend';
    battlePhase = 'player-anim';
}

function battlePlayerRun() {
    // 50% chance to run, higher with DEX
    const p = getActivePlayer();
    const runChance = 0.5 + (p.stats?.dex || 0) * 0.03;
    if (Math.random() < runChance) {
        battleLog.push('You escaped!');
        battleAnimTimer = 500;
        battleAnimType = 'run';
        battlePhase = 'player-anim';
    } else {
        battleLog.push("Couldn't escape!");
        battleAnimTimer = 500;
        battleAnimType = '';
        battlePhase = 'player-anim';
    }
}

function battleUseItem() {
    const p = getActivePlayer();
    // Find healing items in inventory
    const healItems = [];
    if (p.inventory && typeof ITEMS !== 'undefined') {
        p.inventory.forEach((itemId, idx) => {
            const item = ITEMS.find(i => i.id === itemId || i.name === itemId);
            if (item && (item.type === 'consumable' || item.heal)) {
                healItems.push({ item, idx });
            }
        });
    }
    
    if (healItems.length > 0 && battleItemIndex < healItems.length) {
        const { item, idx } = healItems[battleItemIndex];
        const healAmt = item.heal || 10;
        battlePlayerHP = Math.min(battlePlayerMaxHP, battlePlayerHP + healAmt);
        battleLog.push('Used ' + item.name + '! Healed ' + healAmt + ' HP.');
        p.inventory.splice(idx, 1);
        battleAnimType = 'heal';
        battleAnimTimer = 600;
        battlePhase = 'player-anim';
        battleItemMenuOpen = false;
    } else {
        battleLog.push('No usable items!');
        battleItemMenuOpen = false;
    }
}

// --- Enemy Turn ---
function battleEnemyTurn() {
    battleDefending = false;
    const enemyDmg = battleEnemy.damage || 1;
    const playerDef = getBattlePlayerDef();
    let damage = Math.max(1, enemyDmg + Math.floor(Math.random() * 2) - playerDef);
    
    if (battleDefending) {
        damage = Math.max(1, Math.floor(damage / 2));
        battleLog.push(battleEnemy.type.charAt(0).toUpperCase() + battleEnemy.type.slice(1) + ' attacks! Defended — ' + damage + ' damage.');
    } else {
        battleLog.push(battleEnemy.type.charAt(0).toUpperCase() + battleEnemy.type.slice(1) + ' attacks for ' + damage + ' damage!');
    }
    
    battlePlayerHP = Math.max(0, battlePlayerHP - damage);
    battleAnimType = 'enemy-attack';
    battleAnimTimer = 600;
    battleShakeTarget = 'player';
    battleShakeTimer = 300;
    battleFlashTarget = 'player';
    battleFlashTimer = 200;
    battlePhase = 'enemy-anim';
    
    if (typeof playSound === 'function') playSound('hit', 0.2);
}

// --- Victory / Defeat ---
function battleVictory() {
    const xpReward = battleEnemy.xpReward || 5;
    battleRewards = { xp: xpReward, coins: 0, items: [] };
    
    // Process loot
    if (battleEnemy.lootTable && Array.isArray(battleEnemy.lootTable)) {
        battleEnemy.lootTable.forEach(loot => {
            if (Math.random() < loot.rate) {
                if (loot.type === 'coin') {
                    battleRewards.coins += loot.count || 1;
                } else if (loot.type === 'item') {
                    const item = (typeof ITEMS !== 'undefined') ? ITEMS.find(i => i.id === loot.id) : null;
                    if (item) battleRewards.items.push(item.name);
                }
            }
        });
    } else {
        battleRewards.coins = Math.floor(Math.random() * 3) + 1;
    }
    
    battleLog.push('Victory! +' + xpReward + ' XP' + (battleRewards.coins > 0 ? ', +' + battleRewards.coins + ' coins' : ''));
    if (battleRewards.items.length > 0) {
        battleLog.push('Loot: ' + battleRewards.items.join(', '));
    }
    
    // Apply rewards
    const p = getActivePlayer();
    p.xp += xpReward;
    p.totalXp = (p.totalXp || 0) + xpReward;
    p.coins += battleRewards.coins;
    p.hp = battlePlayerHP; // Sync HP back
    
    battleRewards.items.forEach(itemName => {
        const item = ITEMS.find(i => i.name === itemName);
        if (item) p.inventory.push(item.id || item.name);
    });
    
    // Check level up
    if (typeof checkLevelUp === 'function') checkLevelUp();
    
    // Mark enemy dead in the overworld
    battleEnemy.alive = false;
    
    // Defeat quest progress
    if (typeof quests !== 'undefined') {
        const defeatQuest = quests.find(q => q.type === "defeat" && q.status === "in-progress" && currentArea === q.target);
        if (defeatQuest) {
            defeatQuest.count = (defeatQuest.count || 0) + 1;
            if (typeof tryCompleteQuest === 'function') tryCompleteQuest();
        }
    }
    
    battlePhase = 'victory';
    battleAnimType = 'victory';
    battleAnimTimer = 2000;
}

function battleDefeat() {
    const p = getActivePlayer();
    p.hp = 0;
    battlePhase = 'defeat';
    battleAnimType = 'defeat';
    battleAnimTimer = 2000;
    battleLog.push('You have been defeated...');
}

// --- Update Battle (called every frame) ---
function updateBattle(dt) {
    if (!battleActive) return;
    
    // Decrement timers
    if (battleAnimTimer > 0) {
        battleAnimTimer -= dt;
        if (battleShakeTimer > 0) battleShakeTimer -= dt;
        if (battleFlashTimer > 0) battleFlashTimer -= dt;
        
        if (battleAnimTimer <= 0) {
            battleAnimTimer = 0;
            
            // Transition phases after animation
            if (battlePhase === 'player-anim') {
                if (battleAnimType === 'run') {
                    endBattle();
                    return;
                }
                if (battleEnemyHP <= 0) {
                    battleVictory();
                } else {
                    battlePhase = 'enemy-turn';
                    setTimeout(() => {
                        if (battleActive && battlePhase === 'enemy-turn') {
                            battleEnemyTurn();
                        }
                    }, 400);
                }
            } else if (battlePhase === 'enemy-anim') {
                if (battlePlayerHP <= 0) {
                    battleDefeat();
                } else {
                    battlePhase = 'player-menu';
                    battleMenuIndex = 0;
                    battleMagicMenuOpen = false;
                    battleItemMenuOpen = false;
                }
            } else if (battlePhase === 'victory') {
                if (typeof updateInfoBar === 'function') updateInfoBar();
                endBattle();
            } else if (battlePhase === 'defeat') {
                endBattle();
                if (typeof showGameOverScreen === 'function') showGameOverScreen();
            }
        }
    }
}

// --- Render Battle Screen ---
function renderBattle(ctx) {
    if (!battleActive) return;
    
    const W = canvas.width;
    const H = canvas.height;
    
    // === Background ===
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
    skyGrad.addColorStop(0, '#1a1a3e');
    skyGrad.addColorStop(1, '#2d1b4e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.6);
    
    // Ground
    const groundGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
    groundGrad.addColorStop(0, '#2a4a2a');
    groundGrad.addColorStop(1, '#1a3a1a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    
    // Ground line
    ctx.strokeStyle = '#3a6a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    ctx.lineTo(W, H * 0.55);
    ctx.stroke();
    
    // === Draw Enemy (right side) ===
    const enemyX = W * 0.7;
    const enemyY = H * 0.35;
    let eShakeX = 0, eShakeY = 0;
    
    if (battleShakeTarget === 'enemy' && battleShakeTimer > 0) {
        eShakeX = (Math.random() - 0.5) * 8;
        eShakeY = (Math.random() - 0.5) * 8;
    }
    
    // Flash white when hit
    const enemyFlashing = battleFlashTarget === 'enemy' && battleFlashTimer > 0;
    
    drawBattleEnemy(ctx, enemyX + eShakeX, enemyY + eShakeY, enemyFlashing);
    
    // Enemy HP bar
    drawBattleHPBar(ctx, enemyX - 40, enemyY - 60, 80, 8, battleEnemyHP, battleEnemyMaxHP, '#e44');
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(battleEnemy.type.charAt(0).toUpperCase() + battleEnemy.type.slice(1), enemyX, enemyY - 68);
    
    // === Draw Player (left side) ===
    const playerX = W * 0.25;
    const playerY = H * 0.55;
    let pShakeX = 0, pShakeY = 0;
    
    if (battleShakeTarget === 'player' && battleShakeTimer > 0) {
        pShakeX = (Math.random() - 0.5) * 8;
        pShakeY = (Math.random() - 0.5) * 8;
    }
    
    const playerFlashing = battleFlashTarget === 'player' && battleFlashTimer > 0;
    
    drawBattlePlayer(ctx, playerX + pShakeX, playerY + pShakeY, playerFlashing);
    
    // === Spell Animations ===
    if (battleAnimTimer > 0) {
        drawBattleAnimation(ctx, enemyX, enemyY, playerX, playerY);
    }
    
    // === HUD: Player Stats Box (bottom-right) ===
    const hudX = W * 0.55;
    const hudY = H * 0.7;
    const hudW = W * 0.4;
    const hudH = H * 0.25;
    
    ctx.fillStyle = 'rgba(0, 0, 40, 0.85)';
    ctx.strokeStyle = '#4488cc';
    ctx.lineWidth = 2;
    roundRect(ctx, hudX, hudY, hudW, hudH, 8);
    ctx.fill();
    ctx.stroke();
    
    const p = getActivePlayer();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(p.name || 'Hero', hudX + 12, hudY + 24);
    ctx.font = '14px monospace';
    ctx.fillText('Lv ' + (p.level || 1), hudX + hudW - 60, hudY + 24);
    
    // Player HP bar
    ctx.fillText('HP', hudX + 12, hudY + 48);
    drawBattleHPBar(ctx, hudX + 40, hudY + 38, hudW - 60, 10, battlePlayerHP, battlePlayerMaxHP, '#44cc44');
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(battlePlayerHP + '/' + battlePlayerMaxHP, hudX + hudW - 12, hudY + 48);
    
    // MP placeholder
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText('MP', hudX + 12, hudY + 68);
    drawBattleHPBar(ctx, hudX + 40, hudY + 58, hudW - 60, 10, 20, 20, '#4488ee');
    
    // === Battle Menu (bottom-left) ===
    if (battlePhase === 'player-menu') {
        const menuX = W * 0.03;
        const menuY = H * 0.7;
        const menuW = W * 0.45;
        const menuH = H * 0.25;
        
        ctx.fillStyle = 'rgba(0, 0, 40, 0.85)';
        ctx.strokeStyle = '#4488cc';
        ctx.lineWidth = 2;
        roundRect(ctx, menuX, menuY, menuW, menuH, 8);
        ctx.fill();
        ctx.stroke();
        
        if (battleMagicMenuOpen) {
            // Magic submenu
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('— Magic —', menuX + 12, menuY + 24);
            
            const availableSpells = SKILLS.filter(s => s.unlocked);
            availableSpells.forEach((spell, i) => {
                const isSelected = i === battleMagicIndex;
                ctx.fillStyle = isSelected ? '#ffcc00' : '#ccc';
                ctx.font = (isSelected ? 'bold ' : '') + '15px monospace';
                ctx.fillText((isSelected ? '▶ ' : '  ') + spell.name, menuX + 16, menuY + 48 + i * 24);
            });
            
            ctx.fillStyle = '#888';
            ctx.font = '12px monospace';
            ctx.fillText('ESC: Back', menuX + 12, menuY + menuH - 10);
        } else if (battleItemMenuOpen) {
            // Item submenu
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('— Items —', menuX + 12, menuY + 24);
            
            const healItems = getHealItems();
            if (healItems.length === 0) {
                ctx.fillStyle = '#888';
                ctx.font = '14px monospace';
                ctx.fillText('No usable items', menuX + 16, menuY + 48);
            } else {
                healItems.forEach((h, i) => {
                    const isSelected = i === battleItemIndex;
                    ctx.fillStyle = isSelected ? '#ffcc00' : '#ccc';
                    ctx.font = (isSelected ? 'bold ' : '') + '15px monospace';
                    ctx.fillText((isSelected ? '▶ ' : '  ') + h.item.name, menuX + 16, menuY + 48 + i * 24);
                });
            }
            
            ctx.fillStyle = '#888';
            ctx.font = '12px monospace';
            ctx.fillText('ESC: Back', menuX + 12, menuY + menuH - 10);
        } else {
            // Main battle menu
            BATTLE_MENU.forEach((option, i) => {
                const isSelected = i === battleMenuIndex;
                ctx.fillStyle = isSelected ? '#ffcc00' : '#ccc';
                ctx.font = (isSelected ? 'bold ' : '') + '16px monospace';
                ctx.textAlign = 'left';
                
                // 2-column layout
                const col = i < 3 ? 0 : 1;
                const row = i < 3 ? i : i - 3;
                const x = menuX + 16 + col * (menuW / 2);
                const y = menuY + 30 + row * 28;
                ctx.fillText((isSelected ? '▶ ' : '  ') + option, x, y);
            });
        }
    }
    
    // === Battle Log (top) ===
    const logY = 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, logY, W, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    const lastLog = battleLog[battleLog.length - 1] || '';
    ctx.fillText(lastLog, W / 2, logY + 20);
    
    // === Victory / Defeat Overlay ===
    if (battlePhase === 'victory') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VICTORY!', W / 2, H * 0.35);
        ctx.fillStyle = '#fff';
        ctx.font = '18px monospace';
        ctx.fillText('+' + battleRewards.xp + ' XP  +' + battleRewards.coins + ' Coins', W / 2, H * 0.45);
        if (battleRewards.items.length > 0) {
            ctx.fillText('Loot: ' + battleRewards.items.join(', '), W / 2, H * 0.52);
        }
    }
    
    if (battlePhase === 'defeat') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e44';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DEFEATED', W / 2, H * 0.4);
    }
}

// --- Draw Battle Enemy Sprite ---
function drawBattleEnemy(ctx, x, y, flashing) {
    const type = battleEnemy.type;
    const sizeScale = (typeof ENEMY_TYPES !== 'undefined' && ENEMY_TYPES[type]) ? ENEMY_TYPES[type].sizeScale : 1;
    const size = 64 * sizeScale;
    
    ctx.save();
    
    if (flashing) {
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    }
    
    // Try to use spritesheet
    let spriteUsed = false;
    if (type === 'goblin' && typeof goblinSprite !== 'undefined' && goblinSprite.complete) {
        ctx.drawImage(goblinSprite, 0, 0, 64, 64, x - size, y - size, size * 2, size * 2);
        spriteUsed = true;
    } else if (type === 'orc' && typeof orcSprite !== 'undefined' && orcSprite.complete) {
        ctx.drawImage(orcSprite, 0, 0, 64, 64, x - size, y - size, size * 2, size * 2);
        spriteUsed = true;
    } else if (type === 'troll' && typeof trollSprite !== 'undefined' && trollSprite.complete) {
        ctx.drawImage(trollSprite, 0, 0, 64, 64, x - size, y - size, size * 2, size * 2);
        spriteUsed = true;
    }
    
    if (!spriteUsed) {
        // Fallback: colored shape
        const color = (typeof ENEMY_TYPES !== 'undefined' && ENEMY_TYPES[type]) ? ENEMY_TYPES[type].color : '#e44';
        ctx.fillStyle = flashing ? '#fff' : color;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - size / 4, y - size / 6, size / 8, size / 8);
        ctx.fillRect(x + size / 8, y - size / 6, size / 8, size / 8);
    }
    
    ctx.restore();
}

// --- Draw Battle Player Sprite ---
function drawBattlePlayer(ctx, x, y, flashing) {
    ctx.save();
    
    if (flashing) {
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    }
    
    // Use player spritesheet if available (facing right for battle)
    if (typeof spriteSheet !== 'undefined' && spriteSheet.complete && typeof spriteLoaded !== 'undefined' && spriteLoaded) {
        // Row 2 (right facing), frame 0
        const sx = 0;
        const sy = 128; // Row 2 = right facing
        ctx.drawImage(spriteSheet, sx, sy, 64, 64, x - 48, y - 80, 96, 96);
    } else {
        // Fallback: simple character
        ctx.fillStyle = flashing ? '#fff' : '#4af';
        ctx.fillRect(x - 16, y - 48, 32, 48);
        ctx.fillStyle = '#fdb';
        ctx.beginPath();
        ctx.arc(x, y - 56, 14, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

// --- Draw HP Bar ---
function drawBattleHPBar(ctx, x, y, w, h, current, max, color) {
    const pct = Math.max(0, current / max);
    
    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, w, h);
    
    // Fill
    ctx.fillStyle = pct > 0.5 ? color : (pct > 0.25 ? '#ee8800' : '#cc2222');
    ctx.fillRect(x, y, w * pct, h);
    
    // Border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}

// --- Draw Spell / Attack Animations ---
function drawBattleAnimation(ctx, enemyX, enemyY, playerX, playerY) {
    const progress = 1 - (battleAnimTimer / 800); // 0 to 1
    
    if (battleAnimType === 'fireball') {
        // Fireball flying from player to enemy
        const fx = playerX + (enemyX - playerX) * Math.min(1, progress * 1.5);
        const fy = playerY + (enemyY - playerY) * Math.min(1, progress * 1.5) - Math.sin(progress * Math.PI) * 40;
        
        ctx.save();
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ff6622';
        ctx.beginPath();
        ctx.arc(fx, fy, 12 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Trail particles
        for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = 0.4 - i * 0.1;
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.arc(fx - (enemyX - playerX) * 0.05 * (i + 1), fy + (i + 1) * 5, 6 - i * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        
        // Explosion on impact
        if (progress > 0.65) {
            ctx.save();
            ctx.globalAlpha = (1 - progress) * 2;
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 40;
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(enemyX, enemyY, 30 + progress * 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    } else if (battleAnimType === 'lightning') {
        // Lightning bolt
        if (progress < 0.6) {
            ctx.save();
            ctx.strokeStyle = '#88ccff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#4488ff';
            ctx.shadowBlur = 15;
            
            // Jagged line from top to enemy
            ctx.beginPath();
            let lx = enemyX;
            let ly = 0;
            ctx.moveTo(lx, ly);
            while (ly < enemyY) {
                lx += (Math.random() - 0.5) * 40;
                ly += 20 + Math.random() * 30;
                ctx.lineTo(lx, Math.min(ly, enemyY));
            }
            ctx.stroke();
            
            // Flash
            ctx.fillStyle = 'rgba(150, 200, 255, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
    } else if (battleAnimType === 'heal') {
        // Green sparkles rising around player
        ctx.save();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + progress * Math.PI;
            const radius = 20 + progress * 20;
            const sx = playerX + Math.cos(angle) * radius;
            const sy = playerY - 20 - progress * 40 + Math.sin(angle * 2) * 10;
            ctx.globalAlpha = 1 - progress;
            ctx.fillStyle = '#44ff44';
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    } else if (battleAnimType === 'enemy-attack') {
        // Enemy lunges forward
        if (progress < 0.3) {
            // Quick red slash on player
            ctx.save();
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1 - progress * 3;
            ctx.beginPath();
            ctx.moveTo(playerX - 20, playerY - 30);
            ctx.lineTo(playerX + 20, playerY + 10);
            ctx.moveTo(playerX + 20, playerY - 30);
            ctx.lineTo(playerX - 20, playerY + 10);
            ctx.stroke();
            ctx.restore();
        }
    }
}

// --- Rounded Rectangle Helper ---
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// --- Get Heal Items Helper ---
function getHealItems() {
    const p = getActivePlayer();
    const items = [];
    if (p.inventory && typeof ITEMS !== 'undefined') {
        p.inventory.forEach((itemId, idx) => {
            const item = ITEMS.find(i => i.id === itemId || i.name === itemId);
            if (item && (item.type === 'consumable' || item.heal)) {
                items.push({ item, idx });
            }
        });
    }
    return items;
}

// --- Battle Keyboard Input ---
document.addEventListener('keydown', (e) => {
    if (!battleActive || battlePhase !== 'player-menu') return;
    
    if (battleMagicMenuOpen) {
        const spells = SKILLS.filter(s => s.unlocked);
        if (e.key === 'ArrowUp' || e.key === 'w') {
            battleMagicIndex = Math.max(0, battleMagicIndex - 1);
        } else if (e.key === 'ArrowDown' || e.key === 's') {
            battleMagicIndex = Math.min(spells.length - 1, battleMagicIndex + 1);
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') {
            e.preventDefault();
            const spell = spells[battleMagicIndex];
            if (spell) {
                if (spell.id === 1) battlePlayerFireball();
                else if (spell.id === 2) battlePlayerHeal();
                else if (spell.id === 3) battlePlayerLightning();
            }
        } else if (e.key === 'Escape') {
            battleMagicMenuOpen = false;
        }
        return;
    }
    
    if (battleItemMenuOpen) {
        const items = getHealItems();
        if (e.key === 'ArrowUp' || e.key === 'w') {
            battleItemIndex = Math.max(0, battleItemIndex - 1);
        } else if (e.key === 'ArrowDown' || e.key === 's') {
            battleItemIndex = Math.min(items.length - 1, battleItemIndex + 1);
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') {
            e.preventDefault();
            battleUseItem();
        } else if (e.key === 'Escape') {
            battleItemMenuOpen = false;
        }
        return;
    }
    
    // Main menu navigation
    if (e.key === 'ArrowUp' || e.key === 'w') {
        battleMenuIndex = Math.max(0, battleMenuIndex - 1);
    } else if (e.key === 'ArrowDown' || e.key === 's') {
        battleMenuIndex = Math.min(BATTLE_MENU.length - 1, battleMenuIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        if (battleMenuIndex >= 3) battleMenuIndex -= 3;
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (battleMenuIndex < 3) battleMenuIndex = Math.min(BATTLE_MENU.length - 1, battleMenuIndex + 3);
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') {
        e.preventDefault();
        const action = BATTLE_MENU[battleMenuIndex];
        if (action === 'Attack') battlePlayerAttack();
        else if (action === 'Magic') { battleMagicMenuOpen = true; battleMagicIndex = 0; }
        else if (action === 'Item') { battleItemMenuOpen = true; battleItemIndex = 0; }
        else if (action === 'Defend') battlePlayerDefend();
        else if (action === 'Run') battlePlayerRun();
    }
});

// Block overworld keys during battle
const _originalKeydownHandlers = [];
window.addEventListener('keydown', (e) => {
    if (battleActive) {
        // Block movement keys from reaching the overworld
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' ', 'e', 'f', 'h', 'l'].includes(e.key)) {
            e.stopImmediatePropagation();
        }
    }
}, true); // Use capture phase to intercept first
