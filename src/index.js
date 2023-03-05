import * as React from 'react';
import { createRoot } from "react-dom/client";
import './style.css';
import App from './App';
import { BrowserRouter } from "react-router-dom";


const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter basename={process.env.PUBLIC_URL}>
     <App />
   </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
