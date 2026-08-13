export const apiUrl = (path: string) =>
  `${location.port === "4173" ? `http://${location.hostname}:8789` : ""}${path}`;
