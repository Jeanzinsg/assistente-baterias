"use client";

import { faixaAnos } from "@/lib/format";
import type { Msg, Row } from "@/lib/types";

import { Cluster } from "./Cluster";
import { IconBot, IconWarn } from "./icons";
import { TextoFormatado } from "./TextoFormatado";

type Props = {
  m: Msg;
  onEscolher: (r: Row) => void;
  desabilitado: boolean;
};

/**
 * Um turno do assistente. Três formas possíveis, combináveis:
 *   - texto (resposta ou pergunta de refinamento);
 *   - um Cluster, quando a busca resolveu para UM veículo;
 *   - chips de escolha, quando resolveu para vários (os dados já estão em mãos,
 *     então escolher não dispara nova consulta).
 */
export function BotMessage({ m, onEscolher, desabilitado }: Props) {
  const rows = m.rows ?? [];
  const unico = rows.length === 1 ? rows[0] : null;

  return (
    <div className="row bot">
      <div className="av">
        <IconBot />
      </div>
      <div className="stack">
        {unico?.start_stop && (
          <div className="telltale">
            <div className="lamp">
              <IconWarn />
            </div>
            <div>
              <b>Start-Stop · exige EFB ou AGM</b>
              <span>Bateria comum estraga em poucos meses.</span>
            </div>
          </div>
        )}

        {m.text && (
          <div className="bubble">
            <TextoFormatado texto={m.text} />
          </div>
        )}

        {unico && <Cluster r={unico} />}

        {rows.length > 1 && (
          <div className="chips">
            {rows.map((r) => (
              <button
                key={r.cod}
                type="button"
                className={"chip " + (r.start_stop ? "ss" : "")}
                onClick={() => onEscolher(r)}
                disabled={desabilitado}
              >
                <b>
                  {r.modelo}
                  {r.versao ? " " + r.versao : ""}
                </b>
                <small>
                  {faixaAnos(r)}
                  {r.motorizacao ? " · " + r.motorizacao : ""}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
