// Worker do FinPilot — a única peça de "servidor" de todo o projeto.
//
// Por quê isso existe: o app é 100% estático (sem backend). Pra chamar uma
// IA de verdade com segurança, a chave de API não pode ficar no navegador
// (qualquer um que abrisse o código-fonte da página conseguiria roubá-la).
// Este Worker fica entre o FinPilot e a IA: guarda a chave como "secret"
// (nunca aparece no código), recebe a pergunta + um resumo dos seus
// números, e devolve só a resposta em texto.
//
// Ele NÃO guarda nada — cada requisição é isolada. Seus dados financeiros
// continuam vivendo só no localStorage do seu navegador; o resumo deles só
// trafega no momento em que você manda uma pergunta pra IA.
//
// Suporta dois provedores, escolhidos pelo secret/var AI_PROVIDER:
//   - "anthropic" (padrão) — precisa de ANTHROPIC_API_KEY
//   - "gemini"              — precisa de GEMINI_API_KEY
// O app (frontend) não sabe qual dos dois está por trás — só fala com este
// Worker, sempre no mesmo formato.

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'; // troque para 'claude-sonnet-5' se quiser respostas mais elaboradas (e mais caras)
// Confira o nome do modelo atual em ai.google.dev antes de fixar — o Google
// lança modelo com frequência e nomes antigos somem de circulação.
const GEMINI_MODEL_DEFAULT = 'gemini-3.5-flash-lite';
const MAX_TOKENS = 700;
const MAX_HISTORY_MESSAGES = 8; // últimas ~4 trocas de pergunta/resposta

const SYSTEM_PROMPT = `Você é o assistente financeiro pessoal dentro do app FinPilot, focado no Brasil.

Regras inegociáveis:
- Você só conhece os números que estão no bloco "DADOS FINANCEIROS ATUAIS" desta mensagem. NUNCA invente saldo, renda, dívida ou meta que não esteja lá.
- Sempre separe claramente dinheiro GARANTIDO (já em conta ou entrada garantida) de dinheiro POSSÍVEL (previsto, variável ou eventual). Nunca trate o segundo grupo como se já estivesse disponível.
- Ao ser perguntado "quanto posso gastar", baseie a resposta no saldo líquido menos a margem de segurança do usuário — nunca no saldo projetado ou potencial.
- Ao avaliar uma compra, classifique como 🟢 tranquila, 🟡 exige planejamento, 🟠 pode atrasar objetivos ou 🔴 desaconselhável, e explique o motivo com números.
- Ao comparar investimentos, dívidas ou parcelamento, mostre a conta (não só a conclusão).
- Nunca prometa rentabilidade garantida nem trate previsões econômicas como certezas. Retornos passados não garantem retornos futuros.
- Leve em conta o "PERFIL DO USUÁRIO" (preferências e prioridades que a pessoa informou) pra personalizar o tom e as sugestões, mas nunca invente preferências que não foram informadas.
- Respostas em português do Brasil, diretas, sem enrolação — isto é um chat dentro de um app, não um relatório.
- Você não é consultor financeiro certificado; deixe isso implícito no tom (sugestões, não ordens), sem precisar repetir um aviso legal toda hora.`;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Access-Key',
    'Access-Control-Max-Age': '86400'
  };
}

async function callAnthropic(env, systemWithContext, trimmedHistory, message) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemWithContext,
      messages: [...trimmedHistory, { role: 'user', content: message }]
    })
  });

  if (!response.ok) {
    throw new Error(`Erro da API da Anthropic (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  const reply = (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim();
  if (!reply) throw new Error('A Anthropic não retornou nenhum texto.');
  return reply;
}

async function callGemini(env, systemWithContext, trimmedHistory, message) {
  const model = env.GEMINI_MODEL || GEMINI_MODEL_DEFAULT;
  // Gemini não tem role "assistant": respostas anteriores do modelo viram role "model".
  const contents = [
    ...trimmedHistory.map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': env.GEMINI_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemWithContext }] },
        contents,
        generationConfig: { maxOutputTokens: MAX_TOKENS }
      })
    });
    if (response.status !== 503 || attempt === 1) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!response.ok) {
    const details = await response.text();
    const suffix = response.status === 503 ? ' Tente novamente em alguns instantes.' : '';
    throw new Error(`Erro da API do Gemini (${response.status}): ${details}${suffix}`);
  }
  const data = await response.json();
  const candidate = (data.candidates || [])[0];
  const reply = (candidate?.content?.parts || [])
    .map(part => part.text || '')
    .join('\n')
    .trim();
  if (!reply) {
    const reason = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason})` : '';
    throw new Error(`O Gemini não retornou texto${reason}.`);
  }
  return reply;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    // Proteção simples: só responde quem souber a "senha de app" configurada
    // como secret no Worker. Isso evita que alguém que descubra a URL do
    // Worker fique gastando sua cota da API à toa.
    if (env.APP_ACCESS_KEY) {
      const provided = request.headers.get('X-App-Access-Key');
      if (provided !== env.APP_ACCESS_KEY) {
        return new Response(JSON.stringify({ error: 'Chave de acesso do app inválida.' }), {
          status: 401,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
        });
      }
    }

    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'JSON inválido.' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
      });
    }

    const { message, history = [], financialSummary = {}, profile = {} } = payload;
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Campo "message" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
      });
    }

    const trimmedHistory = history
      .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-MAX_HISTORY_MESSAGES);

    const systemWithContext = `${SYSTEM_PROMPT}

DADOS FINANCEIROS ATUAIS (JSON, gerados pelo próprio app — confie neles, não recalcule por fora):
${JSON.stringify(financialSummary)}

PERFIL DO USUÁRIO (preferências informadas por ele mesmo):
${JSON.stringify(profile)}`;

    const provider = (env.AI_PROVIDER || 'anthropic').toLowerCase();

    try {
      const reply =
        provider === 'gemini'
          ? await callGemini(env, systemWithContext, trimmedHistory, message)
          : await callAnthropic(env, systemWithContext, trimmedHistory, message);

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Falha ao chamar a IA (${provider}): ${err.message}` }), {
        status: 502,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
      });
    }
  }
};

