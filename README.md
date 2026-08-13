# Assistente de Baterias

Assistente de balcão que responde **qual bateria serve no carro do cliente**. O
usuário escreve em linguagem natural ("gol 2014 1.0", "tem bateria pro T-Cross?")
e recebe o SKU, as specs (Ah, CCA, polaridade, tecnologia), as dimensões e os
avisos que realmente se aplicam — apresentados num card no estilo painel de
instrumentos.

> **A regra de ouro:** o modelo de linguagem interpreta a pergunta e formata a
> resposta, mas **nunca inventa uma bateria**. Toda spec vem de uma consulta SQL
> determinística ao catálogo. Se o banco não devolve nada, o assistente diz que
> não encontrou e pede mais detalhes — não chuta.

## Como funciona

```
Pergunta em linguagem natural
        │
        ▼
  POST /api/consultar ──► rate limit ──► validação do corpo
        │
        ▼
     Claude  ──── tool_use ────►  RPC buscar_bateria (Postgres/Supabase)
        │                                  │
        │◄──────── linhas do banco ────────┘
        ▼
  { resposta, dados }  ──►  UI: texto do modelo + card montado a partir de `dados`
```

O que garante a regra de ouro é o **tool use**: a única forma de o Claude obter
uma bateria é chamar `buscar_bateria`, que executa SQL parametrizado. Ele não
escreve SQL nem recebe acesso ao banco — só preenche quatro parâmetros
(`modelo`, `ano`, `motor`, `marca`). E o card na tela é renderizado a partir de
`dados` (as linhas cruas do banco), não do texto gerado: mesmo que o modelo
errasse ao redigir, os números exibidos continuariam sendo os do catálogo.

Comportamentos que valem citar:

- **Start-stop.** Carro com start-stop exige EFB ou AGM; bateria comum degrada
  em poucos meses. Quando `start_stop` é `true`, a resposta traz o alerta em
  destaque. Quando é `false`, o assunto não é mencionado — nem para dizer que
  não se aplica.
- **Desambiguação.** "Gol" pode casar com várias gerações. Nesse caso o
  assistente não escolhe: lista as opções em chips clicáveis. Clicar num chip
  usa os dados que já vieram na resposta, **sem nova chamada ao modelo**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Anthropic SDK
(`claude-sonnet-5`) · Supabase (Postgres) · CSS puro, sem framework.

## Rodando localmente

Você precisa das **suas próprias** credenciais — nenhuma chave acompanha este
repositório.

**1. Dependências** (Node 20.9+)

```bash
npm ci
```

**2. Banco de dados**

