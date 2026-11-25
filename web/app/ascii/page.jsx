import AsciiPortrait from '../../components/AsciiPortrait';
import HomePage from '../../components/HomePage';
import '../../styles/ascii-preview.css';

export const metadata = {
  title: 'Marline — ASCII-прев’ю',
  robots: { index: false },
};

export default function AsciiPage() {
  return <HomePage portrait={<AsciiPortrait />} />;
}
