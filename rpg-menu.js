// RPG Menu Handler for Vitalis
document.addEventListener('DOMContentLoaded', () => {
    const titleScreen = document.getElementById('titleScreen');
    const gameContainer = document.getElementById('gameContainer');
    const startGameBtn = document.getElementById('startGameBtn');
    const howToPlayBtn = document.getElementById('howToPlayBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const creditsBtn = document.getElementById('creditsBtn');
    
    // Modal panels
    const howToPlayPanel = document.getElementById('howToPlayPanel');
    const settingsPanel = document.getElementById('settingsPanel');
    const creditsPanel = document.getElementById('creditsPanel');
    
    // Close buttons
    const closeHowToPlay = document.getElementById('closeHowToPlay');
    const closeHowToPlayBtn = document.getElementById('closeHowToPlayBtn');
    const closeSettings = document.getElementById('closeSettings');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const closeCredits = document.getElementById('closeCredits');
    const closeCreditsBtn = document.getElementById('closeCreditsBtn');
    
    // Settings controls
    const soundCheckbox = document.getElementById('soundCheckbox');
    const musicCheckbox = document.getElementById('musicCheckbox');
    const effectsCheckbox = document.getElementById('effectsCheckbox');
    const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
    
    // Ensure title screen is visible initially
    function resetMenus() {
        if (titleScreen) titleScreen.classList.add('active');
        if (gameContainer) gameContainer.style.display = 'none';
        window.gameStarted = false;
    }
    
    resetMenus();
    setTimeout(resetMenus, 100);
    
    // Load saved settings
    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('vitalisGameSettings')) || {};
        
        soundCheckbox.checked = settings.sound !== false;
        musicCheckbox.checked = settings.music !== false;
        effectsCheckbox.checked = settings.effects !== false;
        
        const difficulty = settings.difficulty || 'easy';
        const diffRadio = document.querySelector(`input[name="difficulty"][value="${difficulty}"]`);
        if (diffRadio) diffRadio.checked = true;
    }
    
    // Save settings
    function saveSettings() {
        const settings = {
            sound: soundCheckbox.checked,
            music: musicCheckbox.checked,
            effects: effectsCheckbox.checked,
            difficulty: document.querySelector('input[name="difficulty"]:checked')?.value || 'easy'
        };
        localStorage.setItem('vitalisGameSettings', JSON.stringify(settings));
    }
    
    // Menu navigation
    function startGame() {
        console.log('startGame() called');
        window.gameStarted = false;
        titleScreen.classList.remove('active');
        gameContainer.style.display = 'flex';
        gameContainer.style.visibility = 'visible';
        gameContainer.style.opacity = '1';
        gameContainer.style.zIndex = '100';
        closeAllModals();
        
        // Force canvas resize first, then launch intro cutscene
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            // Start the intro cutscene — game begins after it ends
            if (typeof startIntro === 'function') {
                startIntro();
                requestAnimationFrame(introLoop);
            } else {
                // Fallback if intro system not loaded
                launchGameDirectly();
            }
        }, 50);
    }

    // Called by intro.js endIntro() when cutscene finishes
    window.startGameAfterIntro = function() {
        console.log('Intro complete — starting game');
        launchGameDirectly();
    };

    function launchGameDirectly() {
        if (typeof resetGameState === 'function') {
            resetGameState();
            console.log('Game state reset via resetGameState()');
        }
        window.gameStarted = true;
    }
    
    function goBackToMenu() {
        window.gameStarted = false;
        titleScreen.classList.add('active');
        gameContainer.style.display = 'none';
        closeAllModals();
    }
    
    function closeAllModals() {
        [howToPlayPanel, settingsPanel, creditsPanel].forEach(panel => {
            if (panel) panel.classList.remove('active');
        });
    }
    
    // Start game button
    if (startGameBtn) {
        console.log('Start Game button found, adding click listener');
        startGameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Start Game button clicked');
            startGame();
        });
    } else {
        console.error('Start Game button not found!');
        // Try again after a delay
        setTimeout(() => {
            const btn = document.getElementById('startGameBtn');
            if (btn) {
                console.log('Start Game button found on retry');
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Start Game button clicked (retry)');
                    startGame();
                });
            }
        }, 100);
    }
    
    // How to Play
    howToPlayBtn.addEventListener('click', () => {
        howToPlayPanel.classList.add('active');
    });
    
    closeHowToPlay.addEventListener('click', () => {
        howToPlayPanel.classList.remove('active');
    });
    
    closeHowToPlayBtn.addEventListener('click', () => {
        howToPlayPanel.classList.remove('active');
    });
    
    howToPlayPanel.addEventListener('click', (e) => {
        if (e.target === howToPlayPanel) {
            howToPlayPanel.classList.remove('active');
        }
    });
    
    // Settings
    settingsBtn.addEventListener('click', () => {
        loadSettings();
        settingsPanel.classList.add('active');
    });
    
    closeSettings.addEventListener('click', () => {
        settingsPanel.classList.remove('active');
    });
    
    closeSettingsBtn.addEventListener('click', () => {
        saveSettings();
        settingsPanel.classList.remove('active');
    });
    
    settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) {
            saveSettings();
            settingsPanel.classList.remove('active');
        }
    });
    
    // Settings change handlers
    [soundCheckbox, musicCheckbox, effectsCheckbox, ...difficultyRadios].forEach(element => {
        element.addEventListener('change', saveSettings);
    });
    
    // Credits
    creditsBtn.addEventListener('click', () => {
        creditsPanel.classList.add('active');
    });
    
    closeCredits.addEventListener('click', () => {
        creditsPanel.classList.remove('active');
    });
    
    closeCreditsBtn.addEventListener('click', () => {
        creditsPanel.classList.remove('active');
    });
    
    creditsPanel.addEventListener('click', (e) => {
        if (e.target === creditsPanel) {
            creditsPanel.classList.remove('active');
        }
    });
    
    // Close modals with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Any key to start (only on title screen)
    document.addEventListener('keydown', (e) => {
        if (titleScreen.classList.contains('active') && !howToPlayPanel.classList.contains('active') 
            && !settingsPanel.classList.contains('active') && !creditsPanel.classList.contains('active')) {
            if (e.key !== 'Escape') {
                startGame();
            }
        }
    });
    
    // Click title screen to start (but not on buttons or modals)
    titleScreen.addEventListener('click', (e) => {
        // Don't trigger start if clicking on a button or modal panel
        if (e.target.tagName === 'BUTTON' || e.target.closest('.rpg-menu-button')) {
            return;
        }
        if (!howToPlayPanel.classList.contains('active') 
            && !settingsPanel.classList.contains('active') 
            && !creditsPanel.classList.contains('active')) {
            startGame();
        }
    });
    
    // Load initial settings
    loadSettings();
    
    // Make startGame available globally for ESC key handling
    window.goBackToMenu = goBackToMenu;
});
