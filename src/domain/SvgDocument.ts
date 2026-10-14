import { AttributeValidator } from "./AttributeValidator.js";
import type { Group } from "./Group.js";
import type { Shape } from "./Shape.js";
import { TreeValidator } from "./TreeValidator.js";
import { acquireTreeAccess } from "./TreeAccess.js";
import type { GroupTreeAccess } from "./GroupTreeAccess.js";

export class SvgDocument {
  private static readonly owners = new WeakMap<Shape, SvgDocument>();
  readonly #groupAccess = new Map<Group, GroupTreeAccess>();
  private canvasWidth: number;
  private canvasHeight: number;
  private rootNodes: Shape[] = [];
  private readonly shapes = new Map<string, Shape>();
  private readonly parents = new Map<Shape, Group | null>();

  constructor(width = 800, height = 600) {
    this.validateSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  get width(): number {
    return this.canvasWidth;
  }

  get height(): number {
    return this.canvasHeight;
  }

  get children(): readonly Shape[] {
    return Object.freeze([...this.rootNodes]);
  }

  resize(width: number, height: number): void {
    this.validateSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  add(shape: Shape, parentId?: string, index?: number): void {
    const parent = this.resolveParent(parentId);
    const siblings = this.childrenOf(parent);
    const position = index ?? siblings.length;
    this.validateIndex(position, siblings.length);
    const nodes = TreeValidator.nodes(shape);

    for (const node of nodes) {
      if (this.shapes.has(node.id)) {
        throw new Error("id already exists: " + node.id);
      }
      if (SvgDocument.owners.has(node)) {
        throw new Error("shape already belongs to a document: " + node.id);
      }
    }

    const acquired = this.acquireGroups(nodes);
    const next = [...siblings];
    next.splice(position, 0, shape);
    try {
      this.setChildren(parent, next);
    } catch (error) {
      for (const access of acquired.values()) access.release();
      throw error;
    }
    for (const [group, access] of acquired) this.#groupAccess.set(group, access);
    this.register(shape, parent);
  }

  find(id: string): Shape | undefined {
    return this.shapes.get(id);
  }

  get(id: string): Shape {
    const shape = this.find(id);
    if (shape === undefined) {
      throw new Error("no such shape: " + id);
    }
    return shape;
  }

  parentOf(id: string): Group | null {
    return this.parents.get(this.get(id)) ?? null;
  }

  indexOf(id: string): number {
    const shape = this.get(id);
    return this.childrenOf(this.parentOf(id)).indexOf(shape);
  }

  remove(id: string): Shape {
    const shape = this.get(id);
    const parent = this.parentOf(id);
    const remaining = this.childrenOf(parent).filter(child => child !== shape);
    const nodes = TreeValidator.nodes(shape);

    this.setChildren(parent, remaining);
    for (const node of nodes) {
      const group = node.asContainer();
      if (group !== undefined) {
        this.#groupAccess.get(group)!.release();
        this.#groupAccess.delete(group);
      }
      this.shapes.delete(node.id);
      this.parents.delete(node);
      SvgDocument.owners.delete(node);
    }
    return shape;
  }

  // An explicit index refers to the destination list after removing the target.
  reparent(id: string, parentId?: string, index?: number): void {
    const shape = this.get(id);
    const previousParent = this.parentOf(id);
    const nextParent = this.resolveParent(parentId);
    if (nextParent !== null && TreeValidator.nodes(shape).includes(nextParent)) {
      throw new Error("cannot move a container into itself or its descendant: " + id);
    }

    const previousChildren = this.childrenOf(previousParent).filter(child => child !== shape);
    const nextChildren = previousParent === nextParent
      ? [...previousChildren]
      : [...this.childrenOf(nextParent)];
    const position = index ?? nextChildren.length;
    this.validateIndex(position, nextChildren.length);
    nextChildren.splice(position, 0, shape);

    if (previousParent !== nextParent) {
      this.setChildren(previousParent, previousChildren);
    }
    this.setChildren(nextParent, nextChildren);
    this.parents.set(shape, nextParent);
  }

  // Validate the proposed forest and acquire new containers before changing any lists.
  replaceStructure(roots: readonly Shape[], replacements: ReadonlyMap<Group, readonly Shape[]>): void {
    const nextRoots = [...roots];
    const changes = new Map<Group, readonly Shape[]>();
    for (const [group, children] of replacements) changes.set(group, [...children]);
    const childrenOf = (shape: Shape): readonly Shape[] => {
      const group = shape.asContainer();
      return group === undefined ? shape.children : changes.get(group) ?? group.children;
    };
    const nodes = TreeValidator.forest(nextRoots, childrenOf);
    const nextNodes = new Set(nodes);
    for (const node of nodes) {
      const owner = SvgDocument.owners.get(node);
      if (owner !== undefined && owner !== this) {
        throw new Error("shape already belongs to a document: " + node.id);
      }
    }
    for (const [group, children] of changes) {
      if (!this.#groupAccess.has(group) && !nextNodes.has(group)) {
        throw new Error("cannot modify unrelated group: " + group.id);
      }
      if (!nextNodes.has(group) && children.length !== 0) {
        throw new Error("removed group must be empty when replaced: " + group.id);
      }
    }

    const nextParents = new Map<Shape, Group | null>();
    for (const root of nextRoots) nextParents.set(root, null);
    for (const node of nodes) {
      const container = node.asContainer();
      if (container !== undefined) {
        for (const child of childrenOf(node)) nextParents.set(child, container);
      }
    }
    const acquired = this.acquireGroups(nodes.filter(node => {
      const group = node.asContainer();
      return group !== undefined && !this.#groupAccess.has(group);
    }));
    // Every changed group has either a live document-owned handle or a newly acquired one.
    // add/remove/replaceStructure maintain this invariant; handles stay private and cannot
    // be revoked externally. Group's handle only copies the already validated child list.
    for (const [group, children] of changes) {
      (this.#groupAccess.get(group) ?? acquired.get(group))!.replaceChildren(children);
    }
    this.rootNodes = nextRoots;
    for (const node of this.shapes.values()) SvgDocument.owners.delete(node);
    for (const [group, access] of this.#groupAccess) {
      if (!nextNodes.has(group)) {
        access.release();
        this.#groupAccess.delete(group);
      }
    }
    for (const [group, access] of acquired) this.#groupAccess.set(group, access);
    this.shapes.clear();
    this.parents.clear();
    for (const node of nodes) {
      this.shapes.set(node.id, node);
      this.parents.set(node, nextParents.get(node)!);
      SvgDocument.owners.set(node, this);
    }
  }

  private resolveParent(id: string | undefined): Group | null {
    if (id === undefined) {
      return null;
    }
    const shape = this.find(id);
    if (shape === undefined) {
      throw new Error("no such container: " + id);
    }
    const container = shape.asContainer();
    if (container === undefined) {
      throw new Error("not a container: " + id);
    }
    return container;
  }

  private childrenOf(parent: Group | null): readonly Shape[] {
    return parent === null ? this.rootNodes : parent.children;
  }

  private setChildren(parent: Group | null, children: readonly Shape[]): void {
    if (parent === null) {
      this.rootNodes = [...children];
    } else {
      const access = this.#groupAccess.get(parent);
      if (access === undefined) {
        throw new Error("missing group tree access: " + parent.id);
      }
      access.replaceChildren(children);
    }
  }

  private acquireGroups(nodes: readonly Shape[]): Map<Group, GroupTreeAccess> {
    const acquired = new Map<Group, GroupTreeAccess>();
    try {
      for (const node of nodes) {
        const group = node.asContainer();
        if (group !== undefined) {
          acquired.set(group, group[acquireTreeAccess]());
        }
      }
    } catch (error) {
      for (const access of acquired.values()) access.release();
      throw error;
    }
    return acquired;
  }

  private register(shape: Shape, parent: Group | null): void {
    this.shapes.set(shape.id, shape);
    this.parents.set(shape, parent);
    SvgDocument.owners.set(shape, this);
    const container = shape.asContainer();
    for (const child of shape.children) {
      this.register(child, container ?? null);
    }
  }

  private validateSize(width: number, height: number): void {
    AttributeValidator.finite(width, "width");
    AttributeValidator.finite(height, "height");
    if (width <= 0 || height <= 0) {
      throw new Error("canvas dimensions must be positive");
    }
  }

  private validateIndex(index: number, length: number): void {
    if (!Number.isInteger(index) || index < 0 || index > length) {
      throw new Error("invalid child index: " + index);
    }
  }
}
