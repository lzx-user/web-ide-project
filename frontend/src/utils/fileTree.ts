import type { FileNode } from '../types/ide';

export function findNodeByPath(
  nodes: FileNode[],
  targetPath: string,
): FileNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}
