/* ============================================
   MAYA — THE DIVINE ILLUSION
   Horizontal Game Flow — Application Logic
   ============================================ */

// ============================================
// PARTICLE SYSTEM
// ============================================
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedY = -(Math.random() * 0.3 + 0.1);
        this.speedX = (Math.random() - 0.5) * 0.2;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.hue = Math.random() > 0.5 ? 45 : 270;
    }
    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.opacity -= 0.001;
        if (this.y < -10 || this.opacity <= 0) {
            this.reset();
            this.y = canvas.height + 10;
            this.opacity = Math.random() * 0.4 + 0.1;
        }
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

        // Theme-aware particles
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const lightness = isDark ? 70 : 40; // Darker particles in light mode
        const saturation = isDark ? 60 : 40; // Less saturated in light mode

        ctx.fillStyle = `hsla(${this.hue}, ${saturation}%, ${lightness}%, ${this.opacity})`;
        ctx.fill();
    }
}

function initParticles() {
    resizeCanvas();
    const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 18000));
    particles = Array.from({ length: count }, () => new Particle());
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
}

window.addEventListener('resize', resizeCanvas);
initParticles();
animateParticles();


// ============================================
// SOUND ENGINE (Web Audio API)
// ============================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let audioEnabled = true;

function ensureAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, duration, type = 'sine', vol = 0.15) {
    if (!audioEnabled) return;
    ensureAudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playCorrectSound() {
    playTone(523, 0.12, 'sine', 0.15);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.15), 80);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.18), 160);
}

function playWrongSound() {
    playTone(200, 0.15, 'square', 0.08);
    setTimeout(() => playTone(160, 0.2, 'square', 0.06), 100);
}

function playStreakSound(n) {
    for (let i = 0; i < Math.min(n, 5); i++) {
        setTimeout(() => playTone(400 + i * 120, 0.15, 'triangle', 0.12), i * 80);
    }
}

function playHeartbeat() {
    playTone(60, 0.15, 'sine', 0.12);
    setTimeout(() => playTone(60, 0.1, 'sine', 0.08), 150);
}

function playTimeUpSound() {
    playTone(300, 0.2, 'sawtooth', 0.08);
    setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.06), 150);
}

function playTransitionSound() {
    playTone(440, 0.08, 'sine', 0.08);
    setTimeout(() => playTone(550, 0.1, 'sine', 0.1), 60);
}

function playMatchCorrectSound() {
    playTone(600, 0.1, 'sine', 0.12);
    setTimeout(() => playTone(750, 0.15, 'sine', 0.12), 80);
}

function playMatchWrongSound() {
    playTone(250, 0.12, 'square', 0.06);
}

// Audio toggle
const audioToggleBtn = document.getElementById('audioToggle');
audioToggleBtn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    audioToggleBtn.textContent = audioEnabled ? '🔊' : '🔇';
    audioToggleBtn.classList.toggle('muted', !audioEnabled);
});

// Theme Toggle
const themeToggleBtn = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('mayaTheme') || 'light';

// Home Button
const homeBtn = document.getElementById('homeBtn');
homeBtn.addEventListener('click', () => {
    goToStage(0);
});

// Set initial theme preference
let isDarkMode = false; // Moved declaration here to avoid redeclaration issues
const currentSavedTheme = localStorage.getItem('mayaTheme'); // Renamed to avoid redeclaration
if (currentSavedTheme === 'dark') {
    isDarkMode = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleBtn.textContent = '☀️';
}

themeToggleBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.textContent = '☀️';
        localStorage.setItem('mayaTheme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeToggleBtn.textContent = '🌙';
        localStorage.setItem('mayaTheme', 'light');
    }
});


// ============================================
// EFFECTS: Confetti, Flash, Shake, Toast
// ============================================
function spawnConfetti(count = 35) {
    const container = document.getElementById('confettiContainer');
    const colors = ['#f0c850', '#b07ce8', '#7ec8a0', '#e86c5a', '#5ec4d4', '#ffd98c', '#ff6b9d'];
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = `${Math.random() * 100}vw`;
        p.style.setProperty('--x-end', `${(Math.random() - 0.5) * 200}px`);
        p.style.setProperty('--rotation', `${Math.random() * 720 - 360}deg`);
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDelay = `${Math.random() * 0.3}s`;
        p.style.animationDuration = `${1 + Math.random()}s`;
        p.style.width = `${6 + Math.random() * 8}px`;
        p.style.height = `${4 + Math.random() * 6}px`;
        container.appendChild(p);
        setTimeout(() => p.remove(), 2500);
    }
}

function flashScreen(type) {
    const flash = document.getElementById('screenFlash');
    flash.className = `screen-flash ${type}`;
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 500);
}

function shakeScreen() {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 500);
}

