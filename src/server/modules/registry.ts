import type { ModuleDefinition } from "./types.js";

export class ModuleRegistry {
  private readonly definitions = new Map<string, ModuleDefinition>();

  register(definition: ModuleDefinition) {
    if (this.definitions.has(definition.kind)) throw new Error(`Duplicate module kind: ${definition.kind}`);
    this.definitions.set(definition.kind, definition);
    return definition;
  }

  get(kind: string) {
    return this.definitions.get(kind);
  }

  list() {
    return [...this.definitions.values()].sort((left, right) => left.kind.localeCompare(right.kind));
  }
}
