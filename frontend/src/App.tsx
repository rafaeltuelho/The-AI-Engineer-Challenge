import React, { useState } from 'react'
import ChatInterface from './components/ChatInterface'
import Header from './components/Header'
import './App.css'

function App() {
  const [apiKey, setApiKey] = useState<string>('')

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <ChatInterface apiKey={apiKey} setApiKey={setApiKey} />
      </main>
    </div>
  )
}

export default App