function showToast(message, icon = '🏆') {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'achievement-toast';
    t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${message}</span>`;
    container.appendChild(t);
    setTimeout(() => t.classList.add('show'), 50);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 400);
    }, 2500);
}


// ============================================
// STAGE NAVIGATION
// ============================================
const TOTAL_STAGES = 10;
let currentStage = 0;
const slider = document.getElementById('stageSlider');
const journeyBar = document.getElementById('journeyBar');
const journeyFill = document.getElementById('journeyFill');
const journeyNodes = document.querySelectorAll('.journey-node');
const gameHud = document.getElementById('gameHud');
const stageAnimated = new Set();

function goToStage(n) {
    if (n < 0 || n >= TOTAL_STAGES) return;
    currentStage = n;
    slider.style.transform = `translateX(-${n * 100}vw)`;

    // Update journey bar
    journeyFill.style.width = `${(n / (TOTAL_STAGES - 1)) * 100}%`;
    journeyNodes.forEach((node, i) => {
        node.classList.remove('active');
        if (i < n) node.classList.add('completed');
        if (i === n) node.classList.add('active');
    });

    // Show journey bar after hero
    if (n > 0) {
        journeyBar.classList.add('visible');
        gameHud.classList.add('visible');
    } else {
        journeyBar.classList.remove('visible');
        gameHud.classList.remove('visible');
    }

    // Trigger stage-specific animations
    playTransitionSound();
    triggerStageAnimation(n);
}

function nextStage() {
    goToStage(currentStage + 1);
}

// ============================================
// CHAPTER NAVIGATION & UNLOCKING
// ============================================

// Check saved progress
let savedProgress = parseInt(localStorage.getItem('mayaProgress') || '1');

// Setup Chapter 1
document.getElementById('startBtn').addEventListener('click', () => {
    ensureAudioCtx();
    nextStage();
});

// Setup Chapter 2 & 3 Unlock State
const chapter2Btn = document.getElementById('chapter2Btn');
const chapter3Btn = document.getElementById('chapter3Btn');

function updateChapterUI() {
    // Unlock Chapter 2 if progress >= 2
    if (savedProgress >= 2 && chapter2Btn) {
        chapter2Btn.classList.remove('locked');
        chapter2Btn.classList.add('active');
        chapter2Btn.disabled = false;
        const iconInfo = chapter2Btn.querySelector('.chapter-icon');
        if (iconInfo) iconInfo.textContent = '🌟';
        const nameInfo = chapter2Btn.querySelector('.chapter-name');
        if (nameInfo) nameInfo.textContent = 'Karma';
    }

    // Unlock Chapter 3 if progress >= 3
    if (savedProgress >= 3 && chapter3Btn) {
        chapter3Btn.classList.remove('locked');
        chapter3Btn.classList.add('active');
        chapter3Btn.disabled = false;
        const iconInfo = chapter3Btn.querySelector('.chapter-icon');
        if (iconInfo) iconInfo.textContent = '⚖️';
        const nameInfo = chapter3Btn.querySelector('.chapter-name');
        if (nameInfo) nameInfo.textContent = 'Dharma';
    }
}

// Call initially
updateChapterUI();

// Chapter Click Handlers
if (chapter2Btn) {
    chapter2Btn.addEventListener('click', () => {
        if (chapter2Btn.classList.contains('locked')) {
            showToast('Complete Chapter 1 to unlock Karma', '🔒');
            playWrongSound();
        } else {
            ensureAudioCtx();
            goToStage(10); // Start Chapter 2
        }
    });
}

if (chapter3Btn) {
    chapter3Btn.addEventListener('click', () => {
        if (chapter3Btn.classList.contains('locked')) {
            showToast('Complete Chapter 2 to unlock Dharma', '🔒');
            playWrongSound();
        } else {
            showToast('Chapter 3: Dharma is coming soon!', '⚖️');
            playCorrectSound();
        }
    });
}

// Continue buttons
document.querySelectorAll('.continue-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const next = parseInt(btn.dataset.next);
        goToStage(next);
    });
});



// ============================================
// STAGE ANIMATIONS
// ============================================
function triggerStageAnimation(n) {
    if (stageAnimated.has(n)) return;
    stageAnimated.add(n);

    switch (n) {
        case 1: animateTree(); animateInsightCards(); break;
        case 3: break; // Gunas are interactive by default
        case 4: initMatchGame(); break;
        case 5: animateEgo(); animateEgoStages(); break;
        case 7: animateDetachment(); animateFreedomSteps(); break;
        case 2: startQuiz('tree'); break;
        case 6: startQuiz('ego'); break;
        case 8: startQuiz('final'); break;
        case 9: showResults(); break;
        
        // Chapter 2: Karma
        case 10: /* Wheel handled via CSS mostly, but trigger cards */ animateInsightCards(); break;
        case 11: startQuiz('karma1'); break;
        case 12: initKarmaVessels(); break;
        case 13: initSortingGame(); break;
        case 14: startQuiz('karmaFinal'); break;
        case 15: showResults2(); break;
    }
}

// ---- TREE ANIMATION ----
function animateTree() {
    const container = document.getElementById('treeContainer');
    container.innerHTML = `
        <svg viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="trunkGrad" x1="150" y1="0" x2="150" y2="400" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#f0c850" stop-opacity="0.9"/>
                    <stop offset="1" stop-color="#b07ce8" stop-opacity="0.6"/>
                </linearGradient>
                <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <g class="tree-roots" opacity="0" style="animation: fadeIn 1s 0.3s forwards">
                <text x="150" y="28" text-anchor="middle" fill="#f0c850" font-size="24" font-family="'Noto Sans Devanagari'">ॐ</text>
                <path d="M150 40 C120 50 80 45 60 35" stroke="#f0c850" stroke-width="2" opacity="0.5" fill="none"/>
                <path d="M150 40 C180 50 220 45 240 35" stroke="#f0c850" stroke-width="2" opacity="0.5" fill="none"/>
                <path d="M150 40 C130 55 100 55 70 50" stroke="#f0c850" stroke-width="1.5" opacity="0.3" fill="none"/>
                <path d="M150 40 C170 55 200 55 230 50" stroke="#f0c850" stroke-width="1.5" opacity="0.3" fill="none"/>
            </g>
            <g class="tree-trunk" opacity="0" style="animation: fadeIn 1s 0.6s forwards">
                <path d="M150 45 L150 250" stroke="url(#trunkGrad)" stroke-width="4" stroke-linecap="round"/>
                <path d="M150 100 C130 120 110 115 90 130" stroke="url(#trunkGrad)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                <path d="M150 100 C170 120 190 115 210 130" stroke="url(#trunkGrad)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                <path d="M150 160 C125 180 100 175 75 195" stroke="url(#trunkGrad)" stroke-width="2" stroke-linecap="round" fill="none"/>
                <path d="M150 160 C175 180 200 175 225 195" stroke="url(#trunkGrad)" stroke-width="2" stroke-linecap="round" fill="none"/>
            </g>
            <g class="tree-branches" opacity="0" style="animation: fadeIn 1s 0.9s forwards">
                <circle cx="85" cy="135" r="10" fill="#b07ce8" opacity="0.15"/>
                <text x="85" y="139" text-anchor="middle" font-size="14">👁️</text>
                <circle cx="215" cy="135" r="10" fill="#b07ce8" opacity="0.15"/>
                <text x="215" y="139" text-anchor="middle" font-size="14">👂</text>
                <circle cx="70" cy="200" r="10" fill="#b07ce8" opacity="0.15"/>
                <text x="70" y="204" text-anchor="middle" font-size="14">👃</text>
                <circle cx="230" cy="200" r="10" fill="#b07ce8" opacity="0.15"/>
                <text x="230" y="204" text-anchor="middle" font-size="14">👅</text>
                <circle cx="150" cy="260" r="10" fill="#b07ce8" opacity="0.15"/>
                <text x="150" y="264" text-anchor="middle" font-size="14">🤚</text>
            </g>
            <g opacity="0" style="animation: fadeIn 1s 1.2s forwards">
                <text x="150" y="310" text-anchor="middle" fill="rgba(240,239,244,0.4)" font-size="11" font-family="Outfit">↓ Senses & Material World ↓</text>
                <text x="150" y="18" text-anchor="middle" fill="rgba(240,200,80,0.6)" font-size="11" font-family="Outfit">↑ The Divine (Brahman) ↑</text>
            </g>
        </svg>
    `;
}

function animateInsightCards() {
    const cards = document.querySelectorAll('#stage-1 .insight-card');
    cards.forEach((card, i) => setTimeout(() => card.classList.add('visible'), 400 + i * 200));
}

// ---- GUNAS INTERACTION ----
const gunaSegments = document.querySelectorAll('.guna-segment');
const gunaDetails = {
    sattva: document.getElementById('sattvaDetail'),
    rajas: document.getElementById('rajasDetail'),
    tamas: document.getElementById('tamasDetail'),
};

gunaSegments.forEach(seg => {
    seg.addEventListener('click', () => {
        const guna = seg.dataset.guna;
        gunaSegments.forEach(s => s.classList.remove('active'));
        seg.classList.add('active');
        Object.values(gunaDetails).forEach(d => d.classList.remove('active'));
        gunaDetails[guna]?.classList.add('active');
    });
});

// ---- EGO ANIMATION ----
function animateEgo() {
    const svgEl = document.querySelector('#stage-5 .ego-circle');
    const egoFill = document.getElementById('egoFill');
    const egoPercent = document.getElementById('egoPercent');
    const egoThought = document.getElementById('egoThought');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `<linearGradient id="egoGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f0c850"/><stop offset="100%" stop-color="#e86c5a"/></linearGradient>`;
    svgEl.prepend(defs);
    egoFill.setAttribute('stroke', 'url(#egoGradient)');

    const circumference = 2 * Math.PI * 90;
    const duration = 2000;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        egoPercent.textContent = Math.round(eased * 100);
        egoFill.style.strokeDashoffset = circumference - (eased * circumference);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    setTimeout(() => egoThought.classList.add('visible'), 1800);
}

function animateEgoStages() {
    const stages = document.querySelectorAll('#stage-5 .ego-stage');
    stages.forEach((s, i) => setTimeout(() => s.classList.add('visible'), 600 + i * 250));
}

// ---- DETACHMENT ANIMATION ----
function animateDetachment() {
    const chainLeft = document.getElementById('chainLeft');
    const chainRight = document.getElementById('chainRight');
    const surrenderHeart = document.getElementById('surrenderHeart');
    const sword = document.getElementById('sword');

    let chainsBroken = false;
    sword.addEventListener('click', () => {
        if (chainsBroken) return;
        chainsBroken = true;
        sword.style.transform = 'scale(1.3)';
        setTimeout(() => sword.style.transform = '', 200);
        chainLeft.classList.add('broken');
        chainRight.classList.add('broken');
        setTimeout(() => surrenderHeart.classList.add('visible'), 600);
        playCorrectSound();
        spawnConfetti(20);
    });

    setTimeout(() => {
        if (!chainsBroken) {
            chainsBroken = true;
            chainLeft.classList.add('broken');
            chainRight.classList.add('broken');
            setTimeout(() => surrenderHeart.classList.add('visible'), 600);
        }
    }, 4000);
}

function animateFreedomSteps() {
    const steps = document.querySelectorAll('#stage-7 .freedom-step');
    steps.forEach((s, i) => setTimeout(() => s.classList.add('visible'), 400 + i * 250));
}


// ============================================
// MATCH THE GUNA ACTIVITY (Stage 4)
// ============================================
let selectedTrait = null;
let matchCorrect = { sattva: 0, rajas: 0, tamas: 0 };
let matchTotal = 0;
const MATCH_TARGET_COUNT = 6;

function initMatchGame() {
    const traits = document.querySelectorAll('.match-trait');
    const targets = document.querySelectorAll('.match-target');
    const feedback = document.getElementById('matchFeedback');

    traits.forEach(trait => {
        trait.addEventListener('click', () => {
            if (trait.classList.contains('matched')) return;
            // Deselect previous
            traits.forEach(t => t.classList.remove('selected'));
            trait.classList.add('selected');
            selectedTrait = trait;
        });
    });

    targets.forEach(target => {
        target.addEventListener('click', () => {
            if (!selectedTrait) {
                feedback.textContent = '👆 Select a trait first, then tap a Guna!';
                return;
            }

            const traitAnswer = selectedTrait.dataset.answer;
            const targetGuna = target.dataset.guna;

            if (traitAnswer === targetGuna) {
                // Correct match
                selectedTrait.classList.add('matched');
                selectedTrait.classList.remove('selected');
                matchCorrect[targetGuna]++;
                matchTotal++;

                const scoreEl = document.getElementById(`${targetGuna}Score`);
                const maxForGuna = document.querySelectorAll(`.match-trait[data-answer="${targetGuna}"]`).length;
                scoreEl.textContent = `${matchCorrect[targetGuna]}/${maxForGuna}`;

                target.classList.add('glow');
                setTimeout(() => target.classList.remove('glow'), 600);

                playMatchCorrectSound();
                feedback.textContent = `✓ "${selectedTrait.dataset.trait}" belongs to ${targetGuna.charAt(0).toUpperCase() + targetGuna.slice(1)}!`;

                // Award points
                updatePointsDisplay(150);
                totalScore++;
                currentStreak++;
                if (currentStreak > bestStreak) bestStreak = currentStreak;
                updateStreakDisplay();

                if (matchTotal >= MATCH_TARGET_COUNT) {
                    // All matched — auto advance
                    feedback.textContent = '🎉 Perfect! All traits matched correctly!';
                    spawnConfetti(50);
                    showToast('Guna Master!', '☯');
                    setTimeout(() => goToStage(5), 1500);
                }
            } else {
                // Wrong match
                selectedTrait.classList.add('wrong');
                setTimeout(() => selectedTrait.classList.remove('wrong'), 400);
                playMatchWrongSound();
                flashScreen('incorrect');
                feedback.textContent = `✗ "${selectedTrait.dataset.trait}" doesn't belong to ${targetGuna.charAt(0).toUpperCase() + targetGuna.slice(1)}. Try again!`;
                currentStreak = 0;
                updateStreakDisplay();
            }

            selectedTrait = null;
        });
    });
}


