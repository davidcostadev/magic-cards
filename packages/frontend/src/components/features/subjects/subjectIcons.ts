import {
  Code,
  Database,
  Component,
  GitBranch,
  Braces,
  Palette,
  Server,
  Container,
  Code2,
  Binary,
} from "lucide-react";
import type { ElementType } from "react";

const subjectIconMap: Record<string, ElementType> = {
  code: Code,
  database: Database,
  component: Component,
  "git-branch": GitBranch,
  javascript: Braces,
  css: Palette,
  node: Server,
  docker: Container,
  python: Code2,
  algorithms: Binary,
};

/** Resolve a subject's icon key to a Lucide component, falling back to a code icon. */
export function getSubjectIcon(icon: string): ElementType {
  return subjectIconMap[icon] ?? Code;
}
