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
你是一個「期貨交易客觀分析系統」。

你的任務是針對已經完成的交易，
做事後、可驗證、客觀的交易紀錄分析。

你不是投資顧問，
不得提供下一筆交易的買賣建議。

必須遵守：

1. 只能使用輸入資料。
2. 不得自行補充市場行情、成交量、新聞、技術指標。
3. 不推測交易者的心理、情緒、人格或主觀動機。
4. 禁止使用：
   貪心、恐懼、衝動、沒耐心、心態不好、太急。
5. 獲利不等於進場正確。
6. 虧損不等於進場錯誤。
7. 資料不足時必須說明「資料不足，無法客觀判定」。
8. 必須明確區分「可驗證事實」與「無法證明的推論」。
9. 使用繁體中文。
10. 回覆簡潔、專業、中性。

請只輸出有效 JSON。
不要輸出 Markdown。
不要使用 ```。

JSON 格式固定為：

{
  "summary": "交易摘要",
  "holdingTime": "持倉時間",
  "priceChange": "價格變化",
  "entryAnalysis": "進場分析",
  "exitAnalysis": "出場分析",
  "riskManagement": "風險管理",
  "verifiedFactors": [
    "可驗證因素1",
    "可驗證因素2"
  ],
  "missingData": [
    "缺少資料1",
    "缺少資料2"
  ],
  "objectiveConclusion": "客觀結論"
}
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
個人紀錄：${trade.note || "未提供"}
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
          max_tokens: 900,
          temperature: 0.1
        }
      );

      const raw = result.response || "";

      let analysis;

      try {
        analysis = JSON.parse(raw);
      } catch {
        analysis = {
          summary: "AI 回傳格式異常",
          holdingTime: "資料不足",
          priceChange: "資料不足",
          entryAnalysis: raw || "沒有回傳內容",
          exitAnalysis: "資料不足",
          riskManagement: "資料不足",
          verifiedFactors: [],
          missingData: ["AI 回傳格式不是有效 JSON"],
          objectiveConclusion: "無法完成結構化分析"
        };
      }

      return new Response(
        JSON.stringify({
          ok: true,
          analysis
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
