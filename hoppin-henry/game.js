const cowboy = document.getElementById('cowboy');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const levelDisplay = document.getElementById('level');
const gameOverDisplay = document.getElementById('gameOver');
const winScreen = document.getElementById('winScreen');
const continueOption = document.getElementById('continueOption');
const regularRestart = document.getElementById('regularRestart');
const continueLevelDisplay = document.getElementById('continueLevel');
const mainMenu = document.getElementById('start-menu');
const startButton = document.getElementById('startButton');
const bestScoreDisplay = document.getElementById('bestScore');
const highestLevelDisplay = document.getElementById('highestLevel');
const gameContainer = document.querySelector('.game-container');
const cloudsContainer = document.getElementById('clouds-container');
const staminaPoints = document.querySelectorAll('.stamina-point');
const badgeSlots = document.querySelectorAll('.badge-slot');

let isJumping = false;
let isDoubleJumping = false;
let jumpAnimationFrame = null;
let position = 50;
let score = 0;
let baseScore = 0;
let level = 1;
let currentLevelTallCacti = 0;
let highScore = parseInt(localStorage.getItem('highScore')) || 0;
let highestLevel = parseInt(localStorage.getItem('highestLevel')) || 1;
let lastCheckpoint = parseInt(localStorage.getItem('lastCheckpoint')) || 0;
let isGameOver = false;
let isSpaceBarDown = false;
let canJump = true;
let canDoubleJump = false;
let cacti = [];
let clouds = [];
let chickens = [];
let gameLoop = null;
let cloudLoop = null;
let stamina = 6;
let lastChickenSpawn = 0;
let gameStarted = false;
let sheriffBadges = 0;
let activeBadge = false;
let cactusSpawnPaused = false;

function addBadge() {
    const nextEmptySlot = Array.from(badgeSlots).find(slot => 
        !slot.classList.contains('earned') && 
        !slot.classList.contains('used')
    );
    
    if (nextEmptySlot) {
        nextEmptySlot.classList.add('earned');
        sheriffBadges++;
        
        // Make the first badge active
        if (sheriffBadges === 1) {
            nextEmptySlot.classList.add('active');
            activeBadge = true;
        }
    }
}

function useBadge() {
    if (sheriffBadges > 0) {
        const activeBadgeElement = document.querySelector('.badge-slot.active');
        
        if (activeBadgeElement) {
            activeBadgeElement.classList.remove('active');
            activeBadgeElement.classList.add('used');
            
            sheriffBadges--;
            activeBadge = false;
            
            // Activate next badge if available
            if (sheriffBadges > 0) {
                const nextBadge = Array.from(badgeSlots).find(slot => 
                    slot.classList.contains('earned') && 
                    !slot.classList.contains('used')
                );
                if (nextBadge) {
                    nextBadge.classList.add('active');
                    activeBadge = true;
                }
            }
            return true;
        }
    }
    return false;
}

function checkCollision(element) {
    const cowboyRect = cowboy.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // More forgiving collision detection for tall cacti
    const isTallCactus = element.classList.contains('tall');
    const horizontalBuffer = isTallCactus ? 12 : 10;
    const verticalBuffer = isTallCactus ? 10 : 8;
    
    return !(
        cowboyRect.right - horizontalBuffer < elementRect.left || 
        cowboyRect.left + horizontalBuffer > elementRect.right || 
        cowboyRect.bottom - verticalBuffer < elementRect.top || 
        cowboyRect.top + verticalBuffer > elementRect.bottom
    );
}

