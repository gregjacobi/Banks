import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Slider,
  Tabs,
  Tab,
  Divider,
  Tooltip,
  Chip,
  Button,
  Collapse
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Forward10Icon from '@mui/icons-material/Forward10';
import Replay10Icon from '@mui/icons-material/Replay10';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import SpeedIcon from '@mui/icons-material/Speed';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import FeedbackWidget from './FeedbackWidget';

/**
 * EnhancedPodcastPlayer - Minimal collapsible audio player
 * Starts as a small bar with play button, expands to show full controls
 */
function EnhancedPodcastPlayer({
  podcastUrl,
  transcript,
  duration: podcastDuration,
  bankName,
  onOpenPersistent,
  onDownloadMP3,
  onRegenerate,
  idrssd,
  currentReport,
  experts
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [selectedTab, setSelectedTab] = useState(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const audioRef = useRef(null);
  const speedMenuRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      // Only set duration if it's a valid finite number
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    // Try multiple events to get duration
    const handleCanPlay = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleDurationChange = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    // Force load metadata
    audio.load();

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [podcastUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
        setIsPlaying(false);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (event, newValue) => {
    // Validate that newValue is a finite number and audio is ready
    if (!audioRef.current || !isFinite(newValue) || !isFinite(duration) || duration === 0) {
      return;
    }
    audioRef.current.currentTime = newValue;
    setCurrentTime(newValue);
  };

  const handleSkipForward = () => {
    if (!audioRef.current || !isFinite(duration) || duration === 0) return;
    audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, duration);
  };

  const handleSkipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (event, newValue) => {
    if (!audioRef.current || !isFinite(newValue)) return;
    audioRef.current.volume = newValue;
    setVolume(newValue);
    if (newValue === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const handleSpeedChange = (rate) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const jumpToTime = (timeInSeconds) => {
    if (!audioRef.current || !isFinite(timeInSeconds)) return;
    audioRef.current.currentTime = timeInSeconds;
    setCurrentTime(timeInSeconds);
    if (!isPlaying) {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
      });
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTranscript = () => {
    if (!transcript) return [];

    const lines = transcript.split('\n').filter(line => line.trim());
    const segments = [];
    let currentSpeaker = null;
    let currentText = '';

    lines.forEach((line, index) => {
      const speakerMatch = line.match(/^\[([^\]]+)\]:\s*(.*)$/);

      if (speakerMatch) {
        if (currentSpeaker) {
          segments.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            timestamp: null
          });
        }
        currentSpeaker = speakerMatch[1];
        currentText = speakerMatch[2];
      } else if (currentSpeaker) {
        currentText += ' ' + line;
      }
    });

    if (currentSpeaker) {
      segments.push({
        speaker: currentSpeaker,
        text: currentText.trim(),
        timestamp: null
      });
    }

    return segments;
  };

  const transcriptSegments = parseTranscript();
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  return (
    <Box>
      <audio
        ref={audioRef}
        src={podcastUrl}
        preload="metadata"
      />

      {/* Minimal Player Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton
          onClick={togglePlay}
          sx={{
            backgroundColor: 'white',
            color: '#d97757',
            width: 48,
            height: 48,
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' }
          }}
        >
          {isPlaying ? <PauseIcon sx={{ fontSize: 28 }} /> : <PlayArrowIcon sx={{ fontSize: 28 }} />}
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PodcastsIcon sx={{ fontSize: 18, color: 'white' }} />
            <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>
              The Bankskie Show
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'white', opacity: 0.8 }}>
            {duration && isFinite(duration) && duration > 0 ? formatTime(currentTime) + ' / ' + formatTime(duration) : 'Loading...'}
            {podcastDuration && ` • ~${podcastDuration} min`}
          </Typography>
        </Box>

        <IconButton
          onClick={() => setIsExpanded(!isExpanded)}
          sx={{ color: 'white' }}
        >
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* Expanded Player Controls */}
      <Collapse in={isExpanded}>
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          {/* Tabs for Player / Transcript */}
          <Tabs
            value={selectedTab}
            onChange={(e, v) => setSelectedTab(v)}
            sx={{
              mb: 2,
              minHeight: 36,
              '& .MuiTab-root': {
                color: 'white',
                minHeight: 36,
                py: 0.5
              },
              '& .Mui-selected': { color: 'white !important' },
              '& .MuiTabs-indicator': { backgroundColor: 'white' }
            }}
          >
            <Tab label="Player" />
            <Tab label="Transcript" disabled={!transcript} />
          </Tabs>

          {/* Player Tab */}
          {selectedTab === 0 && (
            <Box>
              {/* Progress Slider */}
              <Box sx={{ mb: 2 }}>
                <Slider
                  value={currentTime}
                  max={duration && isFinite(duration) && duration > 0 ? duration : 100}
                  onChange={handleSeek}
                  disabled={!duration || !isFinite(duration) || duration === 0}
                  sx={{
                    color: 'white',
                    '& .MuiSlider-thumb': {
                      width: 14,
                      height: 14
                    },
                    '& .MuiSlider-track': {
                      height: 3
                    },
                    '& .MuiSlider-rail': {
                      height: 3,
                      opacity: 0.3
                    }
                  }}
                />
              </Box>

              {/* Playback Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                <Tooltip title="Rewind 10s">
                  <IconButton
                    onClick={handleSkipBackward}
                    sx={{ color: 'white' }}
                    size="small"
                  >
                    <Replay10Icon />
                  </IconButton>
                </Tooltip>

                <IconButton
                  onClick={togglePlay}
                  sx={{
                    backgroundColor: 'white',
                    color: '#d97757',
                    width: 40,
                    height: 40,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' }
                  }}
                >
                  {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>

                <Tooltip title="Forward 10s">
                  <IconButton
                    onClick={handleSkipForward}
                    sx={{ color: 'white' }}
                    size="small"
                  >
                    <Forward10Icon />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Volume & Speed Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
                    <IconButton size="small" onClick={toggleMute} sx={{ color: 'white' }}>
                      {isMuted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Slider
                    value={isMuted ? 0 : volume}
                    min={0}
                    max={1}
                    step={0.1}
                    onChange={handleVolumeChange}
                    sx={{
                      width: 80,
                      color: 'white',
                      '& .MuiSlider-thumb': {
                        width: 10,
                        height: 10
                      }
                    }}
                  />
                </Box>

                <Box sx={{ position: 'relative' }} ref={speedMenuRef}>
                  <Tooltip title="Playback speed">
                    <IconButton
                      size="small"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      sx={{ color: 'white' }}
                    >
                      <SpeedIcon fontSize="small" />
                      <Typography variant="caption" sx={{ ml: 0.5, minWidth: 25 }}>
                        {playbackRate}x
                      </Typography>
                    </IconButton>
                  </Tooltip>

                  {showSpeedMenu && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        mb: 1,
                        p: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        minWidth: 70,
                        backgroundColor: 'white',
                        borderRadius: 1,
                        boxShadow: 3
                      }}
                    >
                      {speedOptions.map((speed) => (
                        <Box
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          sx={{
                            p: 0.5,
                            cursor: 'pointer',
                            borderRadius: 1,
                            backgroundColor: playbackRate === speed ? '#d97757' : 'transparent',
                            color: playbackRate === speed ? 'white' : 'inherit',
                            '&:hover': {
                              backgroundColor: playbackRate === speed ? '#d97757' : '#f5f5f5'
                            }
                          }}
                        >
                          <Typography variant="caption" align="center" display="block">
                            {speed}x
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<OpenInNewIcon />}
                  onClick={onOpenPersistent}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                >
                  Pop Out
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={onDownloadMP3}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                >
                  Download
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={onRegenerate}
                  sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  Regenerate
                </Button>
              </Box>

              {/* Feedback Widget */}
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.9)', borderRadius: 1, p: 1.5 }}>
                <FeedbackWidget
                  feedbackType="podcast"
                  bankIdrssd={idrssd}
                  bankName={bankName}
                  reportTimestamp={Date.now()}
                  reportingPeriod={currentReport?.reportingPeriod}
                  podcastExperts={experts}
                />
              </Box>
            </Box>
          )}

          {/* Transcript Tab */}
          {selectedTab === 1 && transcript && (
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {transcriptSegments.length > 0 ? (
                transcriptSegments.map((segment, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 1,
                      cursor: segment.timestamp ? 'pointer' : 'default',
                      '&:hover': segment.timestamp ? {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)'
                      } : {}
                    }}
                    onClick={() => segment.timestamp && jumpToTime(segment.timestamp)}
                  >
                    <Chip
                      label={segment.speaker}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        fontWeight: 600,
                        mb: 0.5
                      }}
                    />
                    <Typography variant="body2" sx={{ color: 'white', opacity: 0.95, mt: 0.5 }}>
                      {segment.text}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" sx={{ color: 'white', opacity: 0.7 }}>
                    Transcript available but could not be parsed.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export default EnhancedPodcastPlayer;
