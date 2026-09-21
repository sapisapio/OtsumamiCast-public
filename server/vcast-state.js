const fs = require('fs').promises;
const crypto = require('crypto');

const PERSONALITY_DATA = {
  tiers: {
    strong: ['覇王', '神域', '不死鳥'],
    mid: ['雑に強い', '理不尽に優しい', '割と無敵', '目が笑っていない', 'たまに鋭い', '謎に強気'],
    weak: [
      '胃が弱い',
      '気圧で壊れる',
      '虚無顔',
      'だいたい眠い',
      '塩対応',
      'わりと適当',
      '顔が固い',
      'テンション迷子',
      'だいたい不機嫌',
      '笑ってるけど無反応',
      'ちょっと遅い'
    ]
  },
  weights: {
    strong_total: 0.1,
    mid_each: 0.15,
    weak_each: 0.0682
  },
  profiles: {
    覇王: {
      cap: 50,
      baseRange: [3, 4],
      variance: 3,
      moodShiftChance: 10,
      moodWeights: { good: 0.35, neutral: 0.5, bad: 0.15 },
      reactionTable: {
        good: { stroke: 16, massage: 18, rub: 14, lick: 18 },
        neutral: { stroke: 14, massage: 16, rub: 12, lick: 16 },
        bad: { stroke: 12, massage: 14, rub: 10, lick: 12 }
      }
    },
    神域: {
      cap: 50,
      baseRange: [3, 4],
      variance: 6,
      moodShiftChance: 20,
      moodWeights: { good: 0.4, neutral: 0.4, bad: 0.2 },
      reactionTable: {
        good: { stroke: 12, massage: 16, rub: 10, lick: 24 },
        neutral: { stroke: 10, massage: 12, rub: 8, lick: 16 },
        bad: { stroke: 6, massage: 8, rub: 5, lick: 6 }
      }
    },
    不死鳥: {
      cap: 50,
      baseRange: [3, 4],
      variance: 4,
      moodShiftChance: 15,
      moodWeights: { good: 0.3, neutral: 0.5, bad: 0.2 },
      reactionTable: {
        good: { stroke: 14, massage: 16, rub: 12, lick: 16 },
        neutral: { stroke: 12, massage: 14, rub: 10, lick: 14 },
        bad: { stroke: 10, massage: 12, rub: 8, lick: 12 }
      }
    },
    雑に強い: {
      cap: 20,
      baseRange: [2, 3],
      variance: 3,
      moodShiftChance: 15,
      moodWeights: { good: 0.3, neutral: 0.5, bad: 0.2 },
      reactionTable: {
        good: { stroke: 7, massage: 8, rub: 6, lick: 7 },
        neutral: { stroke: 6, massage: 7, rub: 5, lick: 6 },
        bad: { stroke: 4, massage: 5, rub: 3, lick: 4 }
      }
    },
    理不尽に優しい: {
      cap: 20,
      baseRange: [2, 3],
      variance: 4,
      moodShiftChance: 20,
      moodWeights: { good: 0.2, neutral: 0.5, bad: 0.3 },
      reactionTable: {
        good: { stroke: 6, massage: 7, rub: 5, lick: 6 },
        neutral: { stroke: 6, massage: 7, rub: 5, lick: 6 },
        bad: { stroke: 8, massage: 9, rub: 6, lick: 8 }
      }
    },
    割と無敵: {
      cap: 20,
      baseRange: [2, 3],
      variance: 2,
      moodShiftChance: 10,
      moodWeights: { good: 0.25, neutral: 0.6, bad: 0.15 },
      reactionTable: {
        good: { stroke: 7, massage: 7, rub: 6, lick: 7 },
        neutral: { stroke: 6, massage: 6, rub: 5, lick: 6 },
        bad: { stroke: 5, massage: 5, rub: 4, lick: 5 }
      }
    },
    目が笑っていない: {
      cap: 20,
      baseRange: [2, 3],
      variance: 5,
      moodShiftChance: 25,
      moodWeights: { good: 0.35, neutral: 0.35, bad: 0.3 },
      reactionTable: {
        good: { stroke: 8, massage: 10, rub: 7, lick: 11 },
        neutral: { stroke: 5, massage: 6, rub: 4, lick: 6 },
        bad: { stroke: 0, massage: 2, rub: 0, lick: 1 }
      }
    },
    たまに鋭い: {
      cap: 20,
      baseRange: [2, 3],
      variance: 6,
      moodShiftChance: 20,
      moodWeights: { good: 0.3, neutral: 0.4, bad: 0.3 },
      reactionTable: {
        good: { stroke: 6, massage: 9, rub: 5, lick: 10 },
        neutral: { stroke: 4, massage: 5, rub: 3, lick: 5 },
        bad: { stroke: 0, massage: 1, rub: 0, lick: 0 }
      }
    },
    謎に強気: {
      cap: 20,
      baseRange: [2, 3],
      variance: 4,
      moodShiftChance: 18,
      moodWeights: { good: 0.3, neutral: 0.45, bad: 0.25 },
      reactionTable: {
        good: { stroke: 7, massage: 8, rub: 6, lick: 9 },
        neutral: { stroke: 5, massage: 6, rub: 4, lick: 6 },
        bad: { stroke: 2, massage: 3, rub: 1, lick: 2 }
      }
    },
    胃が弱い: {
      cap: 6,
      baseRange: [1, 2],
      variance: 3,
      moodShiftChance: 35,
      moodWeights: { good: 0.2, neutral: 0.5, bad: 0.3 },
      reactionTable: {
        good: { stroke: 3, massage: 3, rub: 2, lick: 4 },
        neutral: { stroke: 2, massage: 2, rub: 1, lick: 2 },
        bad: { stroke: 0, massage: 1, rub: 0, lick: 0 }
      }
    },
    気圧で壊れる: {
      cap: 6,
      baseRange: [1, 2],
      variance: 4,
      moodShiftChance: 40,
      moodWeights: { good: 0.33, neutral: 0.34, bad: 0.33 },
      reactionTable: {
        good: { stroke: 3, massage: 4, rub: 2, lick: 4 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 0, rub: 0, lick: 0 }
      }
    },
    虚無顔: {
      cap: 6,
      baseRange: [1, 2],
      variance: 1,
      moodShiftChance: 10,
      moodWeights: { good: 0.2, neutral: 0.6, bad: 0.2 },
      reactionTable: {
        good: { stroke: 2, massage: 2, rub: 1, lick: 2 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 1, massage: 1, rub: 0, lick: 1 }
      }
    },
    だいたい眠い: {
      cap: 6,
      baseRange: [1, 2],
      variance: 2,
      moodShiftChance: 20,
      moodWeights: { good: 0.2, neutral: 0.6, bad: 0.2 },
      reactionTable: {
        good: { stroke: 2, massage: 3, rub: 1, lick: 2 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 1, rub: 0, lick: 0 }
      }
    },
    塩対応: {
      cap: 6,
      baseRange: [1, 2],
      variance: 2,
      moodShiftChance: 15,
      moodWeights: { good: 0.2, neutral: 0.6, bad: 0.2 },
      reactionTable: {
        good: { stroke: 2, massage: 2, rub: 2, lick: 2 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 0, rub: 0, lick: 0 }
      }
    },
    わりと適当: {
      cap: 6,
      baseRange: [1, 2],
      variance: 3,
      moodShiftChance: 25,
      moodWeights: { good: 0.25, neutral: 0.5, bad: 0.25 },
      reactionTable: {
        good: { stroke: 2, massage: 3, rub: 1, lick: 3 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 1, rub: 0, lick: 0 }
      }
    },
    顔が固い: {
      cap: 6,
      baseRange: [1, 2],
      variance: 2,
      moodShiftChance: 15,
      moodWeights: { good: 0.2, neutral: 0.6, bad: 0.2 },
      reactionTable: {
        good: { stroke: 2, massage: 2, rub: 1, lick: 2 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 0, rub: 0, lick: 0 }
      }
    },
    テンション迷子: {
      cap: 6,
      baseRange: [1, 2],
      variance: 4,
      moodShiftChance: 35,
      moodWeights: { good: 0.3, neutral: 0.4, bad: 0.3 },
      reactionTable: {
        good: { stroke: 3, massage: 4, rub: 2, lick: 3 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 0, rub: 0, lick: 0 }
      }
    },
    だいたい不機嫌: {
      cap: 6,
      baseRange: [1, 2],
      variance: 2,
      moodShiftChance: 15,
      moodWeights: { good: 0.15, neutral: 0.5, bad: 0.35 },
      reactionTable: {
        good: { stroke: 2, massage: 2, rub: 1, lick: 2 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 0, rub: 0, lick: 0 }
      }
    },
    笑ってるけど無反応: {
      cap: 6,
      baseRange: [1, 2],
      variance: 1,
      moodShiftChance: 10,
      moodWeights: { good: 0.2, neutral: 0.6, bad: 0.2 },
      reactionTable: {
        good: { stroke: 1, massage: 2, rub: 1, lick: 2 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 0, rub: 0, lick: 0 }
      }
    },
    ちょっと遅い: {
      cap: 6,
      baseRange: [1, 2],
      variance: 2,
      moodShiftChance: 12,
      moodWeights: { good: 0.2, neutral: 0.6, bad: 0.2 },
      reactionTable: {
        good: { stroke: 2, massage: 2, rub: 1, lick: 2 },
        neutral: { stroke: 1, massage: 1, rub: 1, lick: 1 },
        bad: { stroke: 0, massage: 0, rub: 0, lick: 0 }
      }
    }
  }
};

