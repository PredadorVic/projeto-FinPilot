# FinPilot v5 — Painel Financeiro Pessoal

Continua sendo um app 100% local por padrão: sem servidor próprio, sem
conta, sem nuvem. Os dados moram no `localStorage` do seu navegador. A
diferença é que agora o código está organizado em módulos, testado
automaticamente, e o app ganhou simuladores financeiros de verdade,
backup, confirmações antes de excluir, um instalável como PWA e — se você
quiser configurar — um Assistente com IA de verdade (ver seção própria
abaixo; continua opcional e o app inteiro funciona sem isso).

## Seus dados da v4 não são perdidos

Ao abrir a v5 pela primeira vez, o app procura automaticamente os dados
salvos pela v4 (e v3) e migra tudo pra o novo formato, preenchendo só os
campos novos (histórico de patrimônio, preferências dos simuladores) com
valores vazios. Nenhum dado que você já cadastrou é apagado.

## Como rodar

Como o código agora usa módulos ES (`import`/`export`), o navegador exige que
os arquivos sejam servidos por **http://**, não abertos direto como arquivo
(`file://`). Duas formas simples:

1. **VS Code + Live Server** (é o que o `painel_financeiro.code-workspace`
   já espera): clique com o botão direito em `index.html` → **Open with Live
   Server**.
2. **Sem VS Code**: dentro da pasta do projeto, rode
   `python3 -m http.server 8080` e abra `http://localhost:8080` no navegador.

Não é necessário instalar nada (`npm install`) só para *usar* o app — ele
continua sem nenhuma dependência de terceiros em produção.

## Rodando os testes

```
npm test
```

Isso usa o test runner nativo do Node (`node --test`, Node 18+), sem
instalar nenhuma dependência. Os testes cobrem:

- o motor de dias úteis e recorrência de renda (dia fixo, 1º/5º/último dia
  útil considerando feriados, semanal, quinzenal, anual);
- os cálculos de saldo seguro / projetado / potencial máximo;
- os 5 novos simuladores financeiros (matemática de juros compostos, IR
  regressivo, etc.);
- o resumo financeiro que seria enviado pra IA (sem fazer nenhuma chamada de
  rede de verdade — isso só é testado manualmente, já que depende do Worker
  publicado);
- migração e backup (exportar/importar).

## Estrutura de pastas

```
index.html
manifest.webmanifest       PWA: nome, ícones, cores
service-worker.js          cache do app shell pra funcionar offline
worker/                    proxy opcional pra IA (ver seção abaixo) — só é
                            necessário se você quiser IA de verdade
css/styles.css
js/
  main.js                  monta a página, navegação, tema, alertas
  store.js                 estado em memória + gatilho de re-render
  state.js                 formato dos dados, migração v4→v5, backup
  ui.js                    modal, diálogo de confirmação, chips
  utils.js                 formatação de moeda/data, helpers puros
  ai.js                    resumo financeiro pra IA + chamada ao Worker
  recurrence.js            dias úteis + ocorrências de renda recorrente
  calculations.js          saldo seguro/projetado, totais do mês
  simulators.js            os 5 motores de cálculo dos simuladores
  charts.js                gráficos em SVG (sem biblioteca externa)
  views/                   uma função de render por aba
  actions/                 um arquivo por domínio (contas, renda, cartões,
                            assistente/IA...)
tests/                     testes automatizados (node --test)
icons/, scripts/           ícones do PWA e o script que os gerou
```

## Os 5 simuladores novos (aba "Simulações")

Nenhum vem com taxa pré-preenchida com valor de mercado — informe a taxa
atual (o comparador de renda fixa já tem um texto lembrando de conferir) e
trate os resultados como estimativa, não como promessa.

1. **Juros compostos** — projeta um aporte mensal em 3 cenários
   (conservador/provável/otimista) e mostra o valor também em poder de
   compra de hoje (descontando a inflação informada).
2. **Posso comprar? / Parcelado x à vista** — agora com 4 níveis
   (🟢🟡🟠🔴, antes eram só 3), calcula o juro embutido no parcelamento por
   trás dos panos e diz matematicamente se compensa mais pagar à vista ou
   parcelar e investir a diferença.
3. **Quitar dívida x investir** — compara o juro que você deixaria de pagar
   quitando com o retorno que o mesmo dinheiro renderia investido.
4. **Aposentadoria / independência financeira** — calcula o capital
   necessário (em valor de hoje e corrigido pela inflação), e o aporte
   mensal necessário ou se o aporte que você já faz está no caminho certo.
5. **Comparador de renda fixa** — compara até 3 opções aplicando a tabela
   regressiva real de IR (22,5% a 15%) e o tratamento de isenção de
   LCI/LCA, mostrando o retorno líquido e real anualizado de cada uma.

