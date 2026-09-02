import { describe, expect, it } from "vitest";
import {
  advanceTo,
  applyAction,
  buildDebrief,
  chaveDoExame,
  createTheoState,
  exigeRaciocinioAntes,
  missingFields,
  parseIntent,
  type TheoAction,
  type TheoState,
} from "../theo-engine";
import {
  buildActorPrompt,
  catalogoDe,
  emitirFala,
  MAX_VERBALIZACOES,
  verbalizacaoId,
} from "../theo-actors";
import { getEngineCase } from "../engine-registry";
import {
  forbiddenActorTerms,
  maeFacts,
  theoGating,
  recusaPadrao,
  THEO_CASE_ID,
  theoFacts,
  verbalizacoesDe,
} from "../case-theo";

const run = (actions: TheoAction[], finalSec?: number): TheoState => {
  let s = createTheoState();
  for (const a of actions) s = applyAction(s, a);
  return finalSec !== undefined ? advanceTo(s, finalSec) : s;
};

const orderId = (s: TheoState) => s.orders[s.orders.length - 1]!.id;

const PASSAGEM_VALIDA =
  "Théo, 6 anos, dispneia com esforço moderado; oxigênio e broncodilatador em curso, mãe presente e ciente.";

const RACIOCINIO: TheoAction = {
  type: "raciocinio",
  atSec: 30,
  representacao:
    "Criança de 6 anos com dispneia aguda e esforço respiratório, sem febre, com episódios prévios semelhantes.",
  diferenciais: ["crise de broncoespasmo", "infecção respiratória viral", "corpo estranho"],
  confianca: "media",
};

function completeOxygen(atSec = 10): TheoAction[] {
  return [
    {
      type: "ordem",
      atSec,
      raw: "ofertar oxigênio por cateter nasal a 3 L/min, alvo saturação 94%",
    },
  ];
}

