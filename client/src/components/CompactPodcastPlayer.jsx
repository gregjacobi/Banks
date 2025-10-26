import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Slider,
  Tooltip,
  Paper
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

/**
 * CompactPodcastPlayer - Minimal persistent audio player for header
 */
function CompactPodcastPlayer({ podcastUrl, bankName, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (event, newValue) => {
    audioRef.current.currentTime = newValue;
    setCurrentTime(newValue);
  };

  const toggleMute = () => {
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (event, newValue) => {
    audioRef.current.volume = newValue;
    setVolume(newValue);
    if (newValue === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!podcastUrl) return null;

  return (
    <Paper
      elevation={2}
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: 380,
        p: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(10px)',
        borderRadius: 2,
        zIndex: 1200,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}
    >
      <audio
        ref={audioRef}
        src={podcastUrl}
        preload="metadata"
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Play/Pause Button */}
        <IconButton
          onClick={togglePlay}
          sx={{
            backgroundColor: '#667eea',
            color: 'white',
            '&:hover': { backgroundColor: '#5568d3' },
            width: 40,
            height: 40
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>

        {/* Info and Progress */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <PodcastsIcon sx={{ fontSize: 14, color: '#667eea' }} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: '#667eea',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {bankName} - The Bankskie Show
            </Typography>
          </Box>

          {/* Progress Slider */}
          <Slider
            value={currentTime}
            max={duration || 100}
            onChange={handleSeek}
            size="small"
            sx={{
              py: 0.5,
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12
              },
              '& .MuiSlider-track': {
                backgroundColor: '#667eea'
              },
              '& .MuiSlider-rail': {
                backgroundColor: '#e0e0e0'
              }
            }}
          />

          {/* Time Display */}
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
        </Box>

        {/* Volume Control */}
        <Box sx={{ display: 'flex', alignItems: 'center', width: 100 }}>
          <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
            <IconButton size="small" onClick={toggleMute}>
              {isMuted || volume === 0 ? (
                <VolumeOffIcon fontSize="small" />
              ) : (
                <VolumeUpIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Slider
            value={isMuted ? 0 : volume}
            min={0}
            max={1}
            step={0.1}
            onChange={handleVolumeChange}
            size="small"
            sx={{
              width: 60,
              ml: 0.5,
              '& .MuiSlider-thumb': {
                width: 10,
                height: 10
              }
            }}
          />
        </Box>
      </Box>
    </Paper>
  );
}

export default CompactPodcastPlayer;
