import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content Security Policy sem nonce.
//
// A alternativa com nonce (proxy.ts) é mais estrita, mas obriga TODA página a
// ser renderizada dinamicamente — some a prerenderização e o cache de CDN. Para
// esta app, que não lida com dados sensíveis nem sessão, a troca não compensa:
// aqui fica a versão por header estático, que já cobre XSS externo,
// clickjacking e injeção de base/form.
//
// `font-src 'self'` só é possível porque as fontes são servidas pelo next/font
// (auto-hospedadas). Nenhuma requisição sai para o Google Fonts.
const csp = [
  "default-src 'self'",
  // 'unsafe-inline' é necessário para os scripts de bootstrap do Next.
  // 'unsafe-eval' só em dev, onde o React usa eval para stack traces.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // Em dev o HMR fala por WebSocket.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Redundante com frame-ancestors, mas cobre navegadores antigos.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Só tem efeito sob HTTPS; ignorado em localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Fixa a raiz do projeto. Sem isto, o Turbopack tenta inferi-la subindo a
  // árvore de diretórios e pode acabar em um lock file fora do repositório
  // (ex.: no diretório home), o que emite aviso no build.
  turbopack: { root: import.meta.dirname },

  // Não anunciar a stack no header X-Powered-By.
  poweredByHeader: false,
  // Falha o build se o TypeScript reclamar (padrão do Next, explicitado aqui
  // para deixar claro que não há escape hatch ligado). O ESLint não roda mais
  // dentro do `next build` nesta versão — fica por conta do `npm run lint`,
  // que o CI executa como passo separado.
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Respostas da API nunca devem ser cacheadas nem indexadas.
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
