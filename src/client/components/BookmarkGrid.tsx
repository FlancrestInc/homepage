import type { CSSProperties } from "react";
import { IconGlyph } from "../icons";
import type { PublicBookmarkGroup } from "../types";

type BookmarkGridProps = {
  groups: PublicBookmarkGroup[];
};

export function BookmarkGrid({ groups }: BookmarkGridProps) {
  return (
    <section className="bookmark-groups" aria-label="Bookmarks">
      {groups.map((group) => (
        <article className={`bookmark-group group-${group.width ?? "normal"}`} key={group.name}>
          <h2>{group.name}</h2>
          <div className="bookmark-list" style={{ "--group-columns": group.columns ?? 4 } as CSSProperties}>
            {group.bookmarks.map((bookmark) => (
              <a
                className={`bookmark-button status-${bookmark.status}`}
                href={bookmark.url}
                key={`${bookmark.group}-${bookmark.name}-${bookmark.url}`}
                aria-label={bookmark.name}
                title={bookmark.name}
              >
                <span className="bookmark-icon" aria-hidden="true">
                  <IconGlyph value={bookmark.icon} color={bookmark.iconColor} />
                </span>
                <span className="bookmark-label">{bookmark.name}</span>
              </a>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
