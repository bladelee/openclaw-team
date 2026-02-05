/**
 * A2UI Markdown Component
 * Rendered markdown content
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import './A2uiMarkdown.module.css';

interface MarkdownProps {
  id: string;
  content: {
    literalString?: string;
  };
  style?: Record<string, unknown>;
}

export const A2uiMarkdown: React.FC<MarkdownProps> = ({
  id,
  content,
  style
}) => {
  const markdownText = content?.literalString || '';

  return (
    <div id={id} className="a2ui-markdown" style={style}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="a2ui-md-p">{children}</p>,
          h1: ({ children }) => <h1 className="a2ui-md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="a2ui-md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="a2ui-md-h3">{children}</h3>,
          ul: ({ children }) => <ul className="a2ui-md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="a2ui-md-ol">{children}</ol>,
          li: ({ children }) => <li className="a2ui-md-li">{children}</li>,
          code: ({ inline, children }) =>
            inline ? (
              <code className="a2ui-md-code-inline">{children}</code>
            ) : (
              <code className="a2ui-md-code-block">{children}</code>
            ),
          a: ({ href, children }) => (
            <a href={href} className="a2ui-md-link" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="a2ui-md-blockquote">{children}</blockquote>
          )
        }}
      >
        {markdownText}
      </ReactMarkdown>
    </div>
  );
};
