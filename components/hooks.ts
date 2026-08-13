"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY_MOVIMENTO = "(prefers-reduced-motion: reduce)";

function assinarMovimento(aoMudar: () => void): () => void {
  const mq = window.matchMedia(QUERY_MOVIMENTO);
  mq.addEventListener("change", aoMudar);
  return () => mq.removeEventListener("change", aoMudar);
}

const lerNoCliente = () => window.matchMedia(QUERY_MOVIMENTO).matches;

// No servidor não existe `matchMedia`. Retornar `false` aqui é o que evita
// divergência de hidratação: o HTML sai com as animações ligadas e o React
// corrige no cliente, sem estado intermediário nem efeito.
const lerNoServidor = () => false;

/**
 * Respeita `prefers-reduced-motion`.
 *
 * `useSyncExternalStore` é o primitivo certo para ler uma fonte externa ao
 * React (aqui, uma media query): assina, lê o snapshot e tem um snapshot
 * separado para o servidor — sem `setState` dentro de efeito.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(assinarMovimento, lerNoCliente, lerNoServidor);
}

/**
 * Contador numérico animado (ease-out cúbico).
 *
 * Com movimento reduzido não há animação nem estado: o valor final é o próprio
 * alvo.
 */
export function useTween(alvo: number, rodar: boolean, reduzir: boolean): number {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!rodar || reduzir) return;

    const duracao = 1050;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min((t - t0) / duracao, 1);
      setN(Math.round(alvo * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, rodar, reduzir]);

  if (reduzir) return rodar ? alvo : 0;
  return n;
}
