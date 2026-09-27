const ADS_CONFIG = {
    UNITY: {
        GAME_ID: "800379901",
        IS_TEST_MODE: false,  // ✅ ਅਸਲ ਐਡਸ - ਅਸਲ ਪੈਸੇ!
        PLACEMENTS: {
            BANNER: "BP_Banner_Android",
            INTERSTITIAL: "BP_Interstitial_Android",
            REWARDED: "BP_Rewarded_Android"
        }
    },
    STARTIO: {
        APP_ID: "208449971",
        IS_TEST_MODE: false,  // ✅ ਅਸਲ ਡਸ - ਅਸਲ ਪੈਸੇ!
        PLACEMENTS: { 
            BANNER: "Banner", 
            INTERSTITIAL: "Interstitial", 
            REWARDED: "Rewarded" 
        }
    },
    AD_MAPPING: {
        TOP_BANNER: "startio", 
        BOTTOM_BANNER: "unity",
        GAME_OVER_AD: "unity", 
        LEVEL_COMPLETE_AD: "startio",
        GIFT_OPEN_AD: "unity"
    }
};
