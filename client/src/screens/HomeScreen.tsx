import { uiArt } from '../assets/designs'
import { Flame } from '../components/icons'
import shopIcon from '../assets/icons/shop.png'
import competeIcon from '../assets/icons/compete.png'

interface HomeScreenProps {
  onPlay: () => void
  onShop: () => void
  onCompete: () => void
}

export function HomeScreen({ onPlay, onShop, onCompete }: HomeScreenProps) {
  return (
    <main className="home-screen" style={{ backgroundImage: `url(${uiArt.woodBg})` }}>
      <header className="home-screen__top">
        <div className="app-screen__chip" aria-label="Current streak: 3 days">
          <Flame size={14} /> 3 day streak
        </div>
        <div className="app-screen__chip app-screen__chip--gold">2322</div>
      </header>

      <img className="home-screen__logo" src={uiArt.logo} alt="Fruit Rush" />
      <p className="home-screen__tagline">Slice. Score. Own it on Celo.</p>

      <button type="button" className="btn btn--orange home-screen__play" onClick={onPlay}>
        Play now
      </button>

      <div className="home-screen__tiles">
        <button type="button" className="wood-panel home-screen__tile" onClick={onShop}>
          <img src={shopIcon} alt="" className="home-screen__tile-icon" />
          <span className="home-screen__kicker">Armory</span>
          <strong className="display">Shop</strong>
        </button>
        <button type="button" className="wood-panel home-screen__tile" onClick={onCompete}>
          <img src={competeIcon} alt="" className="home-screen__tile-icon" />
          <span className="home-screen__kicker">Live</span>
          <strong className="display">Compete</strong>
        </button>
      </div>
    </main>
  )
}
