import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/hello')
      .then(response => {
        setMessage(response.data.message);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setMessage('Error connecting to server');
        setLoading(false);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Bank Explorer</h1>
        <p className="subtitle">Financial Statement Analysis Tool</p>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="message-box">
            <p>{message}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