function checkLevelProgress() {
    const oldLevel = level;
    level = Math.min(Math.floor(baseScore / 10) + 1, 100);
    
    if (level !== oldLevel) {
        levelDisplay.textContent = `Level: ${level}/100`;
        
        // Update highest level if needed
        if (level > highestLevel) {
            highestLevel = level;
            localStorage.setItem('highestLevel', highestLevel);
            highestLevelDisplay.textContent = highestLevel;
        }
        
        // Reset tall cactus counter for new level
        currentLevelTallCacti = 0;
        
        // Spawn chicken at start of each non-challenge level
        if (level % 10 !== 0 && level !== oldLevel) {
            createChicken();
        }
        
        // Visual feedback for challenge levels and set checkpoint after completing one
        if (level % 10 === 0 && level < 100) {
            // Entering challenge level
            levelDisplay.style.color = '#ff4d4d';
            levelDisplay.style.fontSize = '24px';
            setTimeout(() => {
                levelDisplay.style.color = '';
                levelDisplay.style.fontSize = '';
            }, 1000);
        } else if (oldLevel % 10 === 0 && level % 10 === 1) {
            // Just completed a challenge level
            lastCheckpoint = oldLevel;
            localStorage.setItem('lastCheckpoint', lastCheckpoint);
            
            // Pause cactus spawning
            cactusSpawnPaused = true;
            
            // Create and animate badge pickup
            const lastCactusPos = cacti.length > 0 ? cacti[cacti.length - 1].position : window.innerWidth / 2;
            const badge = document.createElement('div');
            badge.className = 'badge-pickup';
            badge.style.left = `${lastCactusPos + window.innerWidth/2}px`;
            badge.style.top = '50%';
            gameContainer.appendChild(badge);
            
            // Remove badge element after animation and resume cactus spawning
            setTimeout(() => {
                badge.remove();
                addBadge();
                cactusSpawnPaused = false;
                createCactus(); // Start spawning cacti again
            }, 1500);
        }
        
        // Check for win condition
        if (level === 100) {
            winGame();
        }
    }
}

function resetGame(continueFromCheckpoint = false) {
    if (!gameStarted) return;
    
    isGameOver = false;
    isJumping = false;
    isDoubleJumping = false;
    canJump = true;
    canDoubleJump = false;
    position = 50;
    currentLevelTallCacti = 0;
    cactusSpawnPaused = false;
    
    // Clear badges
    badgeSlots.forEach(slot => {
        slot.classList.remove('earned', 'active', 'used');
    });
    sheriffBadges = 0;
    activeBadge = false;
    
    if (continueFromCheckpoint && lastCheckpoint > 0) {
        // Continue from the last checkpoint
        level = lastCheckpoint + 1;
        score = (level - 1) * 10;
        baseScore = score;
        
        // Restore badges based on completed challenge levels
        const completedChallenges = Math.floor(lastCheckpoint / 10);
        for (let i = 0; i < completedChallenges; i++) {
            addBadge();
        }
    } else {
        // Full restart
        level = 1;
        score = 0;
        baseScore = 0;
        lastCheckpoint = 0;
        localStorage.setItem('lastCheckpoint', 0);
    }
    
    stamina = 6;
    lastChickenSpawn = baseScore;
    scoreDisplay.textContent = `Score: ${score}`;
    levelDisplay.textContent = `Level: ${level}/100`;
    gameOverDisplay.style.display = 'none';
    winScreen.style.display = 'none';
    cowboy.style.transform = 'translateY(0)';
    updateStaminaDisplay();
    
    // Remove all existing cacti
    cacti.forEach(cactus => gameContainer.removeChild(cactus.element));
    cacti = [];
    
    // Remove all existing chickens
    chickens.forEach(chicken => chicken.element.remove());
    chickens = [];
    
    // Restart the game loop and cactus spawning
    updateGame();
    createCactus();
}

function updateStats() {
    highScoreDisplay.textContent = `High Score: ${highScore}`;
    bestScoreDisplay.textContent = highScore;
    highestLevelDisplay.textContent = highestLevel;
    levelDisplay.textContent = `Level: ${level}/100`;
    updateStaminaDisplay();
}

function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        updateStats();
    }
}

function gameOver() {
    if (level === 100) return; // Don't show game over if player has won
    
    isGameOver = true;
    gameOverDisplay.style.display = 'block';
    
    // Show continue option if player has beaten a challenge level
    if (lastCheckpoint > 0) {
        continueOption.style.display = 'block';
        regularRestart.style.display = 'none';
        document.getElementById('continueLevel').textContent = lastCheckpoint + 1;
        document.getElementById('continueLevelKey').textContent = lastCheckpoint + 1;
    } else {
        continueOption.style.display = 'none';
        regularRestart.style.display = 'block';
    }
    
    if (jumpAnimationFrame) {
        cancelAnimationFrame(jumpAnimationFrame);
        jumpAnimationFrame = null;
    }
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    updateHighScore();
}

function getDifficultySettings() {
    // Check if it's a challenge level (every 10th level)
    const isChallenge = level % 10 === 0;
    
    // Base difficulty increases with level
    const baseSpeed = 3 + (level * 0.2);
    const baseSpawnDelay = 2000 - (level * 15);
    
    // Challenge levels are significantly harder
    if (isChallenge) {
        return {
            minSpeed: baseSpeed * 1.5,
            maxSpeed: baseSpeed * 1.8,
            minDelay: baseSpawnDelay * 0.6,
            maxDelay: baseSpawnDelay * 0.8
        };
    }
    
    // Normal level difficulty
    return {
        minSpeed: baseSpeed,
        maxSpeed: baseSpeed * 1.3,
        minDelay: baseSpawnDelay,
        maxDelay: baseSpawnDelay * 1.2
    };
}

