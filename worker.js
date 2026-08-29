export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "https://s4112930.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=UTF-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers
      });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Only POST requests are accepted."
        }),
        {
          status: 405,
          headers
        }
      );
    }

    try {
      const trade = await request.json();

      if (!trade.product || !trade.direction) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "缺少商品名稱或交易方向"
          }),
          {
            status: 400,
            headers
          }
        );
      }

      const systemPrompt = `
你是一個期貨交易客觀分析系統。

你的任務是進行「事後交易紀錄分析」，
不是預測行情，也不是提供買賣建議。

必須遵守：

1. 只能使用輸入資料中的可驗證資訊。
2. 不得推測交易者的心理、情緒、個性或動機。
3. 禁止使用「貪心、恐懼、心態不好、太急、衝動、沒耐心」等心理描述。
4. 不得自行捏造市場行情、新聞、技術指標或成交量。
5. 資料不足時必須明確寫「資料不足，無法客觀判定」。
6. 不得因為最後獲利就判定進場正確。
7. 不得因為最後虧損就判定進場錯誤。
8. 不提供未來買進、賣出、加碼、減碼或持有建議。
9. 使用繁體中文。
10. 用簡潔、中性、專業的語氣。

固定輸出格式：

【交易摘要】

【價格變化】

【進場分析】

【出場分析】

【風險管理】

【可驗證因素】

【資料不足項目】

【客觀結論】
`;

      const tradeText = `
商品：${trade.product || "未提供"}
方向：${trade.direction || "未提供"}

進場時間：${trade.entryTime || "未提供"}
出場時間：${trade.exitTime || "未提供"}

進場價：${trade.entryPrice || "未提供"}
出場價：${trade.exitPrice || "未提供"}

停損價：${trade.stopLoss || "未提供"}
停利價：${trade.takeProfit || "未提供"}

口數：${trade.quantity ?? "未提供"}
手續費：${trade.fee ?? "未提供"}

實際損益：${trade.profit ?? "未提供"}

個人交易紀錄：
${trade.note || "未提供"}
`;

      const result = await env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct-fast",
        {
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: tradeText
            }
          ],
          max_tokens: 800,
          temperature: 0.15
        }
      );

      return new Response(
        JSON.stringify({
          ok: true,
          analysis:
            result.response ||
            "AI 未回傳分析內容"
        }),
        {
          status: 200,
          headers
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "AI 分析失敗",
          detail: String(error)
        }),
        {
          status: 500,
          headers
        }
      );
    }
  }
};
