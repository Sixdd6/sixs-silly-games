const cowboy = document.getElementById('cowboy');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const levelDisplay = document.getElementById('level');
const gameOverDisplay = document.getElementById('gameOver');
const winScreen = document.getElementById('winScreen');
const continueOption = document.getElementById('continueOption');
const regularRestart = document.getElementById('regularRestart');
const continueLevelDisplay = document.getElementById('continueLevel');
const gameContainer = document.querySelector('.game-container');
const cloudsContainer = document.getElementById('clouds-container');
const staminaPoints = document.querySelectorAll('.stamina-point');

let isJumping = false;
let isDoubleJumping = false;
let jumpAnimationFrame = null;
let position = 50;
let score = 0;
let baseScore = 0;
let level = 1;
let currentLevelTallCacti = 0;
let highScore = parseInt(localStorage.getItem('highScore')) || 0;
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

// Initialize displays
highScoreDisplay.textContent = `High Score: ${highScore}`;
levelDisplay.textContent = `Level: ${level}/100`;
updateStaminaDisplay();

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

function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        highScoreDisplay.textContent = `High Score: ${highScore}`;
        
        // Add visual feedback when high score is beaten
        highScoreDisplay.style.color = '#ff7b00';
        setTimeout(() => {
            highScoreDisplay.style.color = '#bc6c25';
        }, 1000);
    }
}