const PERSONALITIES = Object.keys(PERSONALITY_DATA.profiles);

const ACTIONS = ['stroke', 'massage', 'rub', 'lick'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function weightedChoice(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return entries[0]?.value;
  }
  let cursor = Math.random() * totalWeight;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.value;
    }
  }
  return entries[entries.length - 1]?.value;
}

function buildPersonalityWeights() {
  const weights = [];
  const strongWeight = PERSONALITY_DATA.weights.strong_total / PERSONALITY_DATA.tiers.strong.length;
  for (const name of PERSONALITY_DATA.tiers.strong) {
    weights.push({ value: name, weight: strongWeight });
  }
  for (const name of PERSONALITY_DATA.tiers.mid) {
    weights.push({ value: name, weight: PERSONALITY_DATA.weights.mid_each });
  }
  for (const name of PERSONALITY_DATA.tiers.weak) {
    weights.push({ value: name, weight: PERSONALITY_DATA.weights.weak_each });
  }
  return weights;
}

const PERSONALITY_WEIGHTS = buildPersonalityWeights();

function pickPersonality() {
  return weightedChoice(PERSONALITY_WEIGHTS) || PERSONALITIES[0];
}

function pickMood(weights) {
  const entries = Object.entries(weights).map(([value, weight]) => ({
    value,
    weight
  }));
  return weightedChoice(entries) || 'neutral';
}