// ============================================
// QUIZ SYSTEM — Split by Topic
// ============================================
const TIME_PER_QUESTION = 15;
const MAX_POINTS = 1000;
const TIMER_CIRC = 2 * Math.PI * 34;

// Question pools
const treeQuestions = [
    { question: "In the Bhagavad Gita, how is Maya described metaphorically?", options: ["A labyrinth of endless desires", "An inverted banyan tree with roots above", "A mirrored hall reflecting the soul", "A golden vessel hiding the truth"], correct: 1, explanation: "Krishna describes Maya as an inverted banyan tree (Ashvattha) — roots above, branches below." },
    { question: "What does 'Ashvattha' literally mean?", options: ["The eternal tree of cosmic wisdom", "That which survives the end of time", "That which does not last till tomorrow", "The unbroken cycle of birth and death"], correct: 2, explanation: "Ashvattha means 'that which does not last till tomorrow' — the material world is impermanent." },
];

const egoQuestions = [
    { question: "What is 'Ahamkara' in the context of Maya?", options: ["The subtle life force within the body", "The divine will controlling the universe", "The illusion of independent 'I-ness'", "The ultimate state of pure consciousness"], correct: 2, explanation: "Ahamkara is the ego — the false identification with the body that makes the soul believe it is the 'doer.'" },
    { question: "What does the soul falsely identify with under Maya?", options: ["Its eternal and unchanging spiritual nature", "The temporary body, mind, and intellect", "The collective consciousness of humanity", "The supreme reality underlying existence"], correct: 1, explanation: "Under Maya, the soul falsely identifies with the temporary body, mind, and intellect — 'I am this body.'" },
];

