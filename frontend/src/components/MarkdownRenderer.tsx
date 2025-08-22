import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { Copy, Check } from 'lucide-react'
import './MarkdownRenderer.css'

interface MarkdownRendererProps {
  content: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedBlocks, setCopiedBlocks] = React.useState<Set<string>>(new Set())

  const copyToClipboard = async (text: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedBlocks(prev => new Set(prev).add(blockId))
      setTimeout(() => {
        setCopiedBlocks(prev => {
          const newSet = new Set(prev)
          newSet.delete(blockId)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          // Customize code blocks
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !className || !match
            
            if (!isInline) {
              const blockId = `code-${Date.now()}-${Math.random()}`
              const isCopied = copiedBlocks.has(blockId)
              
              return (
                <pre className="code-block">
                  <div className="code-header">
                    <span className="code-language">{match[1]}</span>
                    <button
                      className="copy-button"
                      onClick={() => copyToClipboard(String(children), blockId)}
                      title="Copy code"
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              )
            }
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            )
          },
          // Customize blockquotes
          blockquote({ children, ...props }) {
            return (
              <blockquote className="blockquote" {...props}>
                {children}
              </blockquote>
            )
          },
          // Customize tables
          table({ children, ...props }) {
            return (
              <div className="table-container">
                <table className="markdown-table" {...props}>
                  {children}
                </table>
              </div>
            )
          },
          // Customize links
          a({ children, href, ...props }) {
            return (
              <a 
                className="markdown-link" 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            )
          },
          // Customize lists
          ul({ children, ...props }) {
            return (
              <ul className="markdown-list" {...props}>
                {children}
              </ul>
            )
          },
          ol({ children, ...props }) {
            return (
              <ol className="markdown-list" {...props}>
                {children}
              </ol>
            )
          },
          // Customize headings
          h1({ children, ...props }) {
            return (
              <h1 className="markdown-heading h1" {...props}>
                {children}
              </h1>
            )
          },
          h2({ children, ...props }) {
            return (
              <h2 className="markdown-heading h2" {...props}>
                {children}
              </h2>
            )
          },
          h3({ children, ...props }) {
            return (
              <h3 className="markdown-heading h3" {...props}>
                {children}
              </h3>
            )
          },
          h4({ children, ...props }) {
            return (
              <h4 className="markdown-heading h4" {...props}>
                {children}
              </h4>
            )
          },
          h5({ children, ...props }) {
            return (
              <h5 className="markdown-heading h5" {...props}>
                {children}
              </h5>
            )
          },
          h6({ children, ...props }) {
            return (
              <h6 className="markdown-heading h6" {...props}>
                {children}
              </h6>
            )
          },
          // Customize paragraphs
          p({ children, ...props }) {
            return (
              <p className="markdown-paragraph" {...props}>
                {children}
              </p>
            )
          },
          // Customize strong text
          strong({ children, ...props }) {
            return (
              <strong className="markdown-strong" {...props}>
                {children}
              </strong>
            )
          },
          // Customize emphasis
          em({ children, ...props }) {
            return (
              <em className="markdown-emphasis" {...props}>
                {children}
              </em>
            )
          },
          // Customize horizontal rules
          hr({ ...props }) {
            return (
              <hr className="markdown-hr" {...props} />
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer
