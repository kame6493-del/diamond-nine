import React from "react";
import ReactDOM from "react-dom/client";
import App from "./pro/ProfileApp";
import "./pro/player-hover.css";
import 'animate.css';
import './pro/mobile.css';
import './pro/mobile-readability.css';
import './pro/player-details.css';
import './pro/readability.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
