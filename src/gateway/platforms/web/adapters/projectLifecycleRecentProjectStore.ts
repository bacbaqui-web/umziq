import type {
  ProjectLifecycleDirectoryHandle,
} from "@/gateway/platforms/web/adapters/projectLifecycleBrowserDirectoryAdapter";

export type ProjectLifecycleRecentProject = {
  readonly id: string;
  readonly name: string;
  readonly lastOpenedAt: number;
  readonly directory: ProjectLifecycleDirectoryHandle;
};

export type ProjectLifecycleRecentProjectStore = {
  readonly read: () => Promise<
    readonly ProjectLifecycleRecentProject[]
  >;
  readonly remember: (
    directory: ProjectLifecycleDirectoryHandle
  ) => Promise<
    readonly ProjectLifecycleRecentProject[]
  >;
};

const DATABASE_NAME = "umziq-project-lifecycle";
const STORE_NAME = "recent-projects";
const DATABASE_VERSION = 1;
const RECENT_PROJECT_LIMIT = 5;

function openDatabase(
  indexedDb: IDBFactory
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(
      DATABASE_NAME,
      DATABASE_VERSION
    );
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAll(
  database: IDBDatabase
): Promise<ProjectLifecycleRecentProject[]> {
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () => {
      resolve(
        (request.result as ProjectLifecycleRecentProject[])
          .sort((left, right) =>
            right.lastOpenedAt - left.lastOpenedAt
          )
      );
    };
    request.onerror = () => reject(request.error);
  });
}

function replaceAll(
  database: IDBDatabase,
  projects: readonly ProjectLifecycleRecentProject[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      STORE_NAME,
      "readwrite"
    );
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    projects.forEach((project) => store.put(project));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function isSameDirectory(
  left: ProjectLifecycleDirectoryHandle,
  right: ProjectLifecycleDirectoryHandle
) {
  const comparable = left as ProjectLifecycleDirectoryHandle & {
    isSameEntry?: (
      other: ProjectLifecycleDirectoryHandle
    ) => Promise<boolean>;
  };
  return comparable.isSameEntry
    ? comparable.isSameEntry(right)
    : left === right;
}

export function createProjectLifecycleRecentProjectStore(
  indexedDb: IDBFactory | null
): ProjectLifecycleRecentProjectStore {
  const read = async () => {
    if (!indexedDb) return [];
    const database = await openDatabase(indexedDb);
    try {
      return await readAll(database);
    } finally {
      database.close();
    }
  };
  return {
    read,
    remember: async (directory) => {
      if (!indexedDb) return [];
      const current = await read();
      let matching: ProjectLifecycleRecentProject | null = null;
      for (const project of current) {
        if (await isSameDirectory(project.directory, directory)) {
          matching = project;
          break;
        }
      }
      const next = [
        {
          id: matching?.id ?? crypto.randomUUID(),
          name: directory.name,
          lastOpenedAt: Date.now(),
          directory,
        },
        ...current.filter((project) => project !== matching),
      ].slice(0, RECENT_PROJECT_LIMIT);
      const database = await openDatabase(indexedDb);
      try {
        await replaceAll(database, next);
      } finally {
        database.close();
      }
      return next;
    },
  };
}

export const BROWSER_PROJECT_LIFECYCLE_RECENT_PROJECT_STORE =
  createProjectLifecycleRecentProjectStore(
    typeof indexedDB === "undefined" ? null : indexedDB
  );
