import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Navbar - Top horizontal navigation menu
 * Dark theme styled to match IDE
 */
function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { label: 'Banks', path: '/' },
    { label: 'Strategy', path: '/strategic-priorities' },
    { label: 'TAM', path: '/tam' },
    { label: 'UBPR', path: '/ubpr' },
    { label: 'FFIEC', path: '/ffiec' },
    { label: 'Admin', path: '/admin' }
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      style={{
        height: '48px',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '24px',
        paddingRight: '24px',
        gap: '32px'
      }}
    >
      {menuItems.map((item) => {
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: 'none',
              border: 'none',
              color: active ? '#ffffff' : '#969696',
              fontSize: '14px',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              padding: '12px 0',
              position: 'relative',
              transition: 'color 0.2s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.target.style.color = '#cccccc';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.target.style.color = '#969696';
              }
            }}
          >
            {item.label}
            {active && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#d97757'
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default Navbar;
