import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function NotebookMarkdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    table: ({ children }) => <div className="overflow-x-auto"><table className="w-full border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2">{children}</table></div>,
    pre: ({ children }) => <pre dir="ltr" className="overflow-x-auto whitespace-pre-wrap">{children}</pre>,
    p: ({ children }) => <p dir="auto">{children}</p>,
    h1: ({ children }) => <h1 className="document-heading">{children}</h1>,
    h2: ({ children }) => <h2 className="document-subheading">{children}</h2>,
    h3: ({ children }) => <h3 className="document-subheading">{children}</h3>,
    ul: ({ children }) => <ul className="list-disc ps-5">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal ps-5">{children}</ol>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({ alt }) => <span>{alt}</span>,
  }}>{text}</ReactMarkdown>;
}