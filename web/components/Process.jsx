import { dioramaAlts, phases } from '../lib/content';

// The pinned diorama scene is pure CSS (view timeline `--process` in story.css).
export default function Process() {
  return (
    <section className="act act-process" id="process" aria-labelledby="process-title">
      <div className="process-pin">
        <div className="process-scene shell">
          <div className="process-copy">
            <h2 id="process-title">Як ми працюємо</h2>
            <p className="process-note">Чотири кроки, і кожен має зрозумілий результат. На ілюстраціях видно, як змінюється бізнес на кожному з них.</p>
            <ol className="phases" role="list">
              {phases.map((phase, index) => (
                <li className={`phase phase-${index + 1}`} key={phase.title}>
                  <h3><span className="phase-number">{`0${index + 1}`}</span>{phase.title}</h3>
                  <p>{phase.text}</p>
                  <p className="phase-result"><span>Результат</span>{phase.result}</p>
                </li>
              ))}
            </ol>
          </div>
          <figure className="diorama">
            <div className="diorama-frame">
              {/* Eager on purpose: with lazy loading the beam outruns the picture. */}
              {dioramaAlts.map((alt, index) => (
                <img
                  className={`dio dio-${index + 1}`}
                  key={alt}
                  src={`/assets/story/diorama/d${index + 1}.webp`}
                  srcSet={`/assets/story/diorama/d${index + 1}-800.webp 800w, /assets/story/diorama/d${index + 1}.webp 1600w`}
                  sizes="(max-width: 900px) 92vw, 50vw"
                  alt={alt}
                  width="1600"
                  height="1200"
                  fetchPriority="low"
                  decoding="async"
                />
              ))}
              <span className="scan-beam" aria-hidden="true" />
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