const finalQuestions = [
    { question: "Which statement best describes the Guna of Sattva?", options: ["It is the driving force of worldly ambition", "It is the grounding force of physical stability", "It is the illuminating force of purity and harmony", "It is the universal law of ethical duty"], correct: 2, explanation: "Sattva represents goodness, purity, and harmony, illuminating the mind." },
    { question: "What is the true essence of Vairagya?", options: ["The renunciation of all physical actions", "Radiant devotion to a supreme deity", "Objectivity without attachment to outcomes", "The complete suppression of natural desires"], correct: 2, explanation: "Vairagya means detachment — retaining objectivity and non-attachment to the fruits of actions, not suppressing them." },
    { question: "What is the ultimate way to definitively transcend Maya?", options: ["Accumulating vast scriptural knowledge", "Strict adherence to physical austerities", "Integrating knowledge, detachment & surrender", "Retreating entirely from all worldly duties"], correct: 2, explanation: "Freedom requires a combination of Jnana (knowledge), Vairagya (detachment), and Sharanagati (surrender to the Divine)." },
];

const karma1Questions = [
    { question: "What does the word 'Karma' literally translate to?", options: ["Destiny or fate", "Action or deed", "Universal suffering", "Divine retribution"], correct: 1, explanation: "Karma simply means 'action'. It is the universal principle of cause and effect." },
    { question: "According to the law of Karma, who is responsible for your present reality?", options: ["The arbitrary will of the divine", "The luck you were born with", "Your own past actions", "The alignment of the stars"], correct: 2, explanation: "You are the architect of your destiny; your present reality is the harvest of your past actions." },
];