## Assistente com IA de verdade (opcional)

Por padrão o Assistente continua com respostas fixas, como sempre foi. Se
quiser conectar uma IA de verdade (que entende perguntas livres e já
enxerga seus números reais), tem uma peça extra pra configurar — porque um
app 100% estático não pode guardar uma chave de API com segurança sozinho.

O Worker (a peça extra) suporta **Anthropic ou Gemini** — você escolhe. O
app (frontend) não muda em nenhum dos dois casos; só fala com o Worker.

### 1. Escolha o provedor e consiga uma chave

- **Anthropic**: crie uma chave em
  [console.anthropic.com](https://console.anthropic.com).
- **Gemini**: crie uma chave gratuita em
  [aistudio.google.com](https://aistudio.google.com/apikey).

Os dois têm custo por uso conforme o volume de perguntas (a Anthropic
sempre cobra; o Gemini tem uma camada gratuita limitada e depois cobra).
Confira o preço atual na página oficial de cada um antes de decidir — os
dois lançam modelo novo com frequência e o preço muda junto.

### 2. Publique o Worker

Dentro da pasta `worker/`:

```
npm install -g wrangler   # só na primeira vez
wrangler login
wrangler deploy
```

Se for usar Gemini, abra `worker/wrangler.toml` antes do deploy e troque
`AI_PROVIDER = "anthropic"` por `AI_PROVIDER = "gemini"`.

Depois do primeiro deploy, configure os segredos (a chave nunca fica no
código-fonte):

```
# Se escolheu Anthropic:
wrangler secret put ANTHROPIC_API_KEY

# Se escolheu Gemini:
wrangler secret put GEMINI_API_KEY

# Recomendado nos dois casos — sua própria senha de acesso ao Worker,
# pra evitar que outra pessoa use sua cota se descobrir a URL:
wrangler secret put APP_ACCESS_KEY
```

O comando `wrangler deploy` mostra a URL final, algo como
`https://finpilot-ai.SEU-USUARIO.workers.dev`.

### 3. Conecte no FinPilot

Abra o app → ícone do avatar (perfil) → cole a URL em **"URL do endpoint de
IA"** e, se configurou `APP_ACCESS_KEY`, a mesma senha em **"Senha de
acesso do app"**. Salve. (O app não precisa saber qual provedor você
escolheu — isso fica só na configuração do Worker.)

### 4. Conte suas preferências pra IA (opcional, mas recomendado)

Na aba Assistente, clique em **"Configurar perfil"**. O que você escrever
ali (o que gosta de gastar, prioridades, estilo) é enviado junto com seus
números reais a cada pergunta — isso é o que faz a IA responder de forma
personalizada, não genérica.

### O que a IA recebe e o que ela nunca vê

A cada pergunta, o app monta um resumo (saldo, garantido a receber, gasto
do mês, metas, cartões — tudo já calculado pelo próprio FinPilot) e manda
junto com sua pergunta e seu perfil. **Isso sai do seu navegador e vai para
a API da Anthropic.** Se isso for um problema pra você, não configure essa
parte — o resto do app continua funcionando 100% local, sem nenhuma
chamada de rede. A conversa (só o texto, não o resumo financeiro) fica
guardada no seu `localStorage` pra a IA lembrar do contexto entre
mensagens; ela não é enviada a nenhum outro lugar além do Worker que você
mesmo publicou.

## Decisões conscientes (e por quê)

- **Sem busca automática de taxas (Selic/CDI/IPCA) pela internet.** Daria
  pra integrar uma API pública, mas isso tornaria o app dependente de rede
  e de um contrato de API que pode mudar. Preferi manter os simuladores
  100% confiáveis offline; cada um deixa claro onde conferir a taxa atual.
- **Gráficos em SVG feitos à mão, sem biblioteca externa.** Mantém o app
  leve e 100% funcional offline (inclusive dentro do cache do service
  worker), sem depender de um CDN.
- **O Assistente não foi alterado.** Continua sendo respostas fixas por
  palavra-chave, exatamente como na v4 — combinado diretamente com você.
- **Sem build step.** Módulos ES nativos em vez de bundler: continua sendo
  "abrir com Live Server", só que agora servido por http (ver acima).

## Backup dos seus dados

No perfil (ícone do avatar) não há mais essa opção — ela agora fica junto
das ações de dados: exportar baixa um `.json` com tudo; importar substitui
os dados atuais pelo conteúdo de um backup (com confirmação antes de
sobrescrever). Vale o hábito de exportar de vez em quando, já que tudo vive
só no navegador.
