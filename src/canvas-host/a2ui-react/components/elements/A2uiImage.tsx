/**
 * A2UI Image Component
 * Displays images with size and fit options
 */

import React, { useState, useCallback } from 'react';

interface ImageProps {
  id: string;
  url: {
    literalString: string;
  };
  alt?: {
    literalString?: string;
  };
  width?: {
    literalNumber?: number;
    literalString?: string;
  };
  height?: {
    literalNumber?: number;
    literalString?: string;
  };
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  style?: Record<string, unknown>;
}

export const A2uiImage: React.FC<ImageProps> = ({
  id,
  url,
  alt,
  width,
  height,
  fit = 'cover',
  style
}) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Resolve URL - handle undefined case
  const imageUrl = url?.literalString || '';

  // Resolve width
  let widthValue: string | number | undefined;
  if (width?.literalNumber !== undefined) {
    widthValue = width.literalNumber;
  } else if (width?.literalString) {
    widthValue = width.literalString;
  }

  // Resolve height
  let heightValue: string | number | undefined;
  if (height?.literalNumber !== undefined) {
    heightValue = height.literalNumber;
  } else if (height?.literalString) {
    heightValue = height.literalString;
  }

  // Resolve alt text
  const altText = alt?.literalString || '';

  // Handle load
  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  // Handle error
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(false);
  }, []);

  // Build styles
  const imageStyle: React.CSSProperties = {
    width: widthValue,
    height: heightValue,
    objectFit: fit === 'fill' ? 'fill' : fit === 'none' ? 'none' : fit,
    display: 'block',
    ...style
  };

  // No URL provided
  if (!imageUrl) {
    return (
      <div
        id={id}
        className="a2ui-image a2ui-image-placeholder"
        style={{ ...imageStyle, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '14px' }}
      >
        <span>No image URL</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        id={id}
        className="a2ui-image a2ui-image-error"
        style={{ ...imageStyle, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}
      >
        <span>Image not found</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {!loaded && (
        <div
          className="a2ui-image-loading"
          style={{ ...imageStyle, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0 }}
        >
          <span>Loading...</span>
        </div>
      )}
      <img
        id={id}
        className="a2ui-image"
        src={imageUrl}
        alt={altText}
        style={{ ...imageStyle, opacity: loaded ? 1 : 0 }}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
    </div>
  );
};
