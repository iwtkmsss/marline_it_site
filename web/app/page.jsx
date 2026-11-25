import AsciiPortrait from '../components/AsciiPortrait';
import HomePage from '../components/HomePage';
import '../styles/ascii-portrait.css';

export default function Page() {
  return <HomePage portrait={<AsciiPortrait />} />;
}
