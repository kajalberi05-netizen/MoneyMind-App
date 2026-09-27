class SecurityEngine {
    constructor() { this.key = GAME_CONFIG.ENCRYPTION_KEY; }
    encrypt(data) {
        const str = JSON.stringify(data);
        let r = '';
        for (let i = 0; i < str.length; i++) r += String.fromCharCode(str.charCodeAt(i) ^ this.key.charCodeAt(i % this.key.length));
        return btoa(r);
    }
    decrypt(enc) {
        try {
            const str = atob(enc); let r = '';
            for (let i = 0; i < str.length; i++) r += String.fromCharCode(str.charCodeAt(i) ^ this.key.charCodeAt(i % this.key.length));
            return JSON.parse(r);
        } catch (e) { return null; }
    }
    save(key, data) { localStorage.setItem('mm_' + key, this.encrypt(data)); }
    load(key) { const v = localStorage.getItem('mm_' + key); return v ? this.decrypt(v) : null; }
}
const security = new SecurityEngine();