function moodScoreFromLabel(label) {
  switch (label) {
    case 'good':
      return 1;
    case 'bad':
      return -1;
    default:
      return 0;
  }
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class VcastState {
  constructor(statePath, secretPath) {
    this.statePath = statePath;
    this.secretPath = secretPath;
    this.state = {
      totalPoints: 0,
      personality: pickPersonality(),
      moodScore: 0,
      lastUpdated: Date.now(),
      dailyDate: getLocalDateString(),
      dailyIps: []
    };
    this.secret = null;
  }

  async initialize() {
    await this.loadSecret();
    await this.loadState();
  }

  async loadSecret() {
    try {
      const data = await fs.readFile(this.secretPath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && parsed.secret) {
        this.secret = parsed.secret;
        return;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[VcastState] シークレット読み込み失敗:', error);
      }
    }

    this.secret = crypto.randomBytes(32).toString('hex');
    await fs.writeFile(
      this.secretPath,
      JSON.stringify({ secret: this.secret }, null, 2),
      'utf8'
    );
  }

  signState(state) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(state))
      .digest('hex');
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && parsed.payload && parsed.signature) {
        const signature = this.signState(parsed.payload);
        if (signature === parsed.signature) {
          this.state = parsed.payload;
          if (!this.state.personality || !PERSONALITY_DATA.profiles[this.state.personality]) {
            this.state.personality = pickPersonality();
          }
          return;
        }
        console.warn('[VcastState] 署名不一致のため初期化');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[VcastState] 状態読み込み失敗:', error);
      }
    }

    await this.saveState();
  }

  async saveState() {
    const payload = {
      ...this.state
    };
    const signature = this.signState(payload);
    await fs.writeFile(
      this.statePath,
      JSON.stringify({ payload, signature }, null, 2),
      'utf8'
    );
  }

  getState() {
    return {
      totalPoints: this.state.totalPoints,
      personality: this.state.personality,
      mood: this.getMoodLabel(),
      moodScore: this.state.moodScore
    };
  }

  getMoodLabel() {
    if (this.state.moodScore <= -1) return 'bad';
    if (this.state.moodScore >= 1) return 'good';
    return 'neutral';
  }

  isDailyAllowed(ip) {
    const today = getLocalDateString();
    if (this.state.dailyDate !== today) {
      this.state.dailyDate = today;
      this.state.dailyIps = [];
      return true;
    }
    return !this.state.dailyIps.includes(ip);
  }

  registerDailyIp(ip) {
    if (!this.state.dailyIps.includes(ip)) {
      this.state.dailyIps.push(ip);
    }
  }

  applyReaction(action, ip) {
    if (!ACTIONS.includes(action)) {
      throw new Error('不正なリアクションです');
    }

    const today = getLocalDateString();
    if (this.state.dailyDate !== today) {
      this.state.dailyDate = today;
      this.state.dailyIps = [];
    }

    if (!this.state.personality || !PERSONALITY_DATA.profiles[this.state.personality]) {
      this.state.personality = pickPersonality();
    }

    const profile = PERSONALITY_DATA.profiles[this.state.personality];
    let moodLabel = this.getMoodLabel();
    if (profile && profile.moodShiftChance) {
      const shiftRoll = Math.random() * 100;
      if (shiftRoll < profile.moodShiftChance) {
        moodLabel = pickMood(profile.moodWeights || { neutral: 1 });
        this.state.moodScore = moodScoreFromLabel(moodLabel);
      }
    }

    const base = profile ? randomInt(profile.baseRange[0], profile.baseRange[1]) : 1;
    const reactionScore = profile?.reactionTable?.[moodLabel]?.[action] ?? 0;
    const variance = profile?.variance ? randomInt(-profile.variance, profile.variance) : 0;
    let total = base + reactionScore + variance;
    const cap = profile?.cap ?? 6;
    total = clamp(total, 0, cap);

    this.state.totalPoints = clamp(this.state.totalPoints + total, 0, 999999);
    this.state.lastUpdated = Date.now();
    this.registerDailyIp(ip);

    return {
      points: total,
      mood: this.getMoodLabel(),
      personality: this.state.personality
    };
  }
}

module.exports = {
  VcastState,
  PERSONALITIES
};
