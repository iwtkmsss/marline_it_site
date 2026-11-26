import { questions } from '../lib/content';

export default function Questions() {
  return (
    <section className="act act-night section-questions shell" id="questions" aria-labelledby="questions-title">
      <div className="section-intro">
        <h2 id="questions-title">До першої розмови</h2>
        <p>Не обов’язково мати всі відповіді, щоб почати.</p>
      </div>
      <div className="script-page">
        <p className="script-slug">Інт. Перша розмова. День</p>
        <p className="script-action">Ви приходите з ідеєю або з процесом, який заважає. Готового ТЗ може й не бути, це нормально.</p>
        <div className="script-lines">
          {questions.map(line => (
            <details className="line accordion" key={line.question}>
              <summary>
                <span className="line-who">Ви</span>
                <span className="line-text">{line.question}</span>
                <span className="disclosure-icon" aria-hidden="true" />
              </summary>
              <div className="accordion-body line-answer">
                <span className="line-who">Marline</span>
                <p>{line.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
