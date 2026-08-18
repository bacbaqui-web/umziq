export function sanitizeProjectName(value: string) {
  return value
    .trim()
    .replace(/\.ziq$/i, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .map((character) =>
      character.charCodeAt(0) < 32
        ? "-"
        : character
    )
    .join("")
    .replace(/\.+$/g, "")
    .slice(0, 120);
}

export function createProjectFileName(
  projectName: string
) {
  return `${projectName}.ziq`;
}

export function formatPendingProjectLocation(
  parentDirectoryName: string | null,
  projectName: string
) {
  return parentDirectoryName
    ? `${parentDirectoryName}/${projectName || "프로젝트 이름"}`
    : "프로젝트를 보관할 상위 폴더를 선택해주세요.";
}