describe("emissão controlada: nenhuma prosa do modelo chega ao estudante", () => {
  const sel = (id: string, factId = id.split("#")[0]!) => ({ factId, verbalizacaoId: id });

  it("entrega exatamente o texto da verbalização escolhida", () => {
    const fato = maeFacts.find((f) => f.id === "m-crises-anteriores")!;
    const e = emitirFala("mae", [sel(verbalizacaoId(fato.id, 0))], "ele já teve crises antes?");
    expect(e.ok).toBe(true);
    expect(e.reply).toBe(fato.content);
    expect(e.factIds).toEqual(["m-crises-anteriores"]);
    expect(e.verbalizacaoIds).toEqual(["m-crises-anteriores#0"]);
  });

  it("combina verbalizações inteiras, sem recombinar palavras", () => {
    const a = verbalizacoesDe(theoFacts.find((f) => f.id === "t-peito")!)[0]!;
    const b = verbalizacoesDe(theoFacts.find((f) => f.id === "t-tosse")!)[0]!;
    const e = emitirFala("theo", [sel("t-peito#0"), sel("t-tosse#0")], "o que você sente?");
    expect(e.ok).toBe(true);
    expect(e.reply).toBe(`${a} ${b}`);
  });

  it("rejeita verbalização inexistente e devolve fallback determinístico", () => {
    const e = emitirFala("mae", [sel("m-inicio#99")], "quando começou?");
    expect(e.ok).toBe(false);
    expect(e.reason).toContain("inexistente");
    expect(e.reply).toContain("não sei responder");
    expect(e.factIds).toEqual([]);
  });

  it("rejeita verbalização de outro ator", () => {
    const e = emitirFala("theo", [sel("m-inicio#0")], "quando começou?");
    expect(e.ok).toBe(false);
    expect(e.reason).toContain("outro ator");
  });

  it("rejeita factId incoerente com a verbalização escolhida", () => {
    const e = emitirFala(
      "mae",
      [{ factId: "m-peso", verbalizacaoId: "m-inicio#0" }],
      "quando começou?",
    );
    expect(e.ok).toBe(false);
    expect(e.reason).toContain("incoerente");
  });

  it("rejeita mais verbalizações que o limite por fala", () => {
    const ids = maeFacts.slice(0, MAX_VERBALIZACOES + 1).map((f) => sel(verbalizacaoId(f.id, 0)));
    const e = emitirFala("mae", ids, "conte tudo");
    expect(e.ok).toBe(false);
    expect(e.reason).toContain(`mais de ${MAX_VERBALIZACOES}`);
  });

  it("seleção vazia devolve a recusa padrão do catálogo, não invenção", () => {
    const e = emitirFala("theo", [], "você já viajou para o exterior?");
    expect(e.ok).toBe(true);
    expect(e.reply).toBe(recusaPadrao.theo);
    expect(e.factIds).toEqual([]);
  });

  it("texto que o modelo tente enviar por fora é ignorado — não há canal para prosa", () => {
    const comProsa = [
      { factId: "m-sem-febre", verbalizacaoId: "m-sem-febre#0", reply: "Teve febre de 39 graus." },
    ] as never;
    const e = emitirFala("mae", comProsa, "ele teve febre?");
    expect(e.ok).toBe(true);
    expect(e.reply).toBe(maeFacts.find((f) => f.id === "m-sem-febre")!.content);
    expect(e.reply).not.toMatch(/39/);
  });

  // As duas inversões que a validação lexical anterior não pegava: todas as
  // palavras de "Teve febre" e "Ele ficou internado" existem nos fatos que
  // NEGAM esses eventos. Aqui a inversão é impossível por construção, porque
  // só sai do servidor texto de catálogo — e o catálogo só tem a negação.
  it("inversão “Teve febre” é inalcançável: toda verbalização do fato nega a febre", () => {
    const fato = maeFacts.find((f) => f.id === "m-sem-febre")!;
    const textos = verbalizacoesDe(fato);
    expect(textos.length).toBeGreaterThan(1);
    for (const [i, texto] of textos.entries()) {
      expect(texto.toLowerCase()).toMatch(/não teve|nao teve|não tem|estava normal/);
      const e = emitirFala("mae", [sel(verbalizacaoId(fato.id, i))], "ele teve febre?");
      expect(e.reply).toBe(texto);
      expect(e.reply.toLowerCase()).not.toMatch(/^teve febre/);
    }
  });

  it("inversão “Ele ficou internado” é inalcançável: toda verbalização do fato nega a internação", () => {
    const fato = maeFacts.find((f) => f.id === "m-internacao")!;
    const textos = verbalizacoesDe(fato);
    expect(textos.length).toBeGreaterThan(1);
    for (const [i, texto] of textos.entries()) {
      expect(texto.toLowerCase()).toMatch(/nunca|não |nao /);
      const e = emitirFala("mae", [sel(verbalizacaoId(fato.id, i))], "ele já internou?");
      expect(e.reply).toBe(texto);
      expect(e.reply.toLowerCase()).not.toMatch(/^ele ficou internado/);
    }
  });

  it("o catálogo inteiro está limpo de termo objetivo proibido", () => {
    const norm = (x: string) =>
      x
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    for (const actor of ["theo", "mae"] as const) {
      for (const entrada of catalogoDe(actor)) {
        // "salbutamol" isolado é palavra da mãe ("a bombinha de salbutamol");
        // o termo proibido é a forma técnica "salbutamol inalatório".
        const proibido = forbiddenActorTerms.find((t) => norm(entrada.texto).includes(norm(t)));
        expect(proibido, `${entrada.id}: "${entrada.texto}"`).toBeUndefined();
      }
    }
  });
});

