import React, { createContext, useContext, useState } from 'react';

const PodcastPlayerContext = createContext();

export const usePodcastPlayer = () => {
  const context = useContext(PodcastPlayerContext);
  if (!context) {
    throw new Error('usePodcastPlayer must be used within a PodcastPlayerProvider');
  }
  return context;
};

export const PodcastPlayerProvider = ({ children }) => {
  const [persistentPodcast, setPersistentPodcast] = useState(null);

  /**
   * Play a podcast in the persistent player
   * @param {Object} podcast - Podcast data with url, transcript, duration, bankName
   */
  const playPodcast = (podcast) => {
    setPersistentPodcast(podcast);
  };

  /**
   * Close the persistent player
   */
  const closePodcast = () => {
    setPersistentPodcast(null);
  };

  const value = {
    persistentPodcast,
    playPodcast,
    closePodcast
  };

  return (
    <PodcastPlayerContext.Provider value={value}>
      {children}
    </PodcastPlayerContext.Provider>
  );
};
