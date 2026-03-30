export type DependencyStatus = "up" | "down" | "degraded" | "unknown";

type RuntimeDependencies = {
  database: DependencyStatus;
  redis: DependencyStatus;
};

const runtimeDependencies: RuntimeDependencies = {
  database: "unknown",
  redis: "unknown"
};

export function setDatabaseStatus(status: DependencyStatus) {
  runtimeDependencies.database = status;
}

export function setRedisStatus(status: DependencyStatus) {
  runtimeDependencies.redis = status;
}

export function getRuntimeDependencies() {
  return { ...runtimeDependencies };
}