describe("fatos sensíveis exigem pergunta direta compatível", () => {
  const sel = (id: string) => ({ factId: id.split("#")[0]!, verbalizacaoId: id });

  it("medo da máscara não sai sem pergunta compatível", () => {
    const e = emitirFala("theo", [sel("t-medo-mascara#0")], "o que você sente no peito?");
    expect(e.ok).toBe(false);
    expect(e.reason).toContain("fato sensível sem pergunta direta compatível");
  });

  it("medo da máscara sai quando a pergunta alcança o medo", () => {
    const e = emitirFala("theo", [sel("t-medo-mascara#0")], "você tem medo de alguma coisa aqui?");
    expect(e.ok).toBe(true);
    expect(e.reply).toContain("máscara");
  });

  it("culpa e preocupação da mãe também dependem de pergunta compatível", () => {
    expect(emitirFala("mae", [sel("m-culpa#0")], "quando começou o chiado?").ok).toBe(false);
    expect(emitirFala("mae", [sel("m-culpa#0")], "a senhora se sente culpada?").ok).toBe(true);
    expect(emitirFala("mae", [sel("m-preocupacao#0")], "ele tomou vacina?").ok).toBe(false);
    expect(emitirFala("mae", [sel("m-preocupacao#0")], "como a senhora está se sentindo?").ok).toBe(
      true,
    );
  });

  it("fato não sensível não depende de pergunta", () => {
    expect(emitirFala("mae", [sel("m-vacinas#0")], "qualquer coisa").ok).toBe(true);
  });

  it("o fato sensível não é nem enviado ao modelo sem pergunta compatível", () => {
    const semGatilho = buildActorPrompt("theo", "o que você sente no peito?");
    expect(semGatilho).not.toContain("t-medo-agulha");
    expect(semGatilho).toContain("t-peito");

    const comGatilho = buildActorPrompt("theo", "você tem medo de agulha?");
    expect(comGatilho).toContain("t-medo-agulha");
  });

  it("o prompt pede ids e nunca texto livre", () => {
    const prompt = buildActorPrompt("mae", "quando começou?");
    expect(prompt).toContain("Você NÃO escreve a resposta");
    expect(prompt).toContain("verbalizacaoId");
    expect(prompt).toContain("social:mae:nao-sei");
  });
});

describe("completude da ordem depende da intervenção", () => {
  it("oxigênio exige dispositivo e fluxo, nunca dose", () => {
    const m = missingFields("oxigenio", undefined, {});
    expect(m.join(" ")).toMatch(/dispositivo/);
    expect(m.join(" ")).toMatch(/fluxo/);
    expect(m.join(" ")).not.toMatch(/dose/);
  });

  it("inalatório exige dose e dispositivo; prednisolona exige dose e via", () => {
    expect(missingFields("medicamento", "salbutamol", {})).toEqual([
      "dose",
      "apresentação/dispositivo (espaçador ou nebulização)",
    ]);
    expect(missingFields("medicamento", "prednisolona", { dose: "20 mg" })).toEqual([
      "via de administração",
    ]);
    expect(
      missingFields("medicamento", "prednisolona", { dose: "20 mg", via: "via oral" }),
    ).toEqual([]);
  });

  it("ordem incompleta não é executada nem produz efeito", () => {
    const s = run([{ type: "ordem", atSec: 10, raw: "fazer salbutamol" }], 900);
    expect(s.orders[0]!.status).toBe("aguardando_esclarecimento");
    expect(s.log.some((e) => e.type === "execucao")).toBe(false);
    expect(s.vitals.effort).toBe("critico");
  });

  it("esclarecimento completa a ordem sem executá-la", () => {
    let s = run([{ type: "ordem", atSec: 10, raw: "fazer salbutamol" }]);
    s = applyAction(s, {
      type: "esclarecer",
      atSec: 20,
      orderId: orderId(s),
      raw: "10 gotas em nebulização",
    });
    expect(s.orders[0]!.status).toBe("aguardando_confirmacao");
    s = advanceTo(s, 500);
    expect(s.orders[0]!.status).toBe("aguardando_confirmacao");
  });
});

describe("nada acontece antes da confirmação", () => {
  it("ordem completa fica parada até confirmar", () => {
    const s = run(completeOxygen(10), 700);
    expect(s.orders[0]!.status).toBe("aguardando_confirmacao");
    expect(s.vitals.spo2).toBe(89);
    expect(s.log.some((e) => e.type === "execucao")).toBe(false);
  });
});

describe("deterioração sem intervenção", () => {
  it("dispara hipoxemia, esforço crítico e escalonamento de segurança", () => {
    const s = advanceTo(createTheoState(), 15 * 60);
    expect(s.vitals.spo2).toBe(89);
    expect(s.vitals.speech).toBe("palavras");
    expect(s.vitals.effort).toBe("critico");
    expect(s.vitals.airEntry).toBe("criticamente_reduzida");
    expect(s.safetyEscalation).toBe(true);
  });
});