const karmaFinalQuestions = [
    { question: "Which type of Karma refers to the vast, accumulated reservoir of past actions?", options: ["Prarabdha", "Agami", "Sanchita", "Nishkama"], correct: 2, explanation: "Sanchita Karma is the accumulated sum of all past actions from countless lifetimes." },
    { question: "What is 'Prarabdha' Karma?", options: ["The karma you are creating right now", "The portion of past karma bearing fruit in this lifetime", "The karma that leads directly to liberation", "Actions performed without any selfish motive"], correct: 1, explanation: "Prarabdha is the karma chosen for this specific lifetime, dictating inevitable life situations." },
    { question: "How does one generate 'Agami' Karma?", options: ["Through actions performed in past lives", "By passively experiencing the consequences of Prarabdha", "Through current choices and free will", "By abandoning all physical activities"], correct: 2, explanation: "Agami Karma is the new karma you are generating right now through your current choices." },
];

// Game state
let totalScore = 0;
let totalPoints = 0;
let currentStreak = 0;
let bestStreak = 0;
let responseTimes = [];
let totalQuestions = 0;

// Active quiz state
let activeQuiz = null;
let quizQuestions = [];
let quizIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let questionStartTime = 0;

function updateStreakDisplay() {
    const el = document.getElementById('hudStreak');
    const cnt = document.getElementById('streakCount');
    cnt.textContent = currentStreak;
    if (currentStreak >= 2) {
        el.style.opacity = '1';
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 500);
    } else {
        el.style.opacity = '0';
    }
}

