import { UnityAds } from 'capacitor-unity-ads';
import { StartioAds } from '@martinezmanoloa/capacitor-startio-ads';

let firebaseApp, firebaseAuth;
try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    console.log('✅ Firebase initialized');
} catch (e) { console.error('❌ Firebase init failed:', e); }

const game = {
    user: null, pendingMobile: null, pendingName: null, pendingRef: null,
    confirmationResult: null, level: 1, lives: 3, mistakesInLevel: 0,
    levelsPassedInCycle: 0, timeLeft: 0, timer: null, currentRound: null,
    adCallback: null, scratchPercent: 0, isScratching: false,
    isUnityReady: false, isStartIOReady: false, qrDataUrl: null,
    colors: [
        { name: 'ਹਰਾ', code: '#00ff88' }, { name: 'ਲਾਲ', code: '#ff4444' },
        { name: 'ਨੀਲਾ', code: '#4488ff' }, { name: 'ਪੀਲਾ', code: '#ffdd00' },
        { name: 'ਗੁਲਾਬੀ', code: '#ff69b4' }, { name: 'ਜਾਮਨੀ', code: '#a020f0' }
    ],

    init() {
        this.initSDKs();
        this.buildLanguageGrid();
        this.checkReferralParam();
        this.applyTranslations();
        const saved = security.load('currentUser');
        if (saved && saved.mobile) { this.user = saved; this.showGame(); }
    },

    buildLanguageGrid() {
        const grid = document.getElementById('lang-grid');
        if (!grid) return;
        grid.innerHTML = '';
        Object.keys(TRANSLATIONS).forEach(code => {
            const lang = TRANSLATIONS[code];
            const btn = document.createElement('button');
            btn.className = 'lang-btn';
            btn.innerHTML = '<span>' + lang.flag + '</span><span>' + lang.name + '</span>';
            btn.onclick = () => { setLanguage(code); this.showScreen('login-screen'); soundManager.play('click'); };
            grid.appendChild(btn);
        });
    },

    applyTranslations() {
        document.querySelectorAll('[data-t]').forEach(el => {
            const key = el.getAttribute('data-t');
            if (el.tagName === 'BUTTON' || el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'SPAN' || el.tagName === 'H2' || el.tagName === 'H3') {
                el.textContent = t(key);
            }
        });
        document.querySelectorAll('[data-t-ph]').forEach(el => {
            el.placeholder = t(el.getAttribute('data-t-ph'));
        });
        document.documentElement.lang = CURRENT_LANG;
    },

    async initSDKs() {
        try { await UnityAds.initialize({ gameId: ADS_CONFIG.UNITY.GAME_ID, testMode: ADS_CONFIG.UNITY.IS_TEST_MODE }); this.isUnityReady = true; } catch (e) {}
        try { await StartioAds.init({ appId: ADS_CONFIG.STARTIO.APP_ID, enableTest: ADS_CONFIG.STARTIO.IS_TEST_MODE }); this.isStartIOReady = true; } catch (e) {}
    },

    checkReferralParam() {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref) localStorage.setItem('mm_pending_ref', ref);
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if (id === 'game-screen') this.applyTranslations();
    },

    async sendOTP() {
        if (!firebaseAuth) { alert('Firebase config missing! Edit www/config/firebase-config.js'); return; }
        const name = document.getElementById('login-name').value.trim();
        const mobile = document.getElementById('login-mobile').value.trim();
        const ref = document.getElementById('login-ref').value.trim() || localStorage.getItem('mm_pending_ref') || '';
        if (!name || mobile.length !== 10 || !/^\d{10}$/.test(mobile)) { alert(t('enterValidInfo')); return; }
        this.pendingName = name; this.pendingMobile = '+91' + mobile; this.pendingRef = ref;
        try {
            const appVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
            this.confirmationResult = await firebaseAuth.signInWithPhoneNumber(this.pendingMobile, appVerifier);
            document.getElementById('otp-mobile').textContent = mobile;
            this.showScreen('otp-screen');
            soundManager.play('click');
        } catch (e) { alert('Error: ' + e.message); }
    },

    async verifyOTP() {
        const otp = document.getElementById('otp-input').value.trim();
        if (!otp || otp.length !== 6) { alert(t('wrongOTP')); return; }
        try {
            await this.confirmationResult.confirm(otp);
            this.createUser();
            soundManager.play('win');
        } catch (e) { alert(t('wrongOTP')); }
    },

    createUser() {
        const mobile = this.pendingMobile.replace('+91', '');
        const allUsers = security.load('allUsers') || {};
        if (allUsers[mobile]) { this.user = allUsers[mobile]; }
        else {
            this.user = {
                name: this.pendingName, mobile: mobile, stars: 0, cash: 0,
                level: 1, totalLevels: 0, scratchCards: 0, referrals: [],
                referralEarned: 0, referralRewardGiven: false,
                withdrawals: [], lastWithdrawalMonth: '',
                createdAt: Date.now(), language: CURRENT_LANG
            };
            allUsers[mobile] = this.user;
        }
        security.save('currentUser', this.user);
        security.save('allUsers', allUsers);
        this.processReferral();
        this.showGame();
    },

    processReferral() {
        if (!this.pendingRef || this.pendingRef === this.user.mobile) return;
        const allUsers = security.load('allUsers') || {};
        const referrer = allUsers[this.pendingRef];
        if (referrer && !referrer.referrals.includes(this.user.mobile)) {
            referrer.referrals.push(this.user.mobile);
            security.save('allUsers', allUsers);
            this.user.referredBy = this.pendingRef;
            security.save('currentUser', this.user);
        }
    },

    checkReferralReward() {
        if (!this.user.referredBy) return;
        const allUsers = security.load('allUsers') || {};
        const referrer = allUsers[this.user.referredBy];
        if (referrer && this.user.stars >= GAME_CONFIG.REFERRAL_TRIGGER_AT && !referrer.referralRewardGiven) {
            referrer.stars += GAME_CONFIG.REFERRAL_REWARD_STARS;
            referrer.referralRewardGiven = true;
            referrer.referralEarned += GAME_CONFIG.REFERRAL_REWARD_STARS;
            security.save('allUsers', allUsers);
            alert(t('referralEarnedMsg'));
        }
    },

    showGame() {
        document.getElementById('wallet-bar').style.display = 'flex';
        this.updateWallet();
        this.level = this.user.level || 1;
        this.lives = GAME_CONFIG.MAX_LIVES;
        this.mistakesInLevel = 0;
        this.levelsPassedInCycle = 0;
        this.showScreen('game-screen');
        this.startRound();
    },

    updateWallet() {
        document.getElementById('wallet-stars').textContent = this.user.stars;
        document.getElementById('wallet-cash').textContent = '' + this.user.cash;
    },

    generateRound() {
        const instructionType = Math.random() > 0.5 ? 'color' : 'word';
        const wordObj = this.colors[Math.floor(Math.random() * this.colors.length)];
        let colorObj = this.colors[Math.floor(Math.random() * this.colors.length)];
        while (colorObj.name === wordObj.name) { colorObj = this.colors[Math.floor(Math.random() * this.colors.length)]; }
        const correctAnswer = instructionType === 'color' ? colorObj.name : wordObj.name;
        const wrongAnswer = this.colors.find(c => c.name !== correctAnswer).name;
        const options = Math.random() > 0.5 ? [correctAnswer, wrongAnswer] : [wrongAnswer, correctAnswer];
        return {
            instruction: instructionType === 'color' ? t('chooseColor') : t('readWord'),
            word: wordObj.name, wordColor: colorObj.code,
            options: options, correctIndex: options.indexOf(correctAnswer)
        };
    },

    startRound() {
        this.currentRound = this.generateRound();
        this.timeLeft = GAME_CONFIG.LEVEL_TIME_MS;
        document.getElementById('instruction').textContent = this.currentRound.instruction;
        const wd = document.getElementById('word-display');
        wd.textContent = this.currentRound.word;
        wd.style.color = this.currentRound.wordColor;
        document.getElementById('btn1').textContent = this.currentRound.options[0];
        document.getElementById('btn2').textContent = this.currentRound.options[1];
        document.getElementById('btn1').className = 'answer-btn';
        document.getElementById('btn2').className = 'answer-btn';
        document.getElementById('level-display').textContent = this.level;
        document.getElementById('lives-display').textContent = '❤️ ' + this.lives;
        document.getElementById('mistakes-left').textContent = GAME_CONFIG.MISTAKES_FOR_SCRATCH - this.mistakesInLevel;
        this.startTimer();
    },

    startTimer() {
        clearInterval(this.timer);
        const start = Date.now();
        this.timer = setInterval(() => {
            const elapsed = Date.now() - start;
            this.timeLeft = Math.max(0, GAME_CONFIG.LEVEL_TIME_MS - elapsed);
            const pct = (this.timeLeft / GAME_CONFIG.LEVEL_TIME_MS) * 100;
            document.getElementById('timer-fill').style.width = pct + '%';
            if (this.timeLeft <= 0) { clearInterval(this.timer); this.handleWrong(); }
        }, 50);
    },

    checkAnswer(index) {
        clearInterval(this.timer);
        soundManager.play('click');
        const btn = document.getElementById('btn' + (index + 1));
        if (index === this.currentRound.correctIndex) {
            btn.classList.add('correct');
            this.showFeedback('✓', 'correct');
            soundManager.play('correct');
            setTimeout(() => this.handleCorrect(), 800);
        } else {
            btn.classList.add('wrong');
            this.showFeedback('✗', 'wrong');
            soundManager.play('wrong');
            setTimeout(() => this.handleWrong(), 800);
        }
    },

    handleCorrect() {
        this.mistakesInLevel++;
        this.levelsPassedInCycle++;
        // 2 levels passed = 1 star
        if (this.levelsPassedInCycle >= 2) {
            this.user.stars += GAME_CONFIG.STARS_PER_2_LEVELS;
            this.levelsPassedInCycle = 0;
            this.autoConvertStars();
            this.saveUser();
            this.updateWallet();
            this.showScreen('levelcomplete-screen');
            soundManager.play('win');
        } else {
            setTimeout(() => this.startRound(), 500);
        }
    },

    handleWrong() {
        this.lives--;
        this.mistakesInLevel++;
        if (this.lives <= 0) {
            // Check if should give scratch card
            if (this.mistakesInLevel >= GAME_CONFIG.MISTAKES_FOR_SCRATCH) {
                this.showGiftPack();
            } else {
                this.showScreen('gameover-screen');
            }
        } else {
            this.showScreen('gameover-screen');
        }
    },

    showFeedback(text, type) {
        const fb = document.getElementById('feedback');
        fb.textContent = text;
        fb.className = 'feedback show ' + type;
        setTimeout(() => fb.className = 'feedback', 600);
    },

    autoConvertStars() {
        if (this.user.stars >= GAME_CONFIG.STARS_FOR_10_RUPEES) {
            const sets = Math.floor(this.user.stars / GAME_CONFIG.STARS_FOR_10_RUPEES);
            this.user.stars -= sets * GAME_CONFIG.STARS_FOR_10_RUPEES;
            this.user.cash += sets * GAME_CONFIG.RUPEES_PER_100_STARS;
            setTimeout(() => alert(t('autoConvertMsg') + (sets * GAME_CONFIG.RUPEES_PER_100_STARS) + ' ' + t('rupees')), 500);
        }
    },

    showAd(type, callback) {
        this.adCallback = callback;
        const overlay = document.getElementById('ad-overlay');
        const timerEl = document.getElementById('ad-timer');
        overlay.classList.add('active');
        let timeLeft = 30;
        timerEl.textContent = timeLeft;
        const adTimer = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(adTimer);
                overlay.classList.remove('active');
                if (this.adCallback) this.adCallback();
            }
        }, 1000);
    },

    showAdAndRetry() {
        this.showAd('gameover', () => {
            this.lives = GAME_CONFIG.MAX_LIVES;
            this.showScreen('game-screen');
            this.startRound();
            soundManager.play('click');
        });
    },

    showGiftPack() {
        this.showScreen('gift-screen');
        soundManager.play('gift');
    },

    openGift() {
        this.showAd('gift', () => {
            this.showScreen('scratch-screen');
            this.initScratchCard();
            soundManager.play('gift');
        });
    },

    initScratchCard() {
        const canvas = document.getElementById('scratch-canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, 300, 150);
        ctx.fillStyle = '#666';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('', 150, 85);
        this.scratchPercent = 0;
        this.isScratching = false;
        const isBonus = this.user.scratchCards >= GAME_CONFIG.BONUS_THRESHOLD && Math.random() < GAME_CONFIG.SCRATCH_BONUS_CHANCE * 2;
        const reward = isBonus ? GAME_CONFIG.SCRATCH_BONUS_STARS : GAME_CONFIG.SCRATCH_DEFAULT_STARS;
        document.getElementById('scratch-amount').textContent = '+' + reward + ' ' + t('stars');
        canvas.onmousedown = (e) => { this.isScratching = true; this.scratch(e, canvas, ctx, reward); };
        canvas.onmousemove = (e) => { if (this.isScratching) this.scratch(e, canvas, ctx, reward); };
        canvas.onmouseup = () => { this.isScratching = false; };
        canvas.ontouchstart = (e) => { e.preventDefault(); this.isScratching = true; this.scratchTouch(e, canvas, ctx, reward); };
        canvas.ontouchmove = (e) => { e.preventDefault(); if (this.isScratching) this.scratchTouch(e, canvas, ctx, reward); };
        canvas.ontouchend = () => { this.isScratching = false; };
    },

    scratch(e, canvas, ctx, reward) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
        this.checkScratchComplete(reward);
    },

    scratchTouch(e, canvas, ctx, reward) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left, y = touch.clientY - rect.top;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
        this.checkScratchComplete(reward);
    },

    checkScratchComplete(reward) {
        const canvas = document.getElementById('scratch-canvas');
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, 300, 150).data;
        let transparent = 0;
        for (let i = 3; i < data.length; i += 4) { if (data[i] === 0) transparent++; }
        const pct = (transparent / (data.length / 4)) * 100;
        if (pct > 50 && this.scratchPercent <= 50) {
            this.scratchPercent = 100;
            soundManager.play('scratch');
            setTimeout(() => this.claimScratchReward(reward), 500);
        }
    },

    claimScratchReward(reward) {
        this.user.stars += reward;
        this.user.scratchCards++;
        this.mistakesInLevel = 0;
        this.lives = GAME_CONFIG.MAX_LIVES;
        this.autoConvertStars();
        this.saveUser();
        this.updateWallet();
        alert(t('scratchReward') + reward + ' ' + t('starsEarned'));
        this.checkReferralReward();
        this.showScreen('game-screen');
        this.startRound();
    },

    nextLevel() {
        this.level++;
        this.user.level = this.level;
        this.lives = GAME_CONFIG.MAX_LIVES;
        this.mistakesInLevel = 0;
        this.saveUser();
        this.showScreen('game-screen');
        this.startRound();
        soundManager.play('click');
    },

    showMenu() {
        document.getElementById('menu-name').textContent = this.user.name;
        document.getElementById('menu-mobile').textContent = this.user.mobile;
        document.getElementById('menu-stars').textContent = this.user.stars;
        document.getElementById('menu-cash').textContent = this.user.cash;
        document.getElementById('menu-referrals').textContent = this.user.referrals.length;
        document.getElementById('menu-scratch').textContent = this.user.scratchCards;
        this.showScreen('menu-screen');
    },

    showWithdraw() {
        document.getElementById('wd-stars').textContent = this.user.stars;
        document.getElementById('wd-cash').textContent = this.user.cash;
        this.qrDataUrl = null;
        document.getElementById('qr-preview').style.display = 'none';
        document.getElementById('wd-upi').value = '';
        this.showScreen('withdraw-screen');
    },

    handleQRUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.qrDataUrl = e.target.result;
            document.getElementById('qr-image').src = this.qrDataUrl;
            document.getElementById('qr-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    submitWithdraw() {
        const upi = document.getElementById('wd-upi').value.trim();
        if (!upi && !this.qrDataUrl) { alert(t('upiId') + ' / QR'); return; }
        if (this.user.cash < GAME_CONFIG.MIN_WITHDRAWAL_RUPEES) { alert(t('minCashRequired')); return; }
        const currentMonth = new Date().getMonth() + '-' + new Date().getFullYear();
        if (this.user.lastWithdrawalMonth === currentMonth) { alert(t('alreadyWithdrawn')); return; }
        const req = {
            id: 'WD_' + Date.now(), mobile: this.user.mobile, name: this.user.name,
            amount: this.user.cash, upi: upi, qrCode: this.qrDataUrl,
            status: 'pending', date: new Date().toLocaleString()
        };
        this.user.cash = 0;
        this.user.withdrawals.push(req);
        this.user.lastWithdrawalMonth = currentMonth;
        this.saveUser();
        const allWD = security.load('allWithdrawals') || [];
        allWD.push(req);
        security.save('allWithdrawals', allWD);
        this.updateWallet();
        alert(t('withdrawSuccess') + req.amount);
        this.showScreen('menu-screen');
    },

    showTransfer() {
        document.getElementById('tf-stars').textContent = '⭐ ' + this.user.stars + ' | ₹' + this.user.cash;
        this.showScreen('transfer-screen');
    },

    submitTransfer() {
        const mobile = document.getElementById('tf-mobile').value.trim();
        const amount = parseInt(document.getElementById('tf-amount').value);
        const type = document.getElementById('tf-type').value;
        if (!mobile || mobile.length !== 10 || !amount || amount <= 0) { alert(t('enterValidInfo')); return; }
        const allUsers = security.load('allUsers') || {};
        const target = allUsers[mobile];
        if (!target) { alert(t('userNotFound')); return; }
        if (type === 'stars' && this.user.stars < amount) { alert(t('notEnough')); return; }
        if (type === 'cash' && this.user.cash < amount) { alert(t('notEnough')); return; }
        if (type === 'stars') { this.user.stars -= amount; target.stars += amount; }
        else { this.user.cash -= amount; target.cash += amount; }
        allUsers[this.user.mobile] = this.user;
        allUsers[mobile] = target;
        security.save('allUsers', allUsers);
        security.save('currentUser', this.user);
        this.updateWallet();
        alert(t('transferSent') + '!');
        this.showScreen('menu-screen');
    },

    showReferral() {
        document.getElementById('ref-code').textContent = this.user.mobile;
        document.getElementById('ref-count').textContent = this.user.referrals.length;
        document.getElementById('ref-earned').textContent = this.user.referralEarned;
        this.showScreen('referral-screen');
    },

    copyRefCode() {
        navigator.clipboard.writeText(this.user.mobile).then(() => alert(t('codeCopied') + ': ' + this.user.mobile));
    },

    shareRef() {
        const text = t('referralMsg') + this.user.mobile + ' | https://moneymind.ekamgroup.com/?ref=' + this.user.mobile;
        if (navigator.share) navigator.share({ title: 'Money Mind', text: text });
        else alert(text);
    },

    adminLogin() {
        const pass = document.getElementById('admin-pass').value;
        if (pass === GAME_CONFIG.ADMIN_PASSWORD) {
            document.getElementById('admin-login-form').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            this.loadAdminData();
        } else { alert(t('wrongOTP')); }
    },

    loadAdminData() {
        const allUsers = security.load('allUsers') || {};
        const allWD = security.load('allWithdrawals') || [];
        let html = '<div style="max-height:200px;overflow-y:auto;">';
        Object.values(allUsers).forEach(u => {
            html += '<div style="background:rgba(255,255,255,0.05);padding:10px;margin:5px 0;border-radius:8px;">';
            html += '<b>' + u.name + '</b> (' + u.mobile + ')<br>';
            html += '⭐ ' + u.stars + ' | ₹' + u.cash + ' | ️ ' + u.scratchCards + ' |  ' + u.referrals.length;
            html += '</div>';
        });
        html += '</div>';
        document.getElementById('admin-users').innerHTML = html;
        let wdHtml = '';
        allWD.forEach(w => {
            wdHtml += '<div style="background:rgba(255,215,0,0.1);padding:10px;margin:5px 0;border-radius:8px;border-left:3px solid gold;">';
            wdHtml += '<b>' + w.name + '</b> (' + w.mobile + ') - ₹' + w.amount + '<br>';
            wdHtml += 'UPI: ' + (w.upi || '-') + ' | ' + w.date + '<br>';
            if (w.qrCode) wdHtml += '<img src="' + w.qrCode + '" style="max-width:150px;border-radius:8px;margin:5px 0;"><br>';
            wdHtml += 'Status: <b style="color:' + (w.status === 'pending' ? 'gold' : w.status === 'approved' ? 'lime' : 'red') + '">' + (t(w.status) || w.status) + '</b>';
            if (w.status === 'pending') {
                wdHtml += '<br><button onclick="game.approveWD(\'' + w.id + '\')" style="padding:5px 10px;background:lime;border:none;border-radius:5px;margin-top:5px;">' + t('approve') + '</button>';
                wdHtml += ' <button onclick="game.rejectWD(\'' + w.id + '\')" style="padding:5px 10px;background:red;color:white;border:none;border-radius:5px;">' + t('reject') + '</button>';
            }
            wdHtml += '</div>';
        });
        document.getElementById('admin-withdrawals').innerHTML = wdHtml || '<p>' + t('noRequests') + '</p>';
    },

    approveWD(id) {
        const allWD = security.load('allWithdrawals') || [];
        const wd = allWD.find(w => w.id === id);
        if (wd) {
            wd.status = 'approved';
            wd.approvedAt = Date.now();
            security.save('allWithdrawals', allWD);
            const allUsers = security.load('allUsers') || {};
            if (allUsers[wd.mobile]) {
                allUsers[wd.mobile].cash = 0;
                security.save('allUsers', allUsers);
            }
            alert(t('approve') + ': ' + wd.name + ' - ₹' + wd.amount);
            this.loadAdminData();
        }
    },

    rejectWD(id) {
        const allWD = security.load('allWithdrawals') || [];
        const wd = allWD.find(w => w.id === id);
        if (wd) {
            wd.status = 'rejected';
            security.save('allWithdrawals', allWD);
            const allUsers = security.load('allUsers') || {};
            if (allUsers[wd.mobile]) {
                allUsers[wd.mobile].cash += wd.amount;
                security.save('allUsers', allUsers);
            }
            alert(t('reject') + ' - ' + t('rejectedMsg'));
            this.loadAdminData();
        }
    },

    saveUser() {
        security.save('currentUser', this.user);
        const allUsers = security.load('allUsers') || {};
        allUsers[this.user.mobile] = this.user;
        security.save('allUsers', allUsers);
    },

    logout() {
        localStorage.removeItem('mm_currentUser');
        this.user = null;
        document.getElementById('wallet-bar').style.display = 'none';
        this.showScreen('lang-screen');
    }
};

window.game = game;
window.addEventListener('DOMContentLoaded', () => game.init());