describe("efeitos das intervenções", () => {
  it("oxigênio confirmado melhora a SpO₂ após preparo e latência", () => {
    let s = run(completeOxygen(10));
    s = applyAction(s, { type: "confirmar", atSec: 15, orderId: orderId(s) });
    const pre = advanceTo(s, 40);
    expect(pre.vitals.spo2).toBe(92); // ainda em preparo
    const post = advanceTo(s, 6 * 60);
    expect(post.vitals.spo2).toBeGreaterThan(92);
    expect(post.log.some((e) => e.label === "Deterioração — hipoxemia")).toBe(false);
  });

  it("salbutamol melhora esforço, entrada de ar e sibilância e eleva a FC", () => {
    let s = run([{ type: "ordem", atSec: 10, raw: "salbutamol 10 gotas com nebulização" }]);
    s = applyAction(s, { type: "confirmar", atSec: 15, orderId: orderId(s) });
    const post = advanceTo(s, 10 * 60);
    expect(post.vitals.effort).toBe("leve");
    expect(post.vitals.airEntry).toBe("normal");
    expect(post.vitals.hr).toBeGreaterThan(132);
    expect(post.log.some((e) => e.label === "Deterioração — esforço crítico")).toBe(false);
  });

  it("prednisolona não melhora o quadro agudo", () => {
    let s = run([{ type: "ordem", atSec: 10, raw: "prednisolona 30 mg via oral" }]);
    s = applyAction(s, { type: "confirmar", atSec: 15, orderId: orderId(s) });
    const post = advanceTo(s, 11 * 60);
    expect(post.vitals.effort).toBe("critico");
    expect(post.log.some((e) => e.label.includes("sem melhora clínica aguda"))).toBe(true);
  });

  it("ipratrópio produz efeito adjuvante", () => {
    let s = run([{ type: "ordem", atSec: 10, raw: "salbutamol 10 gotas com nebulização" }]);
    s = applyAction(s, { type: "confirmar", atSec: 15, orderId: orderId(s) });
    s = applyAction(s, { type: "ordem", atSec: 20, raw: "ipratrópio 20 gotas em nebulização" });
    s = applyAction(s, { type: "confirmar", atSec: 25, orderId: orderId(s) });
    const post = advanceTo(s, 8 * 60);
    expect(post.log.some((e) => e.label === "Efeito adjuvante do ipratrópio")).toBe(true);
  });
});