Crie um projeto em [supabase.com](https://supabase.com), abra o **SQL Editor** e
rode [`supabase/schema.sql`](supabase/schema.sql) inteiro. Ele cria as três
tabelas, a função `buscar_bateria`, as políticas de RLS e insere alguns veículos
de exemplo (fictícios — troque pelo seu catálogo).

**3. Variáveis de ambiente**

```bash
cp .env.example .env.local
```

Preencha as três chaves; o arquivo tem instruções em cada uma. Precisa de uma
chave da Anthropic ([console.anthropic.com](https://console.anthropic.com/settings/keys))
e da URL + chave do projeto Supabase.

**4. Subir**

```bash
npm run dev
```

Abra [localhost:3000](http://localhost:3000). Sem as variáveis configuradas o
app sobe normalmente e o endpoint responde `503` com a instrução — não quebra
com stack trace.

### Scripts

| Comando             | O que faz                        |
| ------------------- | -------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento      |
| `npm run build`     | Build de produção                |
| `npm start`         | Sobe o build de produção         |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | `tsc --noEmit`                   |

## Estrutura

```
app/
  api/consultar/route.ts   Laço do agente: valida, chama o Claude, executa a tool
  layout.tsx               Fontes (next/font), metadata, idioma
  page.tsx                 Estado do chat e composição da tela
  globals.css              Todo o design system
components/                Cluster (card), BotMessage, ícones, hooks
lib/
  types.ts                 Contrato compartilhado backend ↔ UI
  validacao.ts             Saneamento do corpo do request
  rate-limit.ts            Limite por IP
  env.ts                   Leitura das variáveis de ambiente
  format.ts                Helpers de apresentação
supabase/schema.sql        Tabelas, RPC, RLS e dados de exemplo
```

## Segurança

Decisões que valem explicitar, já que o endpoint é público e **cada requisição
gasta tokens pagos**:

- **Chaves só no servidor.** `ANTHROPIC_API_KEY` e as credenciais do Supabase
  são lidas apenas em `app/api/consultar/route.ts`. Nenhuma usa o prefixo
  `NEXT_PUBLIC_`, que as embutiria no bundle do navegador.
- **Rate limit por IP** ([`lib/rate-limit.ts`](lib/rate-limit.ts)): 12
  requisições por minuto. É um contador **em memória** — em serverless cada
  instância tem o seu, então segura burst acidental e script ingênuo, não um
  ataque distribuído. Para um deploy sério, troque por um store compartilhado
  (ex.: `@upstash/ratelimit` sobre Redis) mantendo a assinatura de
  `checarRateLimit`.
- **Corpo validado, não apenas parseado** ([`lib/validacao.ts`](lib/validacao.ts)).
  O cliente manda o histórico inteiro da conversa, e esse histórico vira
  `messages` numa chamada paga. Então: teto de 32 KB no corpo, 1 000 caracteres
  na pergunta, 20 turnos e 12 000 caracteres no histórico; `content` só pode ser
  string (aceitar blocos arbitrários permitiria injetar `tool_use`/`tool_result`
  falsos); e a sequência é normalizada para começar em `user` e alternar.
- **Erros nunca vazam.** Mensagens de Postgres e do SDK ficam no log do
  servidor; o cliente recebe texto genérico. Nome de RPC, coluna e detalhe de
  infra não atravessam a fronteira.
- **Headers de segurança** em [`next.config.ts`](next.config.ts): CSP,
  `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS, e `no-store` nas respostas da API. A CSP é por header estático, sem
  nonce: a versão com nonce é mais estrita, mas obriga toda página a renderizar
  dinamicamente — troca que não compensa numa app sem sessão nem dado sensível.
- **Nada de `dangerouslySetInnerHTML`.** O texto do modelo é renderizado como
  nós React ([`components/TextoFormatado.tsx`](components/TextoFormatado.tsx)),
  então o escape é do React, não de um regex escrito à mão.

### Reduzindo o privilégio da chave

Por padrão o código usa a chave `service_role`, que **ignora RLS e concede
escrita no projeto inteiro**. Como o assistente só faz leitura, dá para usar a
chave `anon`, bem menos poderosa: `supabase/schema.sql` já habilita RLS nas três
tabelas, cria apenas políticas de `SELECT` e concede `EXECUTE` na RPC para
`anon`. Depois de aplicar o schema, troque o valor de
`SUPABASE_SERVICE_ROLE_KEY` pela chave `anon` do projeto — nenhuma mudança de
código é necessária. Recomendado para qualquer deploy público.

## Limitações conhecidas

- O histórico da conversa vive no cliente e é reenviado a cada requisição.
  Validar o formato limita o estrago, mas não impede alguém de forjar turnos do
  assistente via `curl`. Eliminar isso exigiria manter a conversa no servidor.
- O rate limit é em memória (ver acima).
- A busca usa `ILIKE` sem normalização de acentos: "TCross" não casa com
  "T-Cross". Melhoria natural seria `unaccent` + busca por trigramas.
- Não há testes automatizados. O CI roda lint, typecheck e build.

## Licença

[MIT](LICENSE).

Os dados de exemplo em `supabase/schema.sql` são **fictícios** e não servem como
referência de compra. Consulte o catálogo do fabricante antes de indicar uma
bateria.
