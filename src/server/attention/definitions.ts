import type { ConditionDefinition, StatusResult } from "../modules/types.js";

export function conditionsFor(result: StatusResult, definitions: ConditionDefinition[] = []) {
  return definitions.filter((definition) => definition.when(result)).map((definition) => ({ ...definition, summary: definition.summary?.(result) ?? result.summary }));
}
