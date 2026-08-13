"use client";

// ============================================================
// Assistente de Baterias — UI de chat
// Ligada no backend real: POST /api/consultar -> { resposta, dados }
//   - texto do Claude -> vem de `resposta`
//   - card do cluster -> montado a partir de `dados` (linhas do banco)
//   - 1 veículo   -> 1 cluster (com telltale se start-stop)
//   - N veículos  -> chips pra escolher (dados já em mãos, sem re-consulta)
//
// Os estilos moram em app/globals.css; os componentes, em components/.
// ============================================================

import { useEffect, useRef, useState } from "react";

import { BotMessage } from "@/components/BotMessage";
import { IconBot, IconMark, IconSend } from "@/components/icons";
import { chipLabel } from "@/lib/format";
import type { HistoricoMsg, Msg, Row } from "@/lib/types";

const SAUDACAO =
  "Informe o veículo — **modelo, ano e motor** — para a leitura da bateria.";

const ERRO_REDE =
  "Não consegui falar com o catálogo agora. Confira se o servidor está no ar e tente de novo.";

// O backend também corta o histórico; cortar aqui evita mandar KB à toa.
const MAX_TURNOS_ENVIADOS = 12;

export default function Page() {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "bot", text: SAUDACAO }]);
  const [input, setInput] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs, ocupado]);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || ocupado) return;

    // Histórico = turnos anteriores; o backend acrescenta a pergunta atual.
    const historico: HistoricoMsg[] = msgs
      .filter((m): m is Msg & { text: string } => Boolean(m.text))
      .slice(-MAX_TURNOS_ENVIADOS)
      .map((m) => ({ role: m.who === "user" ? "user" : "assistant", content: m.text }));

    setMsgs((p) => [...p, { who: "user", text: pergunta }]);
    setOcupado(true);

    try {
      const res = await fetch("/api/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta, historico }),
      });

      const data: unknown = await res.json().catch(() => null);

      // O backend só devolve mensagens de erro já higienizadas e acionáveis
      // (limite de uso, app sem configurar, pergunta longa demais), então dá
      // pra mostrá-las direto ao usuário.
      if (!res.ok || (data && typeof data === "object" && "erro" in data)) {
        const msg =
          data && typeof data === "object" && "erro" in data
            ? String((data as { erro: unknown }).erro)
            : ERRO_REDE;
        setMsgs((p) => [...p, { who: "bot", text: msg }]);
        return;
      }

      const { resposta, dados } = (data ?? {}) as { resposta?: string; dados?: Row[] };
      setMsgs((p) => [...p, { who: "bot", text: resposta ?? "", rows: dados ?? [] }]);
    } catch {
      setMsgs((p) => [...p, { who: "bot", text: ERRO_REDE }]);
    } finally {
      setOcupado(false);
    }
  }

  // Clicar num chip: a linha já está em mãos, mostra o cluster sem re-consultar.
  function escolher(r: Row) {
    if (ocupado) return;
    setMsgs((p) => [...p, { who: "user", text: chipLabel(r) }, { who: "bot", rows: [r] }]);
  }

  return (
    <div className="app">
      <header className="head">
        <div className="mark">
          <IconMark />
        </div>
        <div>
          <h1>ASSISTENTE DE BATERIAS</h1>
          <div className="sub">
            <b>Diagnóstico</b> · leitura por veículo
          </div>
        </div>
        <div className="spacer" />
        <div className="status">
          <span className="led" /> Catálogo VW
        </div>
      </header>

      <main className="thread" ref={threadRef} aria-live="polite">
        {msgs.map((m, i) =>
          m.who === "user" ? (
            <div className="row user" key={i}>
              <div className="stack">
                <div className="bubble">{m.text}</div>
              </div>
            </div>
          ) : (
            <BotMessage key={i} m={m} onEscolher={escolher} desabilitado={ocupado} />
          ),
        )}

        {ocupado && (
          <div className="row bot">
            <div className="av">
              <IconBot />
            </div>
            <div className="stack">
              <div className="bubble">
                <div className="typing" aria-label="Consultando o catálogo">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const v = input;
          setInput("");
          void enviar(v);
        }}
      >
        <div className="field">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            maxLength={1000}
            placeholder="GOL 2014 1.0 · T-CROSS 1.0 TSI…"
            aria-label="Descreva o veículo"
            disabled={ocupado}
          />
          <button className="send" type="submit" disabled={ocupado}>
            Ler
            <IconSend />
          </button>
        </div>
        <div className="hint">a bateria vem sempre do catálogo — nunca inventada</div>
      </form>
    </div>
  );
}
