import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer";
// import Welcoming from "./components/welcoming";
import Maintenance from "./components/Maintenance.jsx";
import "./style.css";

function App() {
  return (
    <div className="App">
      <Navbar />
      {/* <Welcoming /> */}
      <Maintenance />
      <Footer />
    </div>
  );
}

export default App;
