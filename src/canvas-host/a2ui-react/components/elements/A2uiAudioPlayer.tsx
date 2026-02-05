/**
 * A2UI AudioPlayer Component
 * Audio player with controls
 */

import React, { useRef, useState, useCallback } from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';
import './A2uiAudioPlayer.module.css';

interface AudioPlayerProps {
  id: string;
  url: {
    literalString: string;
  };
  autoplay?: {
    literalBoolean?: boolean;
  };
  loop?: {
    literalBoolean?: boolean;
  };
  style?: Record<string, unknown>;
}

export const A2uiAudioPlayer: React.FC<AudioPlayerProps> = ({
  id,
  url,
  autoplay = { literalBoolean: false },
  loop = { literalBoolean: false },
  style
}) => {
  const { theme } = useA2uiTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioUrl = url.literalString;

  const handlePlay = useCallback(() => setPlaying(true), []);
  const handlePause = useCallback(() => setPlaying(false), []);
  const handleError = useCallback(() => {
    setError(true);
    setPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) {
      return;
    }

    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [playing]);

  // Format time as MM:SS
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div id={id} className="a2ui-audioplayer a2ui-audioplayer-error">
        <span>Audio not available</span>
      </div>
    );
  }

  return (
    <div id={id} className="a2ui-audioplayer" style={style}>
      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay={autoplay.literalBoolean}
        loop={loop.literalBoolean}
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <div className="a2ui-audio-controls">
        <button
          className="a2ui-audio-play-btn"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          style={{ backgroundColor: theme.colors.primary }}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="a2ui-audio-time">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
