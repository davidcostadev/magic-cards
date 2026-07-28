import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/ui/card';

interface MarkdownContentProps {
  text: string;
}

// GFM tables are wider than a phone. Wrap each one so it scrolls on its own instead of
// pushing the whole card sideways; `.learn-markdown` styles the table itself.
const BODY_COMPONENTS: Components = {
  table: ({ children }) => (
    <div className="md-table-scroll overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

function splitTitleBody(text: string): { title: string; body: string } {
  const trimmed = text.trim();

  // A leading table has no lead paragraph to promote: splitting at the blank line after it would
  // render the whole table in the title slot (bold, unwrapped). Send it all to the body instead.
  if (trimmed.startsWith('|')) {
    return { title: '', body: trimmed };
  }

  const codeBlockIndex = trimmed.indexOf('```');
  const doubleNewline = trimmed.indexOf('\n\n');

  let splitAt = -1;
  if (codeBlockIndex >= 0 && doubleNewline >= 0) {
    splitAt = Math.min(codeBlockIndex, doubleNewline);
  } else if (doubleNewline >= 0) {
    splitAt = doubleNewline;
  } else if (codeBlockIndex >= 0) {
    splitAt = codeBlockIndex;
  }

  if (splitAt <= 0) {
    return { title: trimmed.replace(/^#+\s*/, ''), body: '' };
  }

  const title = trimmed
    .slice(0, splitAt)
    .trim()
    .replace(/^#+\s*/, '');
  const body = trimmed.slice(splitAt).trim();
  return { title, body };
}

export function MarkdownContent({ text }: MarkdownContentProps) {
  const { title, body } = splitTitleBody(text);

  return (
    <div className="learn-prose space-y-3">
      {title && (
        <div className="prose prose-lg dark:prose-invert max-w-none [&>*]:!my-0 [&>p]:text-xl [&>p]:font-bold [&>p]:leading-snug">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{title}</ReactMarkdown>
        </div>
      )}
      {body && (
        <Card className="overflow-hidden">
          <div className="learn-markdown prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={BODY_COMPONENTS}
            >
              {body}
            </ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}
