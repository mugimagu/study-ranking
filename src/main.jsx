import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// エラーの原因となっていた './index.css' のインポート行を削除しました。
// Tailwind CSSはindex.html側で読み込んでいるため、このままで動作します。

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
