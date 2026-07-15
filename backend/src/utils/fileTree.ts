import type { FileTreeNode } from '../services/fileService.js';

export function findNodeByPath(
  nodes: FileTreeNode[],
  targetPath: string,
): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}