function updateStaminaDisplay() {
    staminaPoints.forEach((point, index) => {
        if (index < stamina) {
            point.classList.remove('empty');
        } else {
            point.classList.add('empty');
        }
    });
}

function createChicken() {
    const chicken = document.createElement('div');
    chicken.className = 'chicken';
    
    const position = window.innerWidth;
    chicken.style.left = `${position}px`;
    
    gameContainer.appendChild(chicken);
    
    const speed = 3;
    chickens.push({
        element: chicken,
        position: position,
        speed: speed,
        collected: false
    });
}

function jump() {
    if (isGameOver) {
        return;
    }

    if (!isSpaceBarDown) {
        return;
    }

    if (!isJumping && canJump) {
        isJumping = true;
        canJump = false;
        startJumpAnimation();
    } else if (isJumping && !isDoubleJumping && canDoubleJump && !canJump) {
        isDoubleJumping = true;
        canDoubleJump = false;
        // Only consume stamina if the game has actually started
        if (gameStarted && stamina > 0) {
            stamina--;
            updateStaminaDisplay();
        }
        startDoubleJumpAnimation();
    }
}

function startJumpAnimation() {
    let jumpStartTime = null;
    const jumpDuration = 600; // 600ms for full jump
    const maxHeight = 75;

    function animate(timestamp) {
        if (isGameOver) return;
        
        if (!jumpStartTime) jumpStartTime = timestamp;
        const elapsed = timestamp - jumpStartTime;
        
        if (elapsed < jumpDuration && !isDoubleJumping) {
            const progress = elapsed / jumpDuration;
            const height = maxHeight * Math.sin(progress * Math.PI);
            position = height; // Track current height
            cowboy.style.transform = `translateY(${-height}px)`;
            jumpAnimationFrame = requestAnimationFrame(animate);
        } else if (!isDoubleJumping) {
            // Animation complete
            cowboy.style.transform = 'translateY(0)';
            position = 0;
            isJumping = false;
            if (!isSpaceBarDown) {
                canJump = true;
            }
            jumpAnimationFrame = null;
        }
    }

    if (jumpAnimationFrame) {
        cancelAnimationFrame(jumpAnimationFrame);
    }
    jumpAnimationFrame = requestAnimationFrame(animate);
}

function startDoubleJumpAnimation() {
    let jumpStartTime = null;
    const jumpDuration = 700; // 700ms for double jump
    const maxHeight = 100; // Higher than regular jump
    const startHeight = position; // Use tracked position

    function animate(timestamp) {
        if (isGameOver) return;
        
        if (!jumpStartTime) jumpStartTime = timestamp;
        const elapsed = timestamp - jumpStartTime;
        
        if (elapsed < jumpDuration) {
            const progress = elapsed / jumpDuration;
            let height;
            
            if (progress < 0.3) {
                // Quick rise from current height to max
                const riseProgress = progress / 0.3;
                height = startHeight + (maxHeight - startHeight) * riseProgress;
            } else if (progress < 0.6) {
                // Float at max height
                height = maxHeight;
            } else {
                // Fall
                const fallProgress = (progress - 0.6) / 0.4;
                height = maxHeight * (1 - fallProgress);
            }
            
            position = height; // Track current height
            cowboy.style.transform = `translateY(${-height}px)`;
            jumpAnimationFrame = requestAnimationFrame(animate);
        } else {
            // Animation complete
            cowboy.style.transform = 'translateY(0)';
            position = 0;
            isJumping = false;
            isDoubleJumping = false;
            if (!isSpaceBarDown) {
                canJump = true;
            }
            jumpAnimationFrame = null;
        }
    }

    if (jumpAnimationFrame) {
        cancelAnimationFrame(jumpAnimationFrame);
    }
    jumpAnimationFrame = requestAnimationFrame(animate);
}

