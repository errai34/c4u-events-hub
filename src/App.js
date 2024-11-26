import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ResearchGroupHome from './components/ResearchGroupHome';
import Events from './pages/Events';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/events" element={<Events />} />
        <Route path="/" element={<ResearchGroupHome />} />
      </Routes>
    </Router>
  );
}

export default App;
