function getClientIp(ws) {
  const rawIp = ws?._socket?.remoteAddress || '';
  return rawIp.startsWith('::ffff:') ? rawIp.replace('::ffff:', '') : rawIp;
}

function validateOhinerimakiName(name) {
  if (!name || name.trim().length === 0) {
    return '名前を入力してください';
  }
  let length = 0;
  for (const char of name) {
    length += /[^\x01-\x7E]/.test(char) ? 2 : 1;
  }
  if (length > 12) {
    return '名前は全角6文字（半角12文字）以内にしてください';
  }
  return null;
}

function validateOhinerimakiAmount(amount, icon) {
  if (icon === 'gift') return null;
  const num = parseInt(amount, 10);
  if (Number.isNaN(num) || num < 1 || num > 50000) {
    return '金額は1〜50000円の範囲で入力してください';
  }
  return null;
}

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, maxLength);
}

function applyExtraHandlers(manager) {
  manager.getClientIp = getClientIp;
  manager.validateOhinerimakiName = validateOhinerimakiName;
  manager.validateOhinerimakiAmount = validateOhinerimakiAmount;

  manager.handleComment = function handleComment(ws, message) {
    const text = sanitizeText(message.text, 500);
    const username = sanitizeText(message.username || '匿名', 50);
    this.broadcast({
      type: 'comment',
      text,
      username,
      timestamp: Date.now()
    });
  };

  manager.handleOhinerimakiBell = async function handleOhinerimakiBell(ws, message) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo || !this.ohinerimakiConfig) return;

    const isTest = message.isTest === true && clientInfo.role === 'host';
    if (clientInfo.role !== 'viewer' && !isTest) {
      this.sendTo(ws, { type: 'error', message: 'リスナーのみ送信できます' });
      return;
    }

    const nameError = this.validateOhinerimakiName(message.name);
    if (nameError) {
      this.sendTo(ws, { type: 'error', message: nameError });
      return;
    }

    const icon = message.icon === 'money' ? 'money' : 'gift';
    const amountError = this.validateOhinerimakiAmount(message.amount, icon);
    if (amountError) {
      this.sendTo(ws, { type: 'error', message: amountError });
      return;
    }

    const ip = this.getClientIp(ws);
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;

    if (!isTest) {
      const lastSent = this.ohinerimakiRateLimit.get(ip);
      if (lastSent && now - lastSent < THIRTY_MINUTES) {
        this.sendTo(ws, { type: 'error', message: '30分以内の再送信はできません' });
        return;
      }
      this.ohinerimakiRateLimit.set(ip, now);
    }

    const { randomUUID } = require('crypto');
    const notification = {
      id: randomUUID(),
      name: message.name.trim(),
      icon,
      amount: icon === 'gift' ? null : parseInt(message.amount, 10),
      ip,
      timestamp: now
    };

    await this.ohinerimakiConfig.addNotification(notification);

    this.sendToHosts({
      type: 'ohinerimaki-bell',
      ...notification
    });
  };

  manager.handleOhinerimakiDelete = async function handleOhinerimakiDelete(ws, message) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo || clientInfo.role !== 'host' || !this.ohinerimakiConfig) {
      this.sendTo(ws, { type: 'error', message: 'ホストのみ削除できます' });
      return;
    }

    if (!message.id) {
      this.sendTo(ws, { type: 'error', message: '削除対象が不正です' });
      return;
    }

    await this.ohinerimakiConfig.deleteNotification(message.id);

    this.broadcast({
      type: 'ohinerimaki-deleted',
      id: message.id
    });
  };

  manager.handleVcastReaction = async function handleVcastReaction(ws, message) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo?.role !== 'viewer' || !this.vcastState) return;

    const action = message.action;
    const allowedActions = ['stroke', 'massage', 'rub', 'lick'];
    if (!allowedActions.includes(action)) {
      this.sendTo(ws, { type: 'error', message: '不正なリアクションです' });
      return;
    }

    const ip = this.getClientIp(ws);
    const isLocalhost =
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1';
    if (clientInfo.role === 'host' || isLocalhost) {
      this.sendTo(ws, { type: 'error', message: 'ホストのリアクションは無効です' });
      return;
    }
    if (clientInfo.role === 'viewer') {
      if (!this.vcastState.isDailyAllowed(ip)) {
        this.sendTo(ws, { type: 'error', message: 'ポイント送付は1日1回までです' });
        return;
      }
    }

    let result;
    try {
      result = this.vcastState.applyReaction(action, ip);
      await this.vcastState.saveState();
    } catch (error) {
      this.sendTo(ws, { type: 'error', message: error.message });
      return;
    }

    const payload = {
      type: 'vcast-reaction',
      action,
      points: result.points,
      mood: result.mood,
      personality: result.personality,
      totalPoints: this.vcastState.state.totalPoints
    };

    this.broadcast(payload);
  };

  manager.handleProfileConfigUpdated = function handleProfileConfigUpdated(ws, message) {
    const clientInfo = this.clients.get(ws);

    if (clientInfo?.role !== 'host') {
      console.log('❌ プロフィール更新拒否: ホストではありません');
      this.sendTo(ws, {
        type: 'error',
        message: 'ホストのみプロフィールを更新できます'
      });
      return;
    }

    const sanitizedConfig = this.profileConfig?.getPublic();
    if (!sanitizedConfig) {
      this.sendTo(ws, {
        type: 'error',
        message: 'プロフィール設定が不正です'
      });
      return;
    }

    console.log('📝 プロフィール設定更新をブロードキャスト');

    this.broadcast({
      type: 'profile-config-updated',
      config: sanitizedConfig
    }, ws);
  };
}

module.exports = applyExtraHandlers;