function updatePointsDisplay(pts) {
    const el = document.getElementById('pointsDisplay');
    const startVal = totalPoints;
    totalPoints += pts;
    const duration = 400;
    const t0 = performance.now();
    function tick(now) {
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(startVal + pts * eased);
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    el.classList.add('points-pop');
    setTimeout(() => el.classList.remove('points-pop'), 400);
}

function startQuiz(type) {
    activeQuiz = type;
    quizIndex = 0;

    if (type === 'tree') quizQuestions = [...treeQuestions];
    else if (type === 'ego') quizQuestions = [...egoQuestions];
    else quizQuestions = [...finalQuestions].sort(() => Math.random() - 0.5);

    renderQuizQuestion(type);
}

function renderQuizQuestion(type) {
    const q = quizQuestions[quizIndex];
    const letters = ['A', 'B', 'C', 'D'];

    document.getElementById(`qCounter-${type}`).textContent = `Question ${quizIndex + 1} of ${quizQuestions.length}`;
    document.getElementById(`quizQuestion-${type}`).textContent = q.question;

    const optionsEl = document.getElementById(`quizOptions-${type}`);
    optionsEl.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span>${opt}</span>`;
        btn.addEventListener('click', () => selectQuizAnswer(type, i));
        btn.style.animationDelay = `${i * 0.08}s`;
        optionsEl.appendChild(btn);
    });

    const feedback = document.getElementById(`quizFeedback-${type}`);
    feedback.className = 'quiz-feedback';
    feedback.style.display = 'none';
    document.getElementById(`quizNextBtn-${type}`).style.display = 'none';

    startTimer(type);
}

function startTimer(type) {
    clearInterval(timerInterval);
    timeLeft = TIME_PER_QUESTION;
    questionStartTime = performance.now();

    const fill = document.getElementById(`timerFill-${type}`);
    const text = document.getElementById(`timerText-${type}`);
    const container = document.getElementById(`timerContainer-${type}`);

    fill.style.strokeDasharray = TIMER_CIRC;
    fill.style.strokeDashoffset = 0;
    text.textContent = timeLeft;
    container.classList.remove('urgent');

    timerInterval = setInterval(() => {
        timeLeft--;
        text.textContent = Math.max(0, timeLeft);
        fill.style.strokeDashoffset = (1 - timeLeft / TIME_PER_QUESTION) * TIMER_CIRC;

        if (timeLeft <= 5 && timeLeft > 0) {
            container.classList.add('urgent');
            playHeartbeat();
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            playTimeUpSound();
            flashScreen('timeout');
            handleQuizTimeUp(type);
        }
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

function handleQuizTimeUp(type) {
    const q = quizQuestions[quizIndex];
    const options = document.querySelectorAll(`#quizOptions-${type} .quiz-option`);
    const feedback = document.getElementById(`quizFeedback-${type}`);

    options.forEach(o => o.classList.add('disabled'));
    options[q.correct].classList.add('correct');

    currentStreak = 0;
    updateStreakDisplay();
    responseTimes.push(TIME_PER_QUESTION);
    totalQuestions++;

    feedback.textContent = '⏰ Time\'s up! ' + q.explanation;
    feedback.className = 'quiz-feedback show incorrect';
    feedback.style.display = 'block';
    shakeScreen();

    const nextBtn = document.getElementById(`quizNextBtn-${type}`);
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = quizIndex < quizQuestions.length - 1 ? 'Next →' : 'Continue ✨';
}

function selectQuizAnswer(type, idx) {
    stopTimer();
    const q = quizQuestions[quizIndex];
    const options = document.querySelectorAll(`#quizOptions-${type} .quiz-option`);
    const feedback = document.getElementById(`quizFeedback-${type}`);
    const isCorrect = idx === q.correct;

    const responseTime = (performance.now() - questionStartTime) / 1000;
    responseTimes.push(responseTime);
    totalQuestions++;

    options.forEach(o => o.classList.add('disabled'));
    options[q.correct].classList.add('correct');
    if (!isCorrect) options[idx].classList.add('incorrect');

    if (isCorrect) {
        totalScore++;
        currentStreak++;
        if (currentStreak > bestStreak) bestStreak = currentStreak;

        const timeFrac = Math.max(0, timeLeft) / TIME_PER_QUESTION;
        const base = Math.round(MAX_POINTS * (0.3 + 0.7 * timeFrac));
        const bonus = currentStreak > 1 ? Math.round(base * 0.1 * Math.min(currentStreak, 5)) : 0;
        updatePointsDisplay(base + bonus);
        updateStreakDisplay();

        playCorrectSound();
        flashScreen('correct');
        spawnConfetti(currentStreak > 2 ? 50 : 30);

        if (currentStreak === 3) showToast('Hat Trick! 🔥', '🔥');
        if (currentStreak === 5) showToast('UNSTOPPABLE!', '⚡');
    } else {
        if (currentStreak >= 2) showToast(`${currentStreak}x streak broken!`, '💔');
        currentStreak = 0;
        updateStreakDisplay();
        playWrongSound();
        flashScreen('incorrect');
        shakeScreen();
    }

    feedback.textContent = (isCorrect ? '✓ Correct! ' : '✗ Not quite. ') + q.explanation;
    feedback.className = `quiz-feedback show ${isCorrect ? 'correct' : 'incorrect'}`;
    feedback.style.display = 'block';

    const nextBtn = document.getElementById(`quizNextBtn-${type}`);
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = quizIndex < quizQuestions.length - 1 ? 'Next →' : 'Continue ✨';
}

// Quiz next buttons
['tree', 'ego', 'final'].forEach(type => {
    document.getElementById(`quizNextBtn-${type}`).addEventListener('click', () => {
        quizIndex++;
        if (quizIndex < quizQuestions.length) {
            renderQuizQuestion(type);
        } else {
            // Quiz complete — advance to next stage
            const stageMap = { tree: 3, ego: 7, final: 9 };
            goToStage(stageMap[type]);
        }
    });
});


// ============================================
// RESULTS (Stage 9)
// ============================================
function showResults() {
    stopTimer();

    const total = totalQuestions;
    const circumference = 2 * Math.PI * 85;
    const fraction = total > 0 ? totalScore / total : 0;
    const resultFill = document.getElementById('resultFill');

    setTimeout(() => {
        resultFill.style.strokeDashoffset = circumference - (fraction * circumference);
    }, 300);

    document.getElementById('resultScore').textContent = `${totalScore}/${total}`;

    const accuracy = total > 0 ? Math.round((totalScore / total) * 100) : 0;
    const avgTime = responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) : 0;

    document.getElementById('statAccuracy').textContent = `${accuracy}%`;
    document.getElementById('statAvgTime').textContent = `${avgTime}s`;
    document.getElementById('statStreak').textContent = `${bestStreak}🔥`;
    document.getElementById('statPoints').textContent = totalPoints.toLocaleString();

    const titles = ['Keep Learning 🌱', 'Seeking Truth 📖', 'Growing Awareness 🪷', 'Rising Wisdom 🧘', 'Deep Understanding 📿', 'Awakened Insight ✨', 'Illumined Mind 🕉️', 'Enlightened! 👑'];
    const messages = [
        "The path begins with curiosity. Every attempt brings you closer!",
        "You're beginning to see through Maya. Keep going!",
        "Your understanding grows — like dawn breaking through darkness.",
        "Good insight! Your awareness is sharpening.",
        "Solid grasp of the teachings. Impressive wisdom!",
        "Excellent! Your insight penetrates deep.",
        "Remarkable! You see through Maya like a sage.",
        "Perfect! True enlightenment achieved!"
    ];

    const idx = Math.min(totalScore, titles.length - 1);
    document.getElementById('resultTitle').textContent = titles[idx];
    document.getElementById('resultMessage').textContent = messages[idx];

    if (totalScore >= 5) {
        spawnConfetti(80);
        playStreakSound(totalScore);
        if (totalScore === total && total > 0) showToast('PERFECT! True enlightenment!', '🕉️');
        
        // Unlock Chapter 2 (Karma)
        if (savedProgress < 2) {
            savedProgress = 2;
            localStorage.setItem('mayaProgress', '2');
            updateChapterUI();
        }
        
        // Show Continue to Karma button
        const continueKarmaBtn = document.getElementById('continueKarmaBtn');
        if(continueKarmaBtn) continueKarmaBtn.style.display = 'inline-block';
    }
}