function updateGame(timestamp) {
    if (isGameOver || !gameStarted) return;
    
    const cowboyPos = window.innerWidth / 2;
    
    // Update cacti
    for (let i = cacti.length - 1; i >= 0; i--) {
        const cactus = cacti[i];
        cactus.position -= cactus.speed;
        cactus.element.style.transform = `translateX(${cactus.position}px)`;
        
        // Remove cacti that are off screen
        if (cactus.position < -50) {
            gameContainer.removeChild(cactus.element);
            cacti.splice(i, 1);
            continue;
        }
        
        // Update score when passing a cactus
        if (cactus.position < cowboyPos && !cactus.passed) {
            cactus.passed = true;
            score++;
            baseScore = score;
            scoreDisplay.textContent = `Score: ${score}`;
            updateHighScore();
            checkLevelProgress();
        }
        
        // Check for collision
        if (Math.abs(cactus.position - cowboyPos) < 25 && checkCollision(cactus.element)) {
            if (!activeBadge || !useBadge()) {
                gameOver();
                return;
            }
            // If badge was used successfully, remove the cactus that was hit
            gameContainer.removeChild(cactus.element);
            cacti.splice(i, 1);
        }
    }
    
    // Update chickens
    for (let i = chickens.length - 1; i >= 0; i--) {
        const chicken = chickens[i];
        if (!chicken.collected) {
            chicken.position -= chicken.speed;
            chicken.element.style.left = `${chicken.position}px`;
            
            // Check for collision with chicken using a more generous hitbox
            if (Math.abs(chicken.position - cowboyPos) < 40 && checkCollision(chicken.element)) {
                chicken.collected = true;
                chicken.element.style.setProperty('--start-x', `${chicken.position}px`);
                chicken.element.classList.add('collected');
                
                // Calculate stamina restoration and bonus points
                const maxStamina = 6;
                const staminaToRestore = 3;
                const spaceForStamina = maxStamina - stamina;  // How much more stamina we can hold
                const staminaGained = Math.min(staminaToRestore, spaceForStamina);  // How much we'll actually get
                const bonusPoints = staminaToRestore - staminaGained;  // Leftover becomes points
                
                // Restore stamina
                stamina += staminaGained;
                updateStaminaDisplay();
                
                // Award points for unused restoration
                if (bonusPoints > 0) {
                    score += bonusPoints;
                    baseScore += bonusPoints;
                    scoreDisplay.textContent = `Score: ${score}`;
                    updateHighScore();
                    checkLevelProgress();
                }
                
                setTimeout(() => {
                    chicken.element.remove();
                    chickens.splice(i, 1);
                }, 500);
            }
        }
        
        // Remove chickens that are off screen
        if (chicken.position < -50 && !chicken.collected) {
            chicken.element.remove();
            chickens.splice(i, 1);
        }
    }
    
    // Continue the game loop
    gameLoop = requestAnimationFrame(updateGame);
}

function createCactus() {
    if (isGameOver || !gameStarted || cactusSpawnPaused) return;
    
    const difficulty = getDifficultySettings();
    
    // Create cactus element
    const cactus = document.createElement('div');
    
    // Only allow tall cactus if we haven't reached the limit
    const maxTallCactiPerLevel = 6;
    const canSpawnTall = currentLevelTallCacti < maxTallCactiPerLevel;
    
    // Chance of tall cactus (higher in challenge levels), only if we haven't reached the limit
    const tallCactusChance = canSpawnTall ? (level % 10 === 0 ? 0.15 : 0.10) : 0;
    const isTallCactus = Math.random() < tallCactusChance;
    
    if (isTallCactus) {
        cactus.classList.add('tall');
        currentLevelTallCacti++;
    }
    
    cactus.className = `cactus${isTallCactus ? ' tall' : ''}`;
    
    // Make challenge level cacti red-tinted
    if (level % 10 === 0) {
        cactus.style.filter = 'sepia(100%) hue-rotate(300deg) saturate(3)';
    }
    
    // Calculate speed based on difficulty
    const speed = difficulty.minSpeed + (Math.random() * (difficulty.maxSpeed - difficulty.minSpeed));
    
    // Set initial position
    const position = window.innerWidth;
    cactus.style.transform = `translateX(${position}px)`;
    
    // Add to game container
    gameContainer.appendChild(cactus);
    
    // Add to cacti array
    cacti.push({
        element: cactus,
        position: position,
        speed: speed,
        passed: false
    });

    // Schedule next cactus with increased delay after tall cactus
    const baseDelay = difficulty.minDelay + (Math.random() * (difficulty.maxDelay - difficulty.minDelay));
    const delay = isTallCactus ? baseDelay * 1.5 : baseDelay; // 50% longer delay after tall cactus
    setTimeout(createCactus, delay);
}

