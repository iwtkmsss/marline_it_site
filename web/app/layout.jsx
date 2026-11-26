// The order matters: each file refines the previous one.
import '../styles/fonts.css';
import '../styles/site.css';
import '../styles/wow.css';
import '../styles/marline.css';
import '../styles/story.css';

export const metadata = {
  title: 'Marline — спочатку бізнес, потім код',
  description: 'Marline — розробка сайтів, цифрових продуктів і внутрішніх систем. Занурюємося в бізнес-процеси, автоматизуємо та вдосконалюємо їх.',
  icons: { icon: { url: '/assets/favicon.svg', type: 'image/svg+xml' } },
};

export const viewport = { themeColor: '#ddc5ab' };

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
