import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/utils/cn';

// Unwrap the block <p> react-markdown emits so parsed content (notably inline `code`) flows
// inline inside a quiz choice / label instead of forcing a paragraph break.
const INLINE_COMPONENTS: Components = {
  p: ({ children }) => <>{children}</>,
};

interface InlineMarkdownProps {
  text: string;
  className?: string;
}

/** Renders short, single-line Markdown inline — used for quiz choices so `code` spans show as code. */
export function InlineMarkdown({ text, className }: InlineMarkdownProps) {
  return (
    <span className={cn('md-inline', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={INLINE_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </span>
  );
}
