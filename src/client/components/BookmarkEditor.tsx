import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AppConfig, BookmarkConfig, BookmarkGroupConfig } from "../types";
import { IconPicker } from "./IconPicker";

type BookmarkEditorProps = {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
};

const defaultBookmark: BookmarkConfig = {
  name: "New bookmark",
  group: "General",
  icon: "link",
  iconColor: "#eef5ff",
  url: "https://example.com",
  health: {
    mode: "default",
    method: "GET",
    headers: {},
    expectedStatuses: [200, 204, 301, 302, 304, 401, 403]
  }
};

const defaultGroup: BookmarkGroupConfig = {
  name: "General",
  order: 0,
  columns: 4,
  width: "normal"
};

export function BookmarkEditor({ config, onChange }: BookmarkEditorProps) {
  const [groupDrafts, setGroupDrafts] = useState<Record<number, string>>({});
  const groups = config.layout.groups;
  const bookmarks = config.bookmarks;
  const groupedBookmarks = groupBookmarks(groups, bookmarks);
  const groupNames = groupedBookmarks.map((group) => group.name);

  function updateBookmark(index: number, nextBookmark: BookmarkConfig) {
    onChange({ ...config, bookmarks: bookmarks.map((bookmark, bookmarkIndex) => (bookmarkIndex === index ? nextBookmark : bookmark)) });
  }

  function addBookmark() {
    const group = groupNames[0] ?? "General";
    onChange({ ...config, bookmarks: [...bookmarks, { ...defaultBookmark, group }] });
  }

  function updateBookmarkGroupDraft(index: number, value: string) {
    setGroupDrafts((previousDrafts) => ({ ...previousDrafts, [index]: value }));
  }

  function commitBookmarkGroupDraft(index: number, bookmark: BookmarkConfig) {
    const nextGroup = groupDrafts[index];
    if (nextGroup === undefined) return;

    setGroupDrafts((previousDrafts) => {
      const { [index]: _committedGroup, ...remainingDrafts } = previousDrafts;
      return remainingDrafts;
    });

    if (nextGroup.trim() && nextGroup !== bookmark.group) {
      updateBookmark(index, { ...bookmark, group: nextGroup });
    }
  }

  return (
    <div className="editor-stack">
      <div className="editor-section-header">
        <h3>Bookmarks</h3>
        <button className="icon-text-button" type="button" onClick={addBookmark} aria-label="Add bookmark">
          <Plus aria-hidden="true" size={16} />
          <span>Add</span>
        </button>
      </div>

      {groupedBookmarks.map((group) => (
        <details className="editor-panel collapsible-panel bookmark-editor-group" key={group.name}>
          <summary>
            <span>{group.name}</span>
            <span>{group.bookmarks.length} bookmarks</span>
          </summary>
          <div className="collapsible-content">
            {group.bookmarks.map(({ bookmark, index }) => (
              <details className="nested-editor-panel" key={index}>
                <summary>
                  <span>{bookmark.name || `Bookmark ${index + 1}`}</span>
                  <span>{bookmark.url}</span>
                </summary>
                <div className="form-grid compact-form-grid">
                  <label>
                    Bookmark name
                    <input value={bookmark.name} onChange={(event) => updateBookmark(index, { ...bookmark, name: event.target.value })} />
                  </label>
                  <label>
                    Group
                    <input
                      list="bookmark-groups"
                      value={groupDrafts[index] ?? bookmark.group}
                      onChange={(event) => updateBookmarkGroupDraft(index, event.target.value)}
                      onBlur={() => commitBookmarkGroupDraft(index, bookmark)}
                    />
                  </label>
                  <label>
                    Link
                    <input value={bookmark.url} onChange={(event) => updateBookmark(index, { ...bookmark, url: event.target.value })} />
                  </label>
                  <div className="form-grid-span">
                    <IconPicker
                      value={bookmark.icon}
                      color={bookmark.iconColor}
                      onChange={(icon) => updateBookmark(index, { ...bookmark, icon })}
                      onColorChange={(iconColor) => updateBookmark(index, { ...bookmark, iconColor })}
                    />
                  </div>
                  <label>
                    Health mode
                    <select value={bookmark.health.mode} onChange={(event) => updateBookmark(index, { ...bookmark, health: { ...bookmark.health, mode: event.target.value as BookmarkConfig["health"]["mode"] } })}>
                      <option value="default">Default</option>
                      <option value="custom">Custom</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </label>
                  <label>
                    Health URL
                    <input value={bookmark.health.url ?? ""} onChange={(event) => updateBookmark(index, { ...bookmark, health: { ...bookmark.health, url: optionalText(event.target.value) } })} />
                  </label>
                  <label>
                    Method
                    <select value={bookmark.health.method} onChange={(event) => updateBookmark(index, { ...bookmark, health: { ...bookmark.health, method: event.target.value as BookmarkConfig["health"]["method"] } })}>
                      <option value="GET">GET</option>
                      <option value="HEAD">HEAD</option>
                      <option value="POST">POST</option>
                    </select>
                  </label>
                  <label>
                    Expected statuses
                    <input value={bookmark.health.expectedStatuses.join(", ")} onChange={(event) => updateBookmark(index, { ...bookmark, health: { ...bookmark.health, expectedStatuses: parseStatuses(event.target.value) } })} />
                  </label>
                  <label>
                    Interval override
                    <input value={bookmark.health.interval ?? ""} onChange={(event) => updateBookmark(index, { ...bookmark, health: { ...bookmark.health, interval: optionalText(event.target.value) } })} placeholder="5m" />
                  </label>
                </div>
                <div className="row-actions" aria-label={`${bookmark.name || "Bookmark"} actions`}>
                  <button type="button" onClick={() => onChange({ ...config, bookmarks: moveItem(bookmarks, index, index - 1) })} disabled={index === 0} aria-label="Move bookmark up">
                    <ArrowUp aria-hidden="true" size={16} />
                  </button>
                  <button type="button" onClick={() => onChange({ ...config, bookmarks: moveItem(bookmarks, index, index + 1) })} disabled={index === bookmarks.length - 1} aria-label="Move bookmark down">
                    <ArrowDown aria-hidden="true" size={16} />
                  </button>
                  <button type="button" onClick={() => onChange({ ...config, bookmarks: bookmarks.filter((_, bookmarkIndex) => bookmarkIndex !== index) })} aria-label="Delete bookmark">
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}

      <datalist id="bookmark-groups">
        {groupNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

    </div>
  );
}

export function BookmarkGroupEditor({ config, onChange }: BookmarkEditorProps) {
  const groups = groupSettings(config.layout.groups, config.bookmarks);
  const groupNames = Array.from(new Set([...groups.map((group) => group.name), ...config.bookmarks.map((bookmark) => bookmark.group)]));

  function updateGroups(nextGroups: BookmarkGroupConfig[]) {
    onChange({
      ...config,
      layout: {
        ...config.layout,
        groups: nextGroups
      }
    });
  }

  function updateGroup(index: number, nextGroup: BookmarkGroupConfig) {
    updateGroups(groups.map((group, groupIndex) => (groupIndex === index ? nextGroup : group)));
  }

  function addGroup() {
    updateGroups([...groups, { ...defaultGroup, name: uniqueGroupName(groupNames), order: groups.length }]);
  }

  return (
    <div className="editor-stack">
      <div className="editor-section-header">
        <h3>Groups</h3>
        <button className="icon-text-button" type="button" onClick={addGroup} aria-label="Add group">
          <Plus aria-hidden="true" size={16} />
          <span>Add</span>
        </button>
      </div>
      {groups.map((group, index) => (
        <details className="editor-panel collapsible-panel bookmark-group-editor-panel" key={index}>
          <summary>
            <span>{group.name || `Group ${index + 1}`}</span>
            <span>{group.columns ? `${group.columns} columns` : "Default columns"}</span>
          </summary>
          <div className="collapsible-content">
            <div className="form-grid compact-form-grid">
              <label>
                Name
                <input value={group.name} onChange={(event) => updateGroup(index, { ...group, name: event.target.value })} />
              </label>
              <label>
                Order
                <input type="number" value={group.order} onChange={(event) => updateGroup(index, { ...group, order: Number(event.target.value) })} />
              </label>
              <label>
                Columns
                <input type="number" min="1" max="8" value={group.columns ?? ""} onChange={(event) => updateGroup(index, { ...group, columns: optionalNumber(event.target.value) })} />
              </label>
              <label>
                Width
                <select value={group.width ?? ""} onChange={(event) => updateGroup(index, { ...group, width: optionalText(event.target.value) as BookmarkGroupConfig["width"] })}>
                  <option value="">Default</option>
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="wide">Wide</option>
                </select>
              </label>
              <label>
                Row
                <input type="number" min="1" value={group.row ?? ""} onChange={(event) => updateGroup(index, { ...group, row: optionalNumber(event.target.value) })} />
              </label>
            </div>
            <div className="row-actions" aria-label={`${group.name || "Group"} actions`}>
              <button type="button" onClick={() => updateGroups(moveItem(groups, index, index - 1))} disabled={index === 0} aria-label="Move group up">
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button type="button" onClick={() => updateGroups(moveItem(groups, index, index + 1))} disabled={index === groups.length - 1} aria-label="Move group down">
                <ArrowDown aria-hidden="true" size={16} />
              </button>
              <button type="button" onClick={() => updateGroups(groups.filter((_, groupIndex) => groupIndex !== index))} aria-label="Delete group">
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function groupSettings(groups: BookmarkGroupConfig[], bookmarks: BookmarkConfig[]) {
  const configuredNames = new Set(groups.map((group) => group.name));
  const bookmarkOnlyGroups = bookmarks
    .map((bookmark) => bookmark.group)
    .filter((groupName, index, groupNames) => !configuredNames.has(groupName) && groupNames.indexOf(groupName) === index)
    .map((name, index) => ({ ...defaultGroup, name, order: groups.length + index }));
  return [...groups, ...bookmarkOnlyGroups];
}

function groupBookmarks(groups: BookmarkGroupConfig[], bookmarks: BookmarkConfig[]) {
  const groupNames = Array.from(new Set([...groups.map((group) => group.name), ...bookmarks.map((bookmark) => bookmark.group)]));
  const orderByName = new Map(groups.map((group, index) => [group.name, group.order ?? index]));
  return groupNames
    .sort((left, right) => (orderByName.get(left) ?? Number.MAX_SAFE_INTEGER) - (orderByName.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right))
    .map((name) => ({
      name,
      bookmarks: bookmarks.map((bookmark, index) => ({ bookmark, index })).filter(({ bookmark }) => bookmark.group === name)
    }));
}

function optionalText(value: string) {
  return value.trim() ? value : undefined;
}

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

function parseStatuses(value: string) {
  const statuses = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((status) => Number.isInteger(status));
  return statuses.length ? statuses : [];
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const nextItems = [...items];
  const [item] = nextItems.splice(from, 1);
  nextItems.splice(to, 0, item);
  return nextItems;
}

function uniqueGroupName(existingNames: string[]) {
  let index = 1;
  let name = "General";
  while (existingNames.includes(name)) {
    index += 1;
    name = `Group ${index}`;
  }
  return name;
}
