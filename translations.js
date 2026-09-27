const TRANSLATIONS = {
    pa: { name: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
    hi: { name: "हिन्दी", flag: "🇮🇳" },
    en: { name: "English", flag: "🌍" },
    ur: { name: "اردو", flag: "🇵🇰" }
};

let CURRENT_LANG = localStorage.getItem('mm_lang') || 'pa';

function t(key) { 
    return (TRANSLATIONS[CURRENT_LANG] && TRANSLATIONS[CURRENT_LANG][key]) || key; 
}

function setLanguage(lang) { 
    CURRENT_LANG = lang; 
    localStorage.setItem('mm_lang', lang); 
    showScreen('login-screen');
}

function buildLanguageGrid() {
    const grid = document.getElementById('lang-grid');
    if (!grid) {
        console.error('lang-grid not found!');
        return;
    }
    grid.innerHTML = '';
    Object.keys(TRANSLATIONS).forEach(code => {
        const lang = TRANSLATIONS[code];
        const btn = document.createElement('button');
        btn.className = 'lang-btn';
        btn.style.padding = '15px';
        btn.style.margin = '5px';
        btn.style.fontSize = '16px';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `<span>${lang.flag}</span> <span>${lang.name}</span>`;
        btn.onclick = () => { setLanguage(code); };
        grid.appendChild(btn);
    });
    console.log('Language grid built successfully!');
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
}

// ਜਿਵੇਂ ਹੀ ਪੇਜ ਲੋਡ ਹੋਵੇ, ਭਾਸ਼ਾ ਦੇ ਬਟਨ ਬਣਾਓ
window.addEventListener('DOMContentLoaded', () => {
    buildLanguageGrid();
});