"use client";

import { useEffect, useState } from "react";

import { br, dimensoes, ident } from "@/lib/format";
import type { Row } from "@/lib/types";

import { usePrefersReducedMotion, useTween } from "./hooks";
import { IconCap, IconChip, IconInfo, IconPol } from "./icons";

// Escalas dos mostradores. CCA e Ah não têm teto natural; estes valores são o
// topo da escala visual, escolhidos para cobrir o catálogo de linha leve.
const CCA_MAX = 900;
const AH_MAX = 120;
const AH_SEGMENTOS = 14;

const ROTULO_TECNOLOGIA: Record<string, string> = {
  "chumbo-acido": "CONVENCIONAL",
  EFB: "EFB",
  AGM: "AGM",
};

// Traços do mostrador semicircular, pré-calculados (a geometria é fixa).
const TRACOS = Array.from({ length: 11 }, (_, i) => {
  const cx = 120;
  const cy = 128;
  const r = 98;
  const a = ((180 + i * 18) * Math.PI) / 180;
  return {
    x1: (cx + Math.cos(a) * (r - 11)).toFixed(1),
    y1: (cy + Math.sin(a) * (r - 11)).toFixed(1),
    x2: (cx + Math.cos(a) * r).toFixed(1),
    y2: (cy + Math.sin(a) * r).toFixed(1),
  };
});

const ARCO = "M 22,128 A 98,98 0 0 1 218,128";

/** Card "painel de instrumento" com as specs de uma bateria. */
export function Cluster({ r }: { r: Row }) {
  const reduzir = usePrefersReducedMotion();
  const [aceso, setAceso] = useState(false);

  // Dois rAF: garante que o estado inicial (apagado) chegue a ser pintado antes
  // da transição, senão o navegador funde os dois frames e a animação some.
  // Com movimento reduzido o CSS já desliga as transições, então o mesmo
  // caminho serve para os dois casos — o card só aparece pronto.
  useEffect(() => {
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setAceso(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, []);

  const fracaoCca = Math.min((r.cca ?? 0) / CCA_MAX, 1);
  const fracaoAh = Math.min(r.capacidade_ah / AH_MAX, 1);
  const segmentosAcesos = Math.round(fracaoAh * AH_SEGMENTOS);
  const positivoDireita = r.polaridade === "direita";
  const tecnologiaDestacada = r.tecnologia !== "chumbo-acido";

  const ccaAnimado = useTween(r.cca ?? 0, aceso, reduzir);
  const ahAnimado = useTween(r.capacidade_ah, aceso, reduzir);

  const dims = dimensoes(r);

  return (
    <div className="cluster">
      <div className="cl-top">
        <div>
          <div className="code">
            {r.fabricante} {r.sku}
          </div>
          <div className="who">{ident(r)}</div>
        </div>
        <div className="badge on">Indicada</div>
      </div>

      <div className="gauges">
        <div className="g-cca">
          <svg
            viewBox="0 0 240 152"
            role="img"
            aria-label={r.cca == null ? "CCA não informado" : `${r.cca} CCA`}
          >
            {TRACOS.map((t, i) => (
              <line key={i} className="tick" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
            ))}
            <path className="track" pathLength={100} d={ARCO} />
            <path
              className="fill"
              pathLength={100}
              d={ARCO}
              style={{ strokeDashoffset: (100 - (aceso ? fracaoCca : 0) * 100).toFixed(2) }}
            />
            <line
              className="needle"
              x1="120"
              y1="128"
              x2="120"
              y2="42"
              style={{ transform: `rotate(${(-90 + (aceso ? fracaoCca : 0) * 180).toFixed(1)}deg)` }}
            />
            <circle className="hub" cx="120" cy="128" r="7" />
            <text className="g-read" x="120" y="112" fontSize="40">
              {ccaAnimado}
            </text>
            <text className="g-unit" x="120" y="132" fontSize="11">
              CCA
            </text>
          </svg>
        </div>

        <div className="g-side">
          <div className="mini">
            <div className="ml">
              <IconCap /> Capacidade
            </div>
            <div className="segs" aria-hidden>
              {Array.from({ length: AH_SEGMENTOS }).map((_, i) => (
                <i
                  key={i}
                  className={aceso && i < segmentosAcesos ? "on" : ""}
                  style={{ transitionDelay: `${i * 45}ms` }}
                />
              ))}
            </div>
            <div className="mv">
              {ahAnimado}
              <small>Ah</small>
            </div>
          </div>

          <div className="mini">
            <div className="ml">
              <IconPol /> Polaridade
            </div>
            <div className="term">
              <div className={"post " + (positivoDireita ? "" : "hot")} aria-hidden>
                <span className="cap" />−
              </div>
              <div className={"post " + (positivoDireita ? "hot" : "")} aria-hidden>
                <span className="cap" />+
              </div>
              <span className="side">
                {positivoDireita ? "positivo à direita" : "positivo à esquerda"}
              </span>
            </div>
          </div>

          <div className="mini">
            <div className="ml">
              <IconChip /> Tecnologia
            </div>
            <div className="techrow">
              <span className={"tech " + (tecnologiaDestacada ? "hi" : "")}>
                {ROTULO_TECNOLOGIA[r.tecnologia] ?? r.tecnologia}
              </span>
            </div>
          </div>
        </div>
      </div>

      {(dims || r.peso_kg != null) && (
        <div className="cl-foot">
          {dims}
          {dims && r.peso_kg != null ? " · " : ""}
          {r.peso_kg != null ? `${br(r.peso_kg)} kg` : ""}
        </div>
      )}

      {r.observacao && (
        <div className="cl-foot">
          <IconInfo /> {r.observacao}
        </div>
      )}
    </div>
  );
}
