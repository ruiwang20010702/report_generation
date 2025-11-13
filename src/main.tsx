import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 初始化 Sentry 错误追踪
import { initSentry } from "./config/sentry";
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