function checkLevelProgress() {
    const oldLevel = level;
    level = Math.min(Math.floor(baseScore / 10) + 1, 100);
    
    if (level !== oldLevel) {
        levelDisplay.textContent = `Level: ${level}/100`;
        
        // Reset tall cactus counter for new level
        currentLevelTallCacti = 0;
        
        // Visual feedback for challenge levels
        if (level % 10 === 0 && level < 100) {
            levelDisplay.style.color = '#ff4d4d';
            levelDisplay.style.fontSize = '24px';
            setTimeout(() => {
                levelDisplay.style.color = '';
                levelDisplay.style.fontSize = '';
            }, 1000);
            
            // Set new checkpoint after completing a challenge level
            lastCheckpoint = level;
            localStorage.setItem('lastCheckpoint', lastCheckpoint);
        }
        
        // Check for win condition
        if (level === 100) {
            winGame();
        }
    }
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
    chicken.style.transform = `translateX(${position}px)`;
    
    gameContainer.appendChild(chicken);
    
    chickens.push({
        element: chicken,
        position: position,
        speed: 3,
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
    } else if (isJumping && !isDoubleJumping && canDoubleJump && !canJump && stamina > 0) {
        isDoubleJumping = true;
        canDoubleJump = false;
        stamina--;
        updateStaminaDisplay();
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
    if (isGameOver) return;
    
    const cowboyPos = window.innerWidth / 2;
    
    // Update cacti positions and check collisions
    for (let i = cacti.length - 1; i >= 0; i--) {
        const cactus = cacti[i];
        cactus.position -= cactus.speed;
        cactus.element.style.transform = `translateX(${cactus.position}px)`;
        
        if (cactus.position < -50) {
            gameContainer.removeChild(cactus.element);
            cacti.splice(i, 1);
            continue;
        }
        
        if (!cactus.hasScored && cactus.position < cowboyPos - 20) {
            score++;
            baseScore++; // Increment base score for normal points
            scoreDisplay.textContent = `Score: ${score}`;
            cactus.hasScored = true;
            checkLevelProgress();
        }
        
        if (Math.abs(cactus.position - cowboyPos) < 25 && checkCollision(cactus.element)) {
            gameOver();
            return;
        }
    }
    
    // Update chicken positions
    chickens.forEach(chicken => {
        if (!chicken.collected) {
            chicken.position -= chicken.speed;
            chicken.element.style.transform = `translateX(${chicken.position}px)`;
        }
    });
    
    // Remove off-screen chickens
    chickens = chickens.filter(chicken => {
        if (chicken.position < -50) {
            chicken.element.remove();
            return false;
        }
        return true;
    });
    
    // Check for chicken collisions
    chickens.forEach(chicken => {
        if (chicken.collected) return;
        
        if (Math.abs(chicken.position - cowboyPos) < 30 && checkCollision(chicken.element)) {
            chicken.collected = true;
            chicken.element.style.opacity = '0';
            setTimeout(() => chicken.element.remove(), 300);
            
            // Calculate unused stamina restoration
            const maxStamina = 6;
            const staminaToRestore = 3;
            const staminaNeeded = Math.max(0, maxStamina - stamina);
            const unusedRestoration = Math.max(0, staminaToRestore - staminaNeeded);
            const bonusPoints = Math.min(3, unusedRestoration);
            
            // Restore stamina
            stamina = Math.min(maxStamina, stamina + staminaToRestore);
            updateStaminaDisplay();
            
            // Award points for unused restoration
            if (bonusPoints > 0) {
                score += bonusPoints;
                scoreDisplay.textContent = `Score: ${score}`;
                checkLevelProgress();
                
                // Show floating score text
                const floatingScore = document.createElement('div');
                floatingScore.className = 'floating-score';
                floatingScore.textContent = `+${bonusPoints}`;
                floatingScore.style.left = `${chicken.position}px`;
                floatingScore.style.top = '50%';
                gameContainer.appendChild(floatingScore);
                
                setTimeout(() => {
                    floatingScore.remove();
                }, 1000);
            }
        }
    });
    
    // Clean up collected chickens
    chickens = chickens.filter(chicken => !chicken.collected);
    
    // Spawn chicken logic - use baseScore instead of score
    if (baseScore > lastChickenSpawn + 10 && Math.random() < 0.01) {
        createChicken();
        lastChickenSpawn = baseScore;
    }
    
    gameLoop = requestAnimationFrame(updateGame);
}

function createCactus() {
    if (isGameOver) return;

    const cactus = document.createElement('div');
    cactus.className = 'cactus';
    
    // Only allow tall cactus if we haven't reached the limit
    const maxTallCactiPerLevel = 6;
    const canSpawnTall = currentLevelTallCacti < maxTallCactiPerLevel;
    
    // 10% chance of tall cactus (15% in challenge levels), only if we haven't reached the limit
    const tallCactusChance = canSpawnTall ? (level % 10 === 0 ? 0.15 : 0.10) : 0;
    const isTallCactus = Math.random() < tallCactusChance;
    
    if (isTallCactus) {
        cactus.classList.add('tall');
        currentLevelTallCacti++;
    }
    
    const difficulty = getDifficultySettings();
    const speed = difficulty.minSpeed + (Math.random() * (difficulty.maxSpeed - difficulty.minSpeed));
    const position = window.innerWidth;
    
    // Make challenge level cacti red-tinted
    if (level % 10 === 0) {
        cactus.style.filter = 'sepia(100%) hue-rotate(300deg) saturate(3)';
    }
    
    cactus.style.transform = `translateX(${position}px)`;
    gameContainer.appendChild(cactus);
    
    cacti.push({
        element: cactus,
        position: position,
        speed: speed,
        hasScored: false,
        isTall: isTallCactus
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

function gameOver() {
    if (level === 100) return; // Don't show game over if player has won
    
    isGameOver = true;
    gameOverDisplay.style.display = 'block';
    
    // Show continue option if player has beaten a challenge level
    if (lastCheckpoint > 0) {
        continueOption.style.display = 'block';
        regularRestart.style.display = 'none';
        continueLevelDisplay.textContent = lastCheckpoint + 1;
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

function resetGame(continueFromCheckpoint = false) {
    isGameOver = false;
    isJumping = false;
    isDoubleJumping = false;
    canJump = true;
    canDoubleJump = false;
    position = 50;
    currentLevelTallCacti = 0;
    
    if (continueFromCheckpoint && lastCheckpoint > 0) {
        // Continue from the level after the last checkpoint
        level = lastCheckpoint + 1;
        score = (level - 1) * 10;
        baseScore = score;
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

// Update key handlers
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        if (!isSpaceBarDown) {
            isSpaceBarDown = true;
            jump();
        }
    } else if (event.code === 'KeyR' && isGameOver) {
        resetGame(false); // Full restart
    } else if (event.code === 'KeyC' && isGameOver && lastCheckpoint > 0) {
        resetGame(true); // Continue from checkpoint
    }
});

document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpaceBarDown = false;
        if (isJumping && !isDoubleJumping) {
            canDoubleJump = true; // Enable double jump only when space is released during first jump
        } else if (!isJumping) {
            canJump = true;
        }
    }
});

// Start the game
updateGame();
createCactus();

// Initialize with multiple clouds
for (let i = 0; i < 8; i++) {
    createCloud(true); // Initial clouds can spawn mid-screen
}
updateClouds();
