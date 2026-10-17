import { Icon } from "./icon";

const steps = ["Certificado", "XML original", "Análise", "Resultado"];

export function StepIndicator({ current, complete }: { current: number; complete?: boolean }) {
  return (
    <nav className="stepper" aria-label="Etapas de recuperação">
      {steps.map((step, index) => {
        const number = index + 1;
        const done = number < current || (complete && number === current);
        const active = number === current && !complete;
        return (
          <div className={`stepper-item${active ? " is-active" : ""}${done ? " is-done" : ""}`} key={step} aria-current={active ? "step" : undefined}>
            <span className="stepper-circle">{done ? <Icon name="check" /> : `0${number}`}</span>
            <span className="stepper-label">{step}</span>
          </div>
        );
      })}
    </nav>
  );
}
