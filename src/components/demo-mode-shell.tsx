"use client";
import { useState, type ReactNode } from "react";
import { demoScenarios, executeDemo, type DemoOutcome, type DemoScenario } from "../lib/demo/scenarios";
import { RecoveryResultPanel } from "./recovery-result-panel";

export function DemoModeShell({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  return <>
    <section className="demo-mode-switch" aria-label="Modo de demonstração">
      <label><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Modo de demonstração</label>
      <p>Somente desenvolvimento local. Ao trocar de modo, a operação anterior é encerrada.</p>
    </section>
    {active ? <DemoWorkspace /> : children}
  </>;
}

export function DemoWorkspace() {
  const [scenario, setScenario] = useState<DemoScenario>("authorized");
  const [outcome, setOutcome] = useState<DemoOutcome | null>(null);
  const [manualProvided, setManualProvided] = useState(false);
  return <main className="demo-workspace">
    <section className="panel">
      <h1>Testar sistema com dados fictícios</h1>
      <p className="demo-banner" role="note">SIMULAÇÃO — SEM VALIDADE FISCAL. Não informe certificado, senha ou XML real. Nenhuma consulta à SEFAZ será realizada.</p>
      <form onSubmit={(event) => { event.preventDefault(); setOutcome(executeDemo(scenario, manualProvided)); }}>
        <label className="field-label" htmlFor="demo-scenario">Cenário sintético</label>
        <select className="text-input" id="demo-scenario" value={scenario} onChange={(event) => { setScenario(event.target.value as DemoScenario); setOutcome(null); setManualProvided(false); }}>
          {demoScenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <button className="button button-primary" type="submit">Executar demonstração</button>
      </form>
      {scenario === "manual_xml" && outcome && !manualProvided && <button className="button" type="button" onClick={() => { setManualProvided(true); setOutcome(executeDemo("manual_xml", true)); }}>Fornecer XML correspondente fictício (fixture interna, sem upload real)</button>}
      {outcome && <section aria-label="Resultado da simulação" aria-live="polite">
        <h2>SIMULAÇÃO — Resultado fictício</h2>
        <ol>{outcome.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <RecoveryResultPanel result={outcome.result} onDownload={() => { /* Demo never creates a file. */ }} />
      </section>}
    </section>
  </main>;
}
