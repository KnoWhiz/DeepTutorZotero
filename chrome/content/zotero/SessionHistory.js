import React, { useState } from 'react';

const containerStyle = {
  padding: 16,
  background: '#f8f9fa',
  borderRadius: 8,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Roboto, Inter, Arial, sans-serif',
};

const searchSectionStyle = {
  marginBottom: 16,
  padding: 8,
  background: 'white',
  borderRadius: 6,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  display: 'flex',
};

const searchInputStyle = {
  flex: 1,
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #495057',
  borderRadius: 6,
  background: '#fff',
  color: '#1a65b0',
  minHeight: 32,
  fontSize: 13,
};

const sessionListStyle = {
  borderRadius: 8,
  padding: 8,
  overflowY: 'auto',
  background: 'white',
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const sessionButtonStyle = {
  width: '100%',
  padding: '8px 12px',
  margin: '4px 0',
  background: '#f8f9fa',
  border: '1px solid #e9ecef',
  borderRadius: 6,
  textAlign: 'left',
  fontSize: 13,
  color: '#2c3e50',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

function SessionHistory({ sessions = [], onSessionSelect }) {
  const [search, setSearch] = useState('');

  // Filter and sort sessions
  const filteredSessions = sessions
    .filter(s => !search || (s.sessionName || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.lastUpdatedTime || 0) - new Date(a.lastUpdatedTime || 0));

  return (
    <div style={containerStyle}>
      {/* Search Bar Section */}
      <div style={searchSectionStyle}>
        <input
          type="text"
          placeholder="Search sessions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={searchInputStyle}
        />
      </div>
      {/* Session List Section */}
      <div style={sessionListStyle}>
        {filteredSessions.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 16 }}>No sessions found.</div>
        )}
        {filteredSessions.map(session => (
          <button
            key={session.id || session.sessionName}
            style={sessionButtonStyle}
            onClick={() => onSessionSelect && onSessionSelect(session.sessionName)}
          >
            {session.sessionName || 'Unnamed Session'}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SessionHistory;
