import ReactMarkdown from 'react-markdown'

// Renders coach-written Markdown (a Coach's About). react-markdown never renders raw HTML, so
// About text can't inject markup. Links open in a new tab.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body text-sm">
      <ReactMarkdown
        components={{
          a: ({ href, children: text }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {text}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
