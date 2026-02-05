/**
 * A2UI VideoPlayer Component
 * Video player with controls
 */

import React, { useRef, useState, useCallback } from 'react';
import './A2uiVideoPlayer.module.css';

interface VideoPlayerProps {
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
  muted?: {
    literalBoolean?: boolean;
  };
  controls?: {
    literalBoolean?: boolean;
  };
  poster?: {
    literalString?: string;
  };
  style?: Record<string, unknown>;
}

export const A2uiVideoPlayer: React.FC<VideoPlayerProps> = ({
  id,
  url,
  autoplay = { literalBoolean: false },
  loop = { literalBoolean: false },
  muted = { literalBoolean: false },
  controls = { literalBoolean: true },
  poster,
  style
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  const videoUrl = url.literalString;

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  if (error) {
    return (
      <div id={id} className="a2ui-videoplayer a2ui-videoplayer-error">
        <span>Video not available</span>
      </div>
    );
  }

  return (
    <div id={id} className="a2ui-videoplayer" style={style}>
      <video
        ref={videoRef}
        className="a2ui-video"
        src={videoUrl}
        autoPlay={autoplay.literalBoolean}
        loop={loop.literalBoolean}
        muted={muted.literalBoolean}
        controls={controls.literalBoolean}
        poster={poster?.literalString}
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
      />
      </div>
  );
};
