// api/monitor-tvl.js - シンプル版（前回値は環境変数で管理）

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // クエリパラメータから前回のTVLを取得（初回は0）
    const lastTvl = parseFloat(req.query.lastTvl || '0');
    
    // Liminal APIからTVLを取得
    const response = await fetch('https://api.liminal.money/api/info/tvl');
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Failed to fetch TVL data');
    }
    
    const currentTvl = data.data.totalValueLocked;
    const userCount = data.data.userCount;
    
    console.log(`Current TVL: $${currentTvl.toLocaleString()}`);
    console.log(`Previous TVL: $${lastTvl.toLocaleString()}`);
    
    // TVLが1でも増えた場合、Webhook通知を送信
    if (currentTvl > lastTvl) {
      const increase = currentTvl - lastTvl;
      const increasePercentage = lastTvl > 0 ? ((increase / lastTvl) * 100).toFixed(4) : '∞';
      
      await sendWebhookNotification({
        currentTvl,
        previousTvl: lastTvl,
        increase,
        increasePercentage,
        userCount,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(200).json({
      success: true,
      currentTvl,
      lastTvl,
      increased: currentTvl > lastTvl,
      userCount,
      difference: currentTvl - lastTvl,
      message: currentTvl > lastTvl ? 'TVL increased! Notification sent.' : 'No increase detected.'
    });
    
  } catch (error) {
    console.error('Error monitoring TVL:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function sendWebhookNotification(data) {
  const webhookUrl = 'https://discord.com/api/webhooks/1382033846089945233/bhBzDWz1mmvP5jYTZ161RzIzIb7ecCx3BgnJTpuvH8QblxLo6dZRiX2DyFBLZyGfolZI';
  
  const payload = {
    content: '@everyone', // @everyoneメンション
    embeds: [{
      title: "🚀 Liminal Protocol TVL増加検出！",
      description: "TVLの増加を検出しました",
      color: 0x00ff00,
      fields: [
        {
          name: "💰 現在のTVL",
          value: `$${data.currentTvl.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
          inline: true
        },
        {
          name: "📊 前回のTVL",
          value: `$${data.previousTvl.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
          inline: true
        },
        {
          name: "📈 増加額",
          value: `+$${data.increase.toLocaleString('en-US', { maximumFractionDigits: 2 })} (+${data.increasePercentage}%)`,
          inline: true
        },
        {
          name: "👥 ユーザー数",
          value: data.userCount.toLocaleString(),
          inline: true
        },
        {
          name: "🕒 検出時刻",
          value: new Date(data.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
          inline: true
        }
      ],
      timestamp: data.timestamp,
      footer: {
        text: "Liminal TVL Monitor",
        icon_url: "https://staging.liminal.money/assets/HYPE.svg"
      }
    }]
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('Discord webhook notification sent successfully');
    } else {
      const errorText = await response.text();
      console.error('Failed to send Discord webhook:', response.status, errorText);
    }
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
}