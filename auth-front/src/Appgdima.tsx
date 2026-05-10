import bg from './assets/background.jpg';
import Home from "./components/home/Home";

function App() {
  return (
    <div className="relative min-h-screen">

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Overlay (IMPORTANT) */}
      <div className="absolute inset-0 bg-pink-900/30" />

      {/* Your App Content */}
      <div className="relative z-10">
        <Home />
      </div>

    </div>
  );
}

export default App;