describe("relógio e precedência", () => {
  it("recupera o tempo após suspensão da aba: salto único == avanço em blocos", () => {
    const jump = advanceTo(createTheoState(), 900);
    let stepped = createTheoState();
    for (let t = 60; t <= 900; t += 60) stepped = advanceTo(stepped, t);
    expect(stepped.vitals).toEqual(jump.vitals);
    expect(stepped.triggered).toEqual(jump.triggered);
    expect(stepped.log.map((e) => `${e.atSec}:${e.label}`)).toEqual(
      jump.log.map((e) => `${e.atSec}:${e.label}`),
    );
  });

  it("no mesmo timestamp o evento independente precede a ação do usuário", () => {
    const s = applyAction(createTheoState(), { type: "monitor", atSec: 360 });
    const idxEvento = s.log.findIndex((e) => e.label === "Deterioração — hipoxemia");
    const idxAcao = s.log.findIndex((e) => e.label === "Verificação do monitor");
    expect(idxEvento).toBeGreaterThanOrEqual(0);
    expect(idxEvento).toBeLessThan(idxAcao);
    expect(s.log[idxAcao + 1]!.detail).toContain("89%");
  });

  it("o mesmo log de ações sempre produz o mesmo estado final", () => {
    const script = (): TheoAction[] => [
      {
        type: "fala",
        atSec: 5,
        actor: "mae",
        question: "o que aconteceu?",
        reply: "Começou ontem.",
        grounded: true,
      },
      { type: "exame", atSec: 30, raw: "auscultar o tórax" },
      { type: "ordem", atSec: 60, raw: "oxigênio por máscara facial a 6 L/min" },
      { type: "confirmar", atSec: 70, orderId: "o1" },
      { type: "ordem", atSec: 90, raw: "salbutamol 10 gotas em nebulização" },
      { type: "confirmar", atSec: 100, orderId: "o2" },
      { type: "reavaliar", atSec: 400 },
    ];
    const a = run(script(), 900);
    const b = run(script(), 900);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe("transferência congela o encontro", () => {
  it("nenhuma ação, efeito ou evento ocorre depois da transferência", () => {
    let s = run([{ type: "exame", atSec: 20, raw: "avaliar o esforço respiratório" }]);
    s = applyAction(s, {
      type: "transferir",
      atSec: 120,
      destino: "Dra. Helena, pediatra plantonista",
      passagem:
        "Criança de 6 anos com dificuldade respiratória, avaliada e monitorizada, aguardando conduta.",
    });
    const frozenAt = { ...s.vitals };
    const logLen = s.log.length;
    let after = applyAction(s, {
      type: "ordem",
      atSec: 200,
      raw: "oxigênio por cateter nasal a 3 L/min",
    });
    after = applyAction(after, { type: "exame", atSec: 300, raw: "auscultar" });
    after = advanceTo(after, 1200);
    expect(after.frozen).toBe(true);
    expect(after.vitals).toEqual(frozenAt);
    expect(after.log.length).toBe(logLen);
    expect(after.orders.length).toBe(s.orders.length);
  });

  it("o relógio também para: clockSec não avança depois da transferência", () => {
    let s = run([{ type: "exame", atSec: 20, raw: "avaliar o esforço respiratório" }]);
    s = applyAction(s, {
      type: "transferir",
      atSec: 120,
      destino: "Dra. Helena, pediatra plantonista",
      passagem: PASSAGEM_VALIDA,
    });
    const congeladoEm = s.clockSec;
    expect(s.frozen).toBe(true);

    expect(advanceTo(s, 3600).clockSec).toBe(congeladoEm);
    expect(applyAction(s, { type: "monitor", atSec: 3600 }).clockSec).toBe(congeladoEm);
    expect(applyAction(s, { type: "aguardar", atSec: 3600, seconds: 600 }).clockSec).toBe(
      congeladoEm,
    );
    // e o estado inteiro segue idêntico
    expect(advanceTo(s, 3600)).toEqual(s);
  });
});

describe("debrief derivado exclusivamente do log", () => {
  it("usa apenas eventos registrados, sem nota numérica", () => {
    let s = run([
      {
        type: "fala",
        atSec: 5,
        actor: "mae",
        question: "história?",
        reply: "Começou ontem.",
        grounded: true,
      },
      { type: "exame", atSec: 30, raw: "auscultar o tórax" },
      { type: "ordem", atSec: 60, raw: "oxigênio por cateter nasal a 3 L/min" },
      { type: "confirmar", atSec: 70, orderId: "o1" },
      { type: "reavaliar", atSec: 300 },
    ]);
    s = applyAction(s, {
      type: "transferir",
      atSec: 400,
      destino: "Pediatra plantonista",
      passagem: "Théo, 6 anos, dispneia; oxigênio em curso, reavaliado, sem broncodilatador ainda.",
    });
    const d = buildDebrief(s);
    expect(d.automatico).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/\b\d{1,3}\/100\b/);
    const o2 = d.itens.find((i) => i.id === "oxigenio")!;
    expect(o2.status).toBe("demonstrado");
    const broncho = d.itens.find((i) => i.id === "broncodilatador")!;
    expect(broncho.status).toBe("nao_observado");
    const transfer = d.itens.find((i) => i.id === "transferencia")!;
    expect(transfer.status).toBe("demonstrado");
    expect(d.cronologia).toEqual(s.log);
    expect(d.naoAvaliavel.length).toBeGreaterThan(0);
  });

  it("marca reavaliação como não avaliável quando não houve intervenção", () => {
    const d = buildDebrief(run([{ type: "exame", atSec: 10, raw: "olhar o estado geral" }]));
    expect(d.itens.find((i) => i.id === "reavaliacao")!.status).toBe("nao_avaliavel");
  });
});

describe("interpretação determinística de intenções", () => {
  it.each([
    ["auscultar o tórax", "exame"],
    ["checar o oxímetro", "monitor"],
    ["reavaliar a criança", "reavaliar"],
    ["aguardar 2 minutos", "aguardar"],
    ["ofertar oxigênio por cateter nasal a 3 L/min", "ordem"],
    ["solicitar radiografia de tórax", "ordem"],
    ["transferir o cuidado para a pediatra", "transferir"],
  ])("%s → %s", (raw, kind) => {
    expect(parseIntent(raw).kind).toBe(kind);
  });
});

describe("regressão: Joana e Marcos permanecem inalterados", () => {
  it("Joana mantém o motor completo e Marcos o adaptador", () => {
    const joana = getEngineCase("dor-toracica")!;
    expect(joana.rubric.length).toBeGreaterThan(20);
    expect(joana.tests.some((t) => t.id === "t-ecg")).toBe(true);
    const marcos = getEngineCase("dor-abdominal")!;
    expect(marcos.physicalExams.length).toBeGreaterThan(0);
    expect(marcos.rubric.length).toBeGreaterThan(0);
  });

  it("Théo não é mais adaptado pelo registro genérico", () => {
    expect(getEngineCase(THEO_CASE_ID)).toBeUndefined();
  });
});

describe("transferência exige destino e passagem substantiva", () => {
  it("não encerra sem passagem e o encontro segue aberto", () => {
    const s = run([
      { type: "transferir", atSec: 60, destino: "Dra. Helena, pediatra plantonista", passagem: "" },
    ]);
    expect(s.frozen).toBe(false);
    expect(s.transfer).toBeNull();
    const recusa = s.log.find(
      (e) => e.label === "Transferência não concluída — passagem de caso insuficiente",
    );
    expect(recusa?.detail).toContain("passagem de caso preenchida");
  });

  it("não encerra com passagem curta demais", () => {
    const s = run([
      { type: "transferir", atSec: 60, destino: "Dra. Helena", passagem: "Criança com dispneia." },
    ]);
    expect(s.frozen).toBe(false);
    expect(s.transfer).toBeNull();
  });

  it("não encerra sem destino, mesmo com passagem boa", () => {
    const s = run([{ type: "transferir", atSec: 60, destino: "  ", passagem: PASSAGEM_VALIDA }]);
    expect(s.frozen).toBe(false);
    expect(s.transfer).toBeNull();
    const recusa = s.log.find(
      (e) => e.label === "Transferência não concluída — passagem de caso insuficiente",
    );
    expect(recusa?.detail).toContain("destino");
  });

  it("encerra com os dois e registra ambos no event log", () => {
    const s = run([
      {
        type: "transferir",
        atSec: 60,
        destino: "Dra. Helena, pediatra plantonista",
        passagem: PASSAGEM_VALIDA,
      },
    ]);
    expect(s.frozen).toBe(true);
    expect(s.transfer?.destino).toBe("Dra. Helena, pediatra plantonista");
    expect(s.transfer?.passagem).toBe(PASSAGEM_VALIDA);
    const evento = s.log.find((e) => e.type === "transferencia")!;
    expect(evento.detail).toContain("Dra. Helena");
    expect(evento.detail).toContain(PASSAGEM_VALIDA);

    const d = buildDebrief(s);
    const item = d.itens.find((i) => i.id === "transferencia")!;
    expect(item.status).toBe("demonstrado");
    expect(item.evidencias.some((e) => e.includes("passagem:"))).toBe(true);
  });

  it("o debrief registra as tentativas recusadas de encerrar", () => {
    let s = run([{ type: "transferir", atSec: 60, destino: "Dra. Helena", passagem: "" }]);
    s = applyAction(s, {
      type: "transferir",
      atSec: 90,
      destino: "Dra. Helena",
      passagem: PASSAGEM_VALIDA,
    });
    const item = buildDebrief(s).itens.find((i) => i.id === "transferencia")!;
    expect(item.status).toBe("demonstrado");
    expect(item.consequencia).toContain("1 tentativa");
  });
});

describe("exame decisivo é configuração do caso, não regra geral", () => {
  it("no caso do Théo nenhum exame é decisivo, então nada é bloqueado", () => {
    expect(theoGating.examesDecisivos).toEqual([]);
    const s = run([{ type: "ordem", atSec: 60, raw: "solicitar radiografia de tórax" }]);
    expect(s.orders).toHaveLength(1);
    expect(s.log.some((e) => /bloqueado/.test(e.label))).toBe(false);
  });

  it("a chave do exame é reconhecida no texto da solicitação", () => {
    expect(chaveDoExame({}, "solicitar radiografia de tórax")).toBe("radiografia");
    expect(chaveDoExame({}, "colher gasometria arterial")).toBe("gasometria");
    expect(chaveDoExame({}, "pedir hemograma")).toBe("hemograma");
    // Exame físico do tórax não é pedido de imagem.
    expect(chaveDoExame({}, "auscultar o tórax")).toBeNull();
    expect(chaveDoExame({}, "examinar o tórax")).toBeNull();
    // Solicitações explícitas de imagem seguem reconhecidas.
    expect(chaveDoExame({}, "solicitar raio-x de tórax")).toBe("radiografia");
    expect(chaveDoExame({}, "pedir RX de tórax")).toBe("radiografia");
    expect(chaveDoExame({}, "medir o peso")).toBeNull();
    expect(chaveDoExame({ test: "gasometria" }, "aquele exame")).toBe("gasometria");
  });

  it("o gate só exige raciocínio para o exame que o caso declara decisivo", () => {
    const raw = "solicitar radiografia de tórax";
    expect(exigeRaciocinioAntes({}, raw, { examesDecisivos: [] })).toBe(false);
    expect(exigeRaciocinioAntes({}, raw, { examesDecisivos: ["gasometria"] })).toBe(false);
    expect(exigeRaciocinioAntes({}, raw, { examesDecisivos: ["radiografia"] })).toBe(true);
    expect(exigeRaciocinioAntes({}, "medir o peso", { examesDecisivos: ["radiografia"] })).toBe(
      false,
    );
  });
});

describe("raciocínio declarado", () => {
  it("não bloqueia intervenção terapêutica — o compromisso é antes do dado, não do tratamento", () => {
    const s = run([
      { type: "ordem", atSec: 60, raw: "ofertar oxigênio por cateter nasal a 3 L/min, alvo 94%" },
    ]);
    expect(s.orders).toHaveLength(1);
  });

  it("recusa raciocínio incompleto: representação curta ou menos de dois diferenciais", () => {
    const curto = run([{ ...RACIOCINIO, representacao: "Dispneia." } as TheoAction]);
    expect(curto.reasoning).toHaveLength(0);
    expect(curto.log.find((e) => e.label === "Raciocínio não registrado")?.detail).toContain(
      "representação do problema",
    );

    const umSo = run([{ ...RACIOCINIO, diferenciais: ["crise de broncoespasmo"] } as TheoAction]);
    expect(umSo.reasoning).toHaveLength(0);
    expect(umSo.log.find((e) => e.label === "Raciocínio não registrado")?.detail).toContain(
      "diferenciais",
    );
  });

  it("registra o raciocínio no event log e libera o exame", () => {
    let s = run([RACIOCINIO]);
    expect(s.reasoning).toHaveLength(1);
    expect(s.reasoning[0]!.confianca).toBe("media");
    const evento = s.log.find((e) => e.type === "raciocinio")!;
    expect(evento.label).toContain("confiança média");
    expect(evento.detail).toContain("Diferenciais:");
    expect(evento.atSec).toBe(s.reasoning[0]!.atSec);

    s = applyAction(s, { type: "ordem", atSec: 90, raw: "solicitar radiografia de tórax" });
    expect(s.orders).toHaveLength(1);
    expect(s.orders[0]!.kind).toBe("exame");
  });

  it("o debrief reconhece que foi expresso e quando, mas não julga a semântica", () => {
    let s = run([RACIOCINIO]);
    s = applyAction(s, { type: "ordem", atSec: 90, raw: "solicitar radiografia de tórax" });
    const d = buildDebrief(s);
    const item = d.itens.find((i) => i.id === "raciocinio-declarado")!;
    expect(item.status).toBe("demonstrado");
    expect(item.evidencias[0]).toContain("00:30");
    expect(item.evidencias[0]).toContain("crise de broncoespasmo");
    expect(d.naoAvaliavel.some((x) => /calibrad/.test(x))).toBe(true);
    // e segue sem nota numérica
    expect(JSON.stringify(d)).not.toMatch(/"score"|"nota"/);
  });

  it("sem raciocínio o item fica não observado e não finge que algo foi bloqueado", () => {
    const item = buildDebrief(run([{ type: "monitor", atSec: 10 }])).itens.find(
      (i) => i.id === "raciocinio-declarado",
    )!;
    expect(item.status).toBe("nao_observado");
    expect(item.consequencia).toContain("não declara exame decisivo");
  });

  it("o debrief não trata comprimento da passagem como qualidade", () => {
    const s = run([
      {
        type: "transferir",
        atSec: 60,
        destino: "Dra. Helena, pediatra plantonista",
        passagem: PASSAGEM_VALIDA,
      },
    ]);
    const d = buildDebrief(s);
    const item = d.itens.find((i) => i.id === "transferencia")!;
    expect(item.titulo).toBe("Destino e passagem registrados");
    expect(d.naoAvaliavel.some((x) => /qualidade da passagem/i.test(x))).toBe(true);
  });
});
