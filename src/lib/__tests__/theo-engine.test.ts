import { describe, expect, it } from "vitest";
import {
  advanceTo,
  applyAction,
  buildDebrief,
  createTheoState,
  missingFields,
  parseIntent,
  type TheoAction,
  type TheoState,
} from "../theo-engine";
import { MAX_FATOS_CITADOS, validateActorReply } from "../theo-actors";
import { getEngineCase } from "../engine-registry";
import { maeFacts, THEO_CASE_ID } from "../case-theo";

const run = (actions: TheoAction[], finalSec?: number): TheoState => {
  let s = createTheoState();
  for (const a of actions) s = applyAction(s, a);
  return finalSec !== undefined ? advanceTo(s, finalSec) : s;
};

const orderId = (s: TheoState) => s.orders[s.orders.length - 1]!.id;

function completeOxygen(atSec = 10): TheoAction[] {
  return [
    {
      type: "ordem",
      atSec,
      raw: "ofertar oxigênio por cateter nasal a 3 L/min, alvo saturação 94%",
    },
  ];
}

describe("vazamento de informação pelos atores", () => {
  it("Théo não revela dado objetivo mesmo com IDs válidos", () => {
    const v = validateActorReply("theo", "Minha saturação está em 89% e tenho sibilância.", [
      "t-peito",
    ]);
    expect(v.ok).toBe(false);
    expect(v.reply).toMatch(/não responde|Théo/);
  });

  it("rejeita texto com número inventado apesar de IDs válidos", () => {
    const v = validateActorReply("theo", "Eu respiro 45 vezes por minuto.", ["t-cansaco-fala"]);
    expect(v.ok).toBe(false);
  });

  it("rejeita afirmação de consequência futura", () => {
    const v = validateActorReply("mae", "Ele vai precisar ser internado hoje.", ["m-preocupacao"]);
    expect(v.ok).toBe(false);
  });

  it("rejeita ID de outro ator", () => {
    const v = validateActorReply("theo", "Ele já teve outras crises.", ["m-crises-anteriores"]);
    expect(v.ok).toBe(false);
  });

  it("a mãe pode informar crises anteriores", () => {
    const fact = maeFacts.find((f) => f.id === "m-crises-anteriores")!;
    const v = validateActorReply("mae", fact.content, ["m-crises-anteriores"]);
    expect(v.ok).toBe(true);
    expect(v.factIds).toEqual(["m-crises-anteriores"]);
  });
});

describe("grounding: a fala precisa decorrer dos fatos citados", () => {
  it("rejeita fala clínica com factIds vazio", () => {
    const v = validateActorReply("mae", "Meu pai morreu ontem.", []);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("fala clínica sem fato citado");
    expect(v.factIds).toEqual([]);
  });

  it("aceita recusa curta com factIds vazio", () => {
    for (const recusa of ["Não sei.", "Não lembro disso, tio.", "Isso nunca aconteceu."]) {
      const v = validateActorReply("theo", recusa, []);
      expect(v.ok).toBe(true);
      expect(v.factIds).toEqual([]);
    }
  });

  it("rejeita texto inventado apesar de o ID citado ser válido", () => {
    const v = validateActorReply("theo", "Eu tossi sangue à noite.", ["t-tosse"]);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("sangue");
  });

  it("rejeita número que pertence a outro fato do mesmo ator", () => {
    // "22" existe no corpus da mãe (m-peso), mas não no fato citado.
    const peso = maeFacts.find((f) => f.id === "m-peso")!;
    expect(peso.content).toContain("22");
    const v = validateActorReply("mae", "Ele já teve 22 crises parecidas.", [
      "m-crises-anteriores",
    ]);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("número não sustentado pelos fatos citados");
    // contraprova: o mesmo número passa quando citado com o fato que o sustenta
    expect(validateActorReply("mae", peso.content, ["m-peso"]).ok).toBe(true);
  });

  it("rejeita fato citado sem uso na fala (corpus-padding)", () => {
    const v = validateActorReply("mae", "As vacinas estão em dia.", ["m-vacinas", "m-peso"]);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("m-peso");
  });

  it("rejeita citar mais fatos que o limite por fala", () => {
    const ids = maeFacts.slice(0, MAX_FATOS_CITADOS + 1).map((f) => f.id);
    const v = validateActorReply("mae", "Começou com coriza há três dias.", ids);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain(`mais de ${MAX_FATOS_CITADOS}`);
  });

  it("rejeita atribuir ao paciente a asma que é da mãe, mesmo com palavras autorizadas", () => {
    const v = validateActorReply("mae", "Ele tem asma.", ["m-asma-materna"]);
    expect(v.ok).toBe(false);
    // a mãe segue podendo falar da própria asma
    expect(validateActorReply("mae", "Quem tem asma sou eu, a mãe.", ["m-asma-materna"]).ok).toBe(
      true,
    );
  });

  it("aceita paráfrase montada com as verbalizações autorizadas do fato citado", () => {
    const v = validateActorReply("theo", "Cansa falar, tenho que parar no meio para respirar.", [
      "t-cansaco-fala",
    ]);
    expect(v.ok).toBe(true);
    expect(v.factIds).toEqual(["t-cansaco-fala"]);
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
