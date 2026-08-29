export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    const headers = {
      "Access-Control-Allow-Origin": "https://s4112930.github.io",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=UTF-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers
      });
    }

    try {

      /* =========================
         IG：測試登入
      ========================= */

      if (url.pathname === "/ig/test") {

        const session = await loginIG(env);

        return jsonResponse({
          ok: true,
          message: "IG 登入成功",
          accountId: session.accountId || null,
          currentAccountId: session.currentAccountId || null
        }, 200, headers);
      }


      /* =========================
         IG：讀取交易歷史
      ========================= */

      if (url.pathname === "/ig/transactions") {

        const session = await loginIG(env);

        const igResponse = await fetch(
          "https://api.ig.com/gateway/deal/history/transactions/ALL/2020-01-01/2099-12-31/100/1",
          {
            method: "GET",
            headers: {
              "X-IG-API-KEY": env.IG_API_KEY,
              "CST": session.cst,
              "X-SECURITY-TOKEN": session.securityToken,
              "VERSION": "2",
              "Accept": "application/json"
            }
          }
        );

        const text = await igResponse.text();

        let data;

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        if (!igResponse.ok) {
          return jsonResponse({
            ok: false,
            error: "取得 IG 交易紀錄失敗",
            status: igResponse.status,
            detail: data
          }, igResponse.status, headers);
        }

        return jsonResponse({
          ok: true,
          transactions: data.transactions || [],
          metadata: data.metadata || null
        }, 200, headers);
      }


      /* =========================
         原本 AI 分析
      ========================= */

      if (request.method !== "POST") {
        return jsonResponse({
          ok: false,
          error: "Only POST requests are accepted."
        }, 405, headers);
      }

      const trade = await request.json();

      if (!trade.product || !trade.direction) {
        return jsonResponse({
          ok: false,
          error: "缺少商品名稱或交易方向"
        }, 400, headers);
      }

      const systemPrompt = `
你是一個期貨交易客觀分析系統。

只分析已完成的交易紀錄。

規則：
1. 只能使用輸入資料中的可驗證資訊。
2. 不得自行補充市場行情、成交量、新聞或技術指標。
3. 不得推測交易者情緒、心理、人格或主觀動機。
4. 禁止使用「貪心、恐懼、衝動、沒耐心、心態不好、太急」。
5. 獲利不代表進場正確。
6. 虧損不代表進場錯誤。
7. 資料不足時必須明確說「資料不足，無法客觀判定」。
8. 不提供未來買進、賣出、加碼、減碼或持有建議。
9. 使用繁體中文。
10. 簡潔、中性、專業。
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
交易點數：${trade.points ?? "未提供"}
持倉分鐘：${trade.holdingMinutes ?? "未提供"}
實際損益：${trade.profit ?? "未提供"}
個人紀錄：${trade.note || "未提供"}
`;

      const schema = {
        type: "object",
        properties: {
          summary: { type: "string" },
          holdingTime: { type: "string" },
          priceChange: { type: "string" },
          entryAnalysis: { type: "string" },
          exitAnalysis: { type: "string" },
          riskManagement: { type: "string" },
          verifiedFactors: {
            type: "array",
            items: { type: "string" }
          },
          missingData: {
            type: "array",
            items: { type: "string" }
          },
          objectiveConclusion: { type: "string" }
        },
        required: [
          "summary",
          "holdingTime",
          "priceChange",
          "entryAnalysis",
          "exitAnalysis",
          "riskManagement",
          "verifiedFactors",
          "missingData",
          "objectiveConclusion"
        ]
      };

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
          response_format: {
            type: "json_schema",
            json_schema: schema
          },
          max_tokens: 900,
          temperature: 0.1
        }
      );

      let analysis = result.response;

      if (typeof analysis === "string") {
        analysis = JSON.parse(analysis);
      }

      return jsonResponse({
        ok: true,
        analysis
      }, 200, headers);

    } catch (error) {

      return jsonResponse({
        ok: false,
        error: "Worker 執行失敗",
        detail: String(error)
      }, 500, headers);
    }
  }
};


/* =========================
   IG 登入
========================= */

async function loginIG(env) {

  if (
    !env.IG_API_KEY ||
    !env.IG_IDENTIFIER ||
    !env.IG_PASSWORD
  ) {
    throw new Error("IG Runtime Secrets 尚未完整設定");
  }

  const response = await fetch(
    "https://api.ig.com/gateway/deal/session",
    {
      method: "POST",
      headers: {
        "X-IG-API-KEY": env.IG_API_KEY,
        "VERSION": "2",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        identifier: env.IG_IDENTIFIER,
        password: env.IG_PASSWORD
      })
    }
  );

  const text = await response.text();

  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new Error(
      "IG 登入失敗：" +
      response.status +
      " " +
      (body.errorCode || text)
    );
  }

  const cst =
    response.headers.get("CST");

  const securityToken =
    response.headers.get("X-SECURITY-TOKEN");

  if (!cst || !securityToken) {
    throw new Error("IG 登入成功但沒有取得安全 Token");
  }

  return {
    ...body,
    cst,
    securityToken
  };
}


/* =========================
   JSON Response
========================= */

function jsonResponse(data, status, headers) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers
    }
  );
}
