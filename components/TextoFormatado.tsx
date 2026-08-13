import { Fragment, type ReactNode } from "react";

// Renderiza o texto do modelo aplicando **negrito** e quebras de linha.
//
// A versão anterior montava uma string de HTML e a injetava com
// `dangerouslySetInnerHTML`, escapando `& < >` na mão. Funcionava, mas era
// frágil: qualquer regra de markdown acrescentada depois (link, imagem,
// atributo) reabriria a porta para XSS a partir de texto gerado pelo modelo.
// Aqui não existe HTML — só nós React, que o próprio React escapa.

/** Quebra uma linha em trechos, transformando `**assim**` em <strong>. */
function comNegrito(linha: string): ReactNode[] {
  // Com grupo de captura, o split intercala: [fora, dentro, fora, dentro, ...]
  return linha.split(/\*\*(.+?)\*\*/g).map((trecho, i) =>
    i % 2 === 1 ? (
      <strong key={i}>{trecho}</strong>
    ) : (
      <Fragment key={i}>{trecho}</Fragment>
    ),
  );
}

export function TextoFormatado({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {comNegrito(linha)}
        </Fragment>
      ))}
    </>
  );
}