// Retry
document.getElementById('retryBtn').addEventListener('click', () => {
    // Reset all state
    totalScore = 0;
    totalPoints = 0;
    currentStreak = 0;
    bestStreak = 0;
    responseTimes = [];
    totalQuestions = 0;
    matchCorrect = { sattva: 0, rajas: 0, tamas: 0 };
    matchTotal = 0;
    selectedTrait = null;
    stageAnimated.clear();

    document.getElementById('pointsDisplay').textContent = '0';
    updateStreakDisplay();

    // Reset match game
    document.querySelectorAll('.match-trait').forEach(t => {
        t.classList.remove('matched', 'selected', 'wrong');
    });
    ['sattvaScore', 'rajasScore', 'tamasScore'].forEach(id => {
        document.getElementById(id).textContent = '0/2';
    });
    document.getElementById('matchFeedback').textContent = '';

    // Reset ego
    const egoFill = document.getElementById('egoFill');
    if (egoFill) egoFill.style.strokeDashoffset = 565;
    const egoPercent = document.getElementById('egoPercent');
    if (egoPercent) egoPercent.textContent = '0';
    const egoThought = document.getElementById('egoThought');
    if (egoThought) egoThought.classList.remove('visible');
    document.querySelectorAll('#stage-5 .ego-stage').forEach(s => s.classList.remove('visible'));

    // Reset detachment
    const chainLeft = document.getElementById('chainLeft');
    const chainRight = document.getElementById('chainRight');
    const surrenderHeart = document.getElementById('surrenderHeart');
    if (chainLeft) chainLeft.classList.remove('broken');
    if (chainRight) chainRight.classList.remove('broken');
    if (surrenderHeart) surrenderHeart.classList.remove('visible');
    document.querySelectorAll('#stage-7 .freedom-step').forEach(s => s.classList.remove('visible'));

    // Reset insight cards
    document.querySelectorAll('#stage-1 .insight-card').forEach(c => c.classList.remove('visible'));

    // Reset result
    const resultFill = document.getElementById('resultFill');
    if (resultFill) resultFill.style.strokeDashoffset = 534;

    goToStage(0);
});

// ============================================
// CHAPTER 2: KARMA LOGIC
// ============================================

// --- Karma Vessels Animation ---
function initKarmaVessels() {
    // Mostly CSS-driven hover, but wait 1s and trigger water drop
    setTimeout(() => {
        const drop = document.querySelector('.vessel-drop');
        if(drop) drop.style.animation = 'drip 2s infinite';
    }, 1000);
}

// --- Sorting Game ---
const sortingScenarios = [
    { text: "Donating to charity to look good on social media", type: "binding" },
    { text: "Performing your duty without expecting a reward", type: "liberating" },
    { text: "Helping a stranger sincerely out of compassion", type: "liberating" },
    { text: "Working overtime purely for the bonus pay", type: "binding" }
];
let sortingIndex = 0;
let sortingScore = 0;

function initSortingGame() {
    sortingIndex = 0;
    sortingScore = 0;
    
    // reset UI buttons
    document.querySelectorAll('.sort-btn').forEach(btn => btn.style.display = 'block');
    
    updateSortingCard();
    document.getElementById('sortingProgress').textContent = `0/${sortingScenarios.length} Sorted`;
    document.getElementById('sortingFeedback').textContent = '';
    
    // Add event listeners if not already added
    if (!window.sortingListenerAdded) {
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleSort(e.target.dataset.type));
        });
        window.sortingListenerAdded = true;
    }
}

