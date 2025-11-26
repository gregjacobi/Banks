import React, { createContext, useContext, useState, useEffect } from 'react';

const BuilderManagerContext = createContext();

export function useBuilderManager() {
  const context = useContext(BuilderManagerContext);
  if (!context) {
    throw new Error('useBuilderManager must be used within BuilderManagerProvider');
  }
  return context;
}

const STORAGE_KEY = 'bankexplorer_builders';

/**
 * BuilderManagerProvider - Manages multiple builders across different banks
 * Allows builders to persist when navigating between banks and across sessions
 */
export function BuilderManagerProvider({ children }) {
  // Map of idrssd -> builder state
  const [builders, setBuilders] = useState(() => {
    // Initialize from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading builders from localStorage:', error);
    }
    return {};
  });

  // Save to localStorage whenever builders change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(builders));
    } catch (error) {
      console.error('Error saving builders to localStorage:', error);
    }
  }, [builders]);

  const openBuilder = (idrssd, bankName) => {
    setBuilders(prev => ({
      ...prev,
      [idrssd]: {
        idrssd,
        bankName,
        open: true,
        minimized: false
      }
    }));
  };

  const closeBuilder = (idrssd) => {
    setBuilders(prev => {
      const newBuilders = { ...prev };
      delete newBuilders[idrssd];
      return newBuilders;
    });
  };

  const minimizeBuilder = (idrssd) => {
    setBuilders(prev => ({
      ...prev,
      [idrssd]: {
        ...prev[idrssd],
        minimized: true
      }
    }));
  };

  const expandBuilder = (idrssd) => {
    setBuilders(prev => ({
      ...prev,
      [idrssd]: {
        ...prev[idrssd],
        minimized: false
      }
    }));
  };

  const isBuilderOpen = (idrssd) => {
    return builders[idrssd]?.open || false;
  };

  const isBuilderMinimized = (idrssd) => {
    return builders[idrssd]?.minimized || false;
  };

  const getOpenBuilders = () => {
    return Object.values(builders).filter(b => b.open);
  };

  const getMinimizedBuilders = () => {
    return Object.values(builders).filter(b => b.open && b.minimized);
  };

  return (
    <BuilderManagerContext.Provider
      value={{
        builders,
        openBuilder,
        closeBuilder,
        minimizeBuilder,
        expandBuilder,
        isBuilderOpen,
        isBuilderMinimized,
        getOpenBuilders,
        getMinimizedBuilders
      }}
    >
      {children}
    </BuilderManagerContext.Provider>
  );
}
