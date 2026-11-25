import Backdrop from './Backdrop';
import Contact from './Contact';
import Footer from './Footer';
import Header from './Header';
import Hero from './Hero';
import Process from './Process';
import Questions from './Questions';
import Solutions from './Solutions';
import Works from './Works';

export default function HomePage({ portrait }) {
  return (
    <>
      <a className="skip-link" href="#hero-title">Перейти до змісту</a>
      <Header />
      <main id="main">
        <Backdrop />
        <Hero portrait={portrait} />
        <Process />
        <Solutions />
        <Works />
        <Questions />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