function updateSortingCard() {
    const card = document.getElementById('sortingCard');
    const text = document.getElementById('sortingScenario');
    
    if (sortingIndex < sortingScenarios.length) {
        card.className = 'sorting-card'; // reset classes
        text.textContent = sortingScenarios[sortingIndex].text;
    } else {
        // Game over
        card.className = 'sorting-card';
        text.textContent = "Activity Complete!";
        document.querySelectorAll('.sort-btn').forEach(btn => btn.style.display = 'none');
        setTimeout(() => {
            goToStage(14); // Go to final quiz
        }, 2000);
    }
}

function handleSort(selectedType) {
    if (sortingIndex >= sortingScenarios.length) return;
    
    const current = sortingScenarios[sortingIndex];
    const card = document.getElementById('sortingCard');
    const fbk = document.getElementById('sortingFeedback');
    
    if (selectedType === current.type) {
        // Correct
        playCorrectSound();
        sortingScore++;
        card.classList.add(selectedType === 'binding' ? 'swipe-left' : 'swipe-right');
        fbk.textContent = "Correct! +100";
        fbk.className = "match-feedback correct";
        updatePointsDisplay(100);
        flashScreen('correct');
    } else {
        // Wrong
        playWrongSound();
        card.style.animation = 'shakeX 0.4s ease';
        fbk.textContent = "Incorrect. " + (current.type === 'binding' ? "This creates karma due to selfie motives." : "This is Nishkama Karma, action without attachment.");
        fbk.className = "match-feedback incorrect";
        flashScreen('incorrect');
        
        setTimeout(() => {
            card.style.animation = '';
        }, 400);
    }
    
    sortingIndex++;
    document.getElementById('sortingProgress').textContent = `${sortingIndex}/${sortingScenarios.length} Sorted`;
    
    setTimeout(() => {
        updateSortingCard();
    }, 600);
}

// --- Results 2 ---
function showResults2() {
    const maxPossScore = karma1Questions.length + karmaFinalQuestions.length;
    // We re-use current totalScore which resets on retry.
    
    const percentage = Math.min(100, Math.round((totalScore / maxPossScore) * 100));
    const resultFill = document.getElementById('resultFill2');
    const offset = 534 - (534 * percentage) / 100;
    
    setTimeout(() => {
        if(resultFill) {
            resultFill.style.transition = 'stroke-dashoffset 1.5s ease-out';
            resultFill.style.strokeDashoffset = offset;
        }
    }, 500);

    document.getElementById('resultScore2').textContent = `${totalScore}/${maxPossScore}`;
    document.getElementById('statAccuracy2').textContent = `${percentage}%`;
    document.getElementById('statAvgTime2').textContent = totalQuestions > 0 ? `${(responseTimes.reduce((a, b) => a + b, 0) / totalQuestions).toFixed(1)}s` : '0s';
    document.getElementById('statStreak2').textContent = bestStreak;
    document.getElementById('statPoints2').textContent = totalPoints;

    const titles = [
        "A Seed is Planted",
        "Seeker of Truth",
        "Awakening Soul",
        "Karma Yogi",
        "Master of Action"
    ];

    const messages = [
        "The wheel turns. Every attempt brings you closer to understanding.",
        "You are beginning to see the patterns of action and reaction.",
        "Your understanding of duty without attachment grows.",
        "You see through the illusion of doership. Excellent!",
        "Perfect harmony! You are a true Karma Yogi."
    ];

    let idx = Math.floor((totalScore / maxPossScore) * titles.length);
    if(idx >= titles.length) idx = titles.length - 1;
    
    document.getElementById('resultTitle2').textContent = titles[idx];
    document.getElementById('resultMessage2').textContent = messages[idx];

    // Unlock Chapter 3
    if (percentage >= 50) {
        if (savedProgress < 3) {
            localStorage.setItem('mayaProgress', '3');
        }
        spawnConfetti(80);
        showToast('Chapter 3: Dharma Unlocked!', '⚖️');
    }

    if (totalScore >= maxPossScore && maxPossScore > 0) {
        spawnConfetti(80);
        playStreakSound(totalScore);
        showToast('PERFECT! Master of Action!', '🕉️');
    }
}

// Retry Karma
const retryK = document.getElementById('retryKarmaBtn');
if(retryK) {
    retryK.addEventListener('click', () => {
        totalScore = 0;
        totalPoints = 0;
        currentStreak = 0;
        bestStreak = 0;
        responseTimes = [];
        totalQuestions = 0;
        document.getElementById('pointsDisplay').textContent = '0';
        updateStreakDisplay();
        
        // reset result circle
        const resultFill = document.getElementById('resultFill2');
        if (resultFill) resultFill.style.strokeDashoffset = 534;
        
        goToStage(10);
    });
}

// Home Buttons
const h1Btn = document.getElementById('homeFromResults1Btn');
if(h1Btn) h1Btn.addEventListener('click', () => location.reload()); // Reload to show unlocked chapters

const h2Btn = document.getElementById('homeFromKarmaBtn');
if(h2Btn) h2Btn.addEventListener('click', () => location.reload());

const continueKarmaBtn = document.getElementById('continueKarmaBtn');
if(continueKarmaBtn) continueKarmaBtn.addEventListener('click', () => {
    goToStage(10);
});
