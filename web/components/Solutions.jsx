import { services } from '../lib/content';

export default function Solutions() {
  return (
    <section className="act act-night section-solutions shell" id="solutions" aria-labelledby="solutions-title">
      <div className="section-intro">
        <h2 id="solutions-title">Що ми робимо</h2>
        <p>Масштаб визначає задача. Спочатку розуміємо її, потім обираємо інструменти.</p>
      </div>
      <div className="service-list">
        {services.map((service, index) => (
          <details className="service accordion" key={service.title} open={index === 0}>
            <summary>
              <span className={`service-symbol symbol-${service.symbol}`} aria-hidden="true"><i /><i /><i /></span>
              <span className="service-title">{service.title}</span>
              <span className="service-short">{service.short}</span>
              <span className="disclosure-icon" aria-hidden="true" />
            </summary>
            <div className="accordion-body service-body">
              <p>{service.text}</p>
              <ul className="service-examples" role="list" aria-label="Приклади можливих задач">
                {service.examples.map(example => <li key={example}>{example}</li>)}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
