import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { Card } from '@/components/ui/card';

interface MarkdownContentProps {
  text: string;
}

function splitTitleBody(text: string): { title: string; body: string } {
  const trimmed = text.trim();
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
    <div className="space-y-3">
      <div className="prose prose-lg dark:prose-invert max-w-none [&>*]:!my-0 [&>p]:text-xl [&>p]:font-bold [&>p]:leading-snug">
        <ReactMarkdown>{title}</ReactMarkdown>
      </div>
      {body && (
        <Card className="overflow-hidden">
          <div className="learn-markdown prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{body}</ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}