function createCloud(isInitial = false) {
    const cloud = document.createElement('div');
    cloud.className = `cloud ${['small', 'medium', 'large'][Math.floor(Math.random() * 3)]}`;
    
    // Find a suitable vertical position that's not too close to other clouds
    let top;
    let attempts = 0;
    do {
        top = Math.random() * 150;
        // Check distance from other clouds
        const isTooClose = clouds.some(existingCloud => {
            const existingTop = parseFloat(existingCloud.element.style.top);
            return Math.abs(existingTop - top) < 30;
        });
        if (!isTooClose || attempts > 5) break;
        attempts++;
    } while (true);

    const speed = 0.3 + Math.random() * 0.4;
    
    // Only spawn mid-screen during initialization
    const startX = isInitial ? 
        Math.random() * window.innerWidth : // Initial spread
        window.innerWidth + (Math.random() * 100); // New clouds start off-screen
    
    cloud.style.transform = `translateX(${startX}px)`;
    cloud.style.top = `${top}px`;
    
    cloudsContainer.appendChild(cloud);
    
    clouds.push({
        element: cloud,
        position: startX,
        speed: speed
    });
}

function updateClouds() {
    // Update existing clouds
    for (let i = clouds.length - 1; i >= 0; i--) {
        const cloud = clouds[i];
        cloud.position -= cloud.speed;
        cloud.element.style.transform = `translateX(${cloud.position}px)`;
        
        // Remove if off screen
        if (cloud.position < -150) {
            cloudsContainer.removeChild(cloud.element);
            clouds.splice(i, 1);
        }
    }
    
    // Create new cloud if needed
    if (clouds.length < 8 && Math.random() < 0.02) {
        createCloud(false); // New clouds are not initial
    }
    
    cloudLoop = requestAnimationFrame(updateClouds);
}

function winGame() {
    isGameOver = true;
    winScreen.style.display = 'block';
    
    if (jumpAnimationFrame) {
        cancelAnimationFrame(jumpAnimationFrame);
        jumpAnimationFrame = null;
    }
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    updateHighScore();
}

function createInitialClouds() {
    for (let i = 0; i < 8; i++) {
        createCloud(true); // Initial clouds can spawn mid-screen
    }
    updateClouds();
}

// Initialize displays
updateStats();

// Start menu button handler
startButton.addEventListener('click', () => {
    startGame();
});

// Game over button handlers
document.getElementById('continueOption').addEventListener('click', () => resetGame(true));
document.getElementById('regularRestart').addEventListener('click', () => resetGame(false));

function startGame() {
    if (gameStarted) return;
    
    mainMenu.style.display = 'none';
    gameOverDisplay.style.display = 'none';
    winScreen.style.display = 'none';
    document.querySelector('.hud').classList.remove('hidden');
    
    gameStarted = true;
    isGameOver = false;
    level = 1;
    score = 0;
    baseScore = 0;
    stamina = 6;
    updateStaminaDisplay();
    
    // Clear any existing cacti and chickens
    cacti.forEach(cactus => cactus.element.remove());
    cacti = [];
    chickens.forEach(chicken => chicken.element.remove());
    chickens = [];
    
    // Start game loops
    updateGame();
    createCactus();
    if (!cloudLoop) {
        createCloud();
    }
}

function showMainMenu() {
    gameStarted = false;
    isGameOver = false;
    mainMenu.style.display = 'block';
    gameOverDisplay.style.display = 'none';
    winScreen.style.display = 'none';
    document.querySelector('.hud').classList.add('hidden');
    
    // Clear any existing cacti and chickens
    cacti.forEach(cactus => cactus.element.remove());
    cacti = [];
    chickens.forEach(chicken => chicken.element.remove());
    chickens = [];
    
    // Reset cowboy position
    cowboy.style.transform = 'translateY(0)';
    
    // Cancel any ongoing game loops
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
}

// Update key handlers
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        if (!isSpaceBarDown) {
            isSpaceBarDown = true;
            jump();
        }
    } else if (event.code === 'KeyR' && isGameOver) {
        resetGame(false);
    } else if (event.code === 'KeyC' && isGameOver && lastCheckpoint > 0) {
        resetGame(true);
    } else if (event.code === 'KeyM' && isGameOver) {
        showMainMenu();
    } else if (event.code === 'KeyN' && !gameStarted) {
        startGame();
    }
});

document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpaceBarDown = false;
        if (isJumping && !isDoubleJumping) {
            canDoubleJump = true;
        } else if (!isJumping) {
            canJump = true;
        }
    }
});
