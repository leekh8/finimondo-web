import React from 'react';
import { useGameStore } from './store/gameStore.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import HomeScreen   from './components/HomeScreen.jsx';
import LobbyScreen  from './components/LobbyScreen.jsx';
import GameScreen   from './components/GameScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import Notification from './components/Notification.jsx';

export default function App() {
  useWebSocket(); // 연결 초기화

  const scene        = useGameStore(s => s.scene);
  const notification = useGameStore(s => s.notification);

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg-dark flex flex-col">
      {scene === 'home'   && <HomeScreen />}
      {scene === 'lobby'  && <LobbyScreen />}
      {scene === 'game'   && <GameScreen />}
      {scene === 'result' && <ResultScreen />}

      {notification && <Notification {...notification} />}
    </div>
  );
}